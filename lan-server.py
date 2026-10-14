#!/usr/bin/env python3
"""Commander Table LAN server.

Serves the game's static files and relays PeerJS-style traffic between browsers
over WebSockets, so the game works on networks where WebRTC is blocked.

It also knows its own version, can check GitHub for a newer one and can update
itself (git checkout: fast-forward merge; plain folder: download + copy files),
then restart cleanly.

Usage:  python lan-server.py [--port 8790] [--no-browser] [--start]

Python 3.8+ standard library only.
"""
import argparse
import base64
import hashlib
import io
import json
import mimetypes
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
import webbrowser
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_MESSAGE = 8 * 1024 * 1024
PING_EVERY = 15
HELLO_MAX_MSG = 8000000   # advertised to clients in the v2 'hello' (docs/relay-protocol.md)
IDLE_TIMEOUT = 45

GITHUB_REPO = 'ccall1212/commander-table'
GITHUB_BRANCH = 'main'
USER_AGENT = 'CommanderTable-LAN'
CHECK_CACHE_SECONDS = 5 * 60
MAX_ZIP_BYTES = 25 * 1024 * 1024
MAX_UNZIPPED_BYTES = 150 * 1024 * 1024
BACKUPS_TO_KEEP = 3
RESTART_CODE = 42

CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown; charset=utf-8',
}

PORT = 8790
LAN_URLS = []
STARTED_MS = int(time.time() * 1000)
HTTPD = None            # the running Server, or None before it is started

# ---------------------------------------------------------------- output


def say(text=''):
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode('ascii', 'replace').decode('ascii'), flush=True)


def stamp(text):
    say('[%s] %s' % (time.strftime('%H:%M:%S'), text))


# ---------------------------------------------------------------- network info


def lan_urls(port):
    ips = []

    def add(ip):
        if ip and not ip.startswith('127.') and not ip.startswith('169.254.') and ip not in ips:
            ips.append(ip)

    host = socket.gethostname()
    try:
        for info in socket.getaddrinfo(host, None, socket.AF_INET):
            add(info[4][0])
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            add(s.getsockname()[0])
        finally:
            s.close()
    except Exception:
        pass
    urls = ['http://%s:%d/' % (host, port)]
    for ip in ips:
        urls.append('http://%s:%d/' % (ip, port))
    return urls


# ---------------------------------------------------------------- version


def read_text(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()


def read_semver():
    try:
        m = re.search(r'<meta\s+name=["\']app-version["\']\s+content=["\']([^"\']+)["\']',
                      read_text(os.path.join(ROOT, 'index.html')), re.I)
        if m:
            return m.group(1).strip()
    except Exception:
        pass
    return '0.0.0'


_SHA_RE = re.compile(r'^(?:[0-9a-f]{40}|[0-9a-f]{64})$')


def read_git_sha():
    """Current commit from .git without needing the git binary, or None."""
    gd = os.path.join(ROOT, '.git')
    if not os.path.isdir(gd):
        return None
    try:
        head = read_text(os.path.join(gd, 'HEAD')).strip()
        if head.startswith('ref:'):
            ref = head[4:].strip()
            sha = None
            ref_file = os.path.join(gd, *ref.split('/'))
            if os.path.isfile(ref_file):
                sha = read_text(ref_file).strip()
            else:
                pr = os.path.join(gd, 'packed-refs')
                if os.path.isfile(pr):
                    for line in read_text(pr).splitlines():
                        line = line.strip()
                        if not line or line[0] in '#^':
                            continue
                        parts = line.split(None, 1)
                        if len(parts) == 2 and parts[1].strip() == ref:
                            sha = parts[0]
                            break
        else:
            sha = head
        if sha and _SHA_RE.match(sha.lower()):
            return sha.lower()
    except Exception:
        pass
    return None


def read_version_file():
    try:
        data = json.loads(read_text(os.path.join(ROOT, 'VERSION.json')))
        sha = data.get('sha')
        if isinstance(sha, str) and _SHA_RE.match(sha.strip().lower()):
            return sha.strip().lower()
    except Exception:
        pass
    return None


def version_info():
    sha = read_git_sha()
    source = 'git'
    if not sha:
        sha = read_version_file()
        source = 'file'
    if not sha:
        source = 'unknown'
    return {'version': read_semver(), 'sha': sha, 'short': sha[:7] if sha else None, 'source': source}


def version_string(info=None):
    info = info or version_info()
    if info['short']:
        return 'v%s (%s)' % (info['version'], info['short'])
    return 'v%s' % info['version']


def is_git_mode():
    return os.path.exists(os.path.join(ROOT, '.git'))


# ---------------------------------------------------------------- update check

check_lock = threading.Lock()
update_lock = threading.Lock()
_check_cache = {'at': 0.0, 'local': None, 'result': None}
last_check = {'at': None, 'result': None}


class GitHubError(Exception):
    def __init__(self, code, message):
        Exception.__init__(self, message)
        self.code = code
        self.message = message


def github_json(path):
    url = 'https://api.github.com' + path
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'application/vnd.github+json',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        msg = 'HTTP %d' % e.code
        try:
            if e.code in (403, 429) and e.headers.get('X-RateLimit-Remaining') == '0':
                msg = 'GitHub rate limit reached'
                reset = e.headers.get('X-RateLimit-Reset')
                if reset and reset.isdigit():
                    mins = max(1, int((int(reset) - time.time()) / 60) + 1)
                    msg += ' - try again in about %d minute%s' % (mins, '' if mins == 1 else 's')
        except Exception:
            pass
        raise GitHubError(e.code, msg)
    except Exception as e:
        raise GitHubError(None, str(getattr(e, 'reason', None) or e))


def first_line(text):
    return (text or '').strip().split('\n')[0].strip()


def do_check(info):
    """Query GitHub. Returns the cacheable (request-independent) result dict."""
    try:
        latest_raw = github_json('/repos/%s/commits/%s' % (GITHUB_REPO, GITHUB_BRANCH))
        lsha = latest_raw['sha'].lower()
        commit = latest_raw.get('commit') or {}
        latest = {
            'sha': lsha,
            'short': lsha[:7],
            'message': first_line(commit.get('message')),
            'date': (commit.get('author') or {}).get('date'),
            'url': latest_raw.get('html_url') or 'https://github.com/%s/commit/%s' % (GITHUB_REPO, lsha),
        }
        local = info['sha']
        behind = None
        commits = []
        if local and local == lsha:
            status, behind = 'up-to-date', 0
        elif not local:
            status = 'available'
        else:
            try:
                cmp_ = github_json('/repos/%s/compare/%s...%s' % (GITHUB_REPO, local, lsha))
            except GitHubError as e:
                if e.code == 404:
                    cmp_ = {'status': 'unknown-commit'}
                else:
                    raise
            st = cmp_.get('status')
            if st == 'ahead':
                status = 'available'
                behind = cmp_.get('ahead_by')
                for cm in reversed((cmp_.get('commits') or [])[-20:]):
                    c = cm.get('commit') or {}
                    a = c.get('author') or {}
                    commits.append({
                        'short': (cm.get('sha') or '')[:7],
                        'message': first_line(c.get('message')),
                        'date': a.get('date'),
                        'author': a.get('name'),
                    })
            elif st == 'identical':
                status, behind = 'up-to-date', 0
            else:                           # behind, diverged, or commit unknown to GitHub
                status = 'local-changes'
        return {
            'ok': True,
            'status': status,
            'current': {'sha': local, 'short': info['short'], 'version': info['version']},
            'latest': latest,
            'behind_by': behind,
            'commits': commits,
            'checked': int(time.time() * 1000),
        }
    except GitHubError as e:
        return {'ok': False, 'error': 'Could not reach GitHub: %s' % e.message}
    except Exception as e:
        return {'ok': False, 'error': 'Could not reach GitHub: %s' % e}


def check_update(force=False):
    info = version_info()
    with check_lock:
        c = _check_cache
        if (not force and c['result'] is not None and c['local'] == info['sha']
                and time.time() - c['at'] < CHECK_CACHE_SECONDS):
            return c['result']
        result = do_check(info)
        if result.get('ok'):
            c['at'], c['local'], c['result'] = time.time(), info['sha'], result
        else:
            c['result'] = None
        last_check['at'], last_check['result'] = time.time(), result
        return result


def run_git(args, timeout=60):
    git = shutil.which('git')
    if not git:
        raise OSError('git is not installed')
    env = dict(os.environ)
    env['GIT_TERMINAL_PROMPT'] = '0'
    kw = {}
    if os.name == 'nt':
        kw['creationflags'] = 0x08000000        # CREATE_NO_WINDOW
    p = subprocess.run([git] + args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       timeout=timeout, env=env, **kw)
    return (p.returncode,
            p.stdout.decode('utf-8', 'replace').strip(),
            p.stderr.decode('utf-8', 'replace').strip())


def git_blocker():
    """Why a git-mode checkout can't be updated automatically, or None if it can."""
    if not shutil.which('git'):
        return 'git is not installed, so this git checkout cannot be updated automatically.'
    try:
        code, out, err = run_git(['status', '--porcelain', '--untracked-files=no'], timeout=30)
    except Exception as e:
        return 'Could not run git: %s' % e
    if code != 0:
        return 'Could not read the git status: %s' % (err or out)[:200]
    if out:
        return 'This folder is a git checkout with uncommitted changes - commit or stash them first.'
    try:
        head = read_text(os.path.join(ROOT, '.git', 'HEAD')).strip()
    except Exception:
        head = ''
    if head != 'ref: refs/heads/%s' % GITHUB_BRANCH:
        return 'This git checkout is not on the %s branch, so it cannot be updated automatically.' % GITHUB_BRANCH
    return None


def finalize_check(result, local):
    """Add the per-request fields (mode / canApply / note) to a cached check result."""
    out = dict(result)
    if not out.get('ok'):
        return out
    mode = 'git' if is_git_mode() else 'zip'
    out['mode'] = mode
    can = False
    note = None
    if out['status'] == 'available':
        if not local:
            note = 'Updates can only be installed from the computer that hosts the game.'
        elif mode == 'git':
            note = git_blocker()
            can = note is None
        else:
            can = True
    elif out['status'] == 'local-changes':
        note = ('This copy has changes that are not on GitHub (or has moved past it), '
                'so it cannot be updated automatically.')
    out['canApply'] = can
    out['note'] = note
    return out


# ---------------------------------------------------------------- applying an update


def apply_git():
    stamp('Updating with git...')
    for args in (['fetch', 'origin', GITHUB_BRANCH], ['merge', '--ff-only', 'origin/%s' % GITHUB_BRANCH]):
        try:
            code, out, err = run_git(args, timeout=60)
        except subprocess.TimeoutExpired:
            return False, 'git %s timed out' % args[0]
        except Exception as e:
            return False, 'git %s failed: %s' % (args[0], e)
        if code != 0:
            msg = (err or out or 'exit code %d' % code)
            return False, 'git %s failed: %s' % (args[0], msg[-600:])
    return True, None


def _safe_member(name):
    if not name or '\x00' in name or '\\' in name or name.startswith('/') or re.match(r'^[A-Za-z]:', name):
        return False
    return '..' not in name.split('/')


def _download(url):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        cl = r.headers.get('Content-Length')
        if cl and cl.isdigit() and int(cl) > MAX_ZIP_BYTES:
            raise ValueError('the download is too large (over %d MB)' % (MAX_ZIP_BYTES // 1048576))
        buf = bytearray()
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            buf += chunk
            if len(buf) > MAX_ZIP_BYTES:
                raise ValueError('the download is too large (over %d MB)' % (MAX_ZIP_BYTES // 1048576))
    return bytes(buf)


def _backup_stamp(name):
    return name[-15:]       # YYYYmmdd-HHMMSS


def prune_backups():
    bdir = os.path.join(ROOT, '.backup')
    try:
        names = [n for n in os.listdir(bdir) if os.path.isdir(os.path.join(bdir, n))]
        names.sort(key=_backup_stamp, reverse=True)
        for n in names[BACKUPS_TO_KEEP:]:
            shutil.rmtree(os.path.join(bdir, n), ignore_errors=True)
    except Exception:
        pass


def apply_zip(latest, info):
    short = latest['short']
    stamp('Downloading update %s...' % short)
    url = 'https://codeload.github.com/%s/zip/%s' % (GITHUB_REPO, latest['sha'])
    try:
        data = _download(url)
    except Exception as e:
        return False, 'Download failed: %s' % (getattr(e, 'reason', None) or e)
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except Exception as e:
        return False, 'The downloaded file is not a valid zip: %s' % e

    members = []        # (rel path, ZipInfo)
    tops = set()
    total = 0
    for zi in zf.infolist():
        if not _safe_member(zi.filename):
            return False, 'The download contains an unsafe path (%r); update cancelled.' % zi.filename
        top = zi.filename.split('/')[0]
        tops.add(top)
        total += zi.file_size
        if zi.filename.endswith('/'):
            continue
        rel = zi.filename[len(top) + 1:]
        if not rel:
            return False, 'The download has an unexpected layout; update cancelled.'
        if rel.split('/')[0] in ('.git', '.backup') or rel == 'VERSION.json':
            continue
        members.append((rel, zi))
    if total > MAX_UNZIPPED_BYTES:
        return False, 'The download is too large once unpacked; update cancelled.'
    if len(tops) != 1:
        return False, 'The download has an unexpected layout; update cancelled.'
    rels = set(r for r, _ in members)
    if 'index.html' not in rels or 'lan-server.py' not in rels:
        return False, 'The download does not look like Commander Table; update cancelled.'

    tmp = tempfile.mkdtemp(prefix='ct-update-')
    try:
        for rel, zi in members:
            dest = os.path.join(tmp, *rel.split('/'))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with zf.open(zi) as src, open(dest, 'wb') as dst:
                shutil.copyfileobj(src, dst)
            if os.name != 'nt':
                mode = (zi.external_attr >> 16) & 0o777
                try:
                    os.chmod(dest, mode if mode & 0o111 else 0o644)
                except OSError:
                    pass
        try:
            new_version = re.search(r'<meta\s+name=["\']app-version["\']\s+content=["\']([^"\']+)["\']',
                                    read_text(os.path.join(tmp, 'index.html')), re.I)
            new_version = new_version.group(1) if new_version else None
        except Exception:
            new_version = None

        bdir = os.path.join(ROOT, '.backup', '%s-%s' % (info['short'] or 'unknown', time.strftime('%Y%m%d-%H%M%S')))
        backed, created, partial = [], [], []
        targets = sorted(rels) + ['VERSION.json']
        try:
            for rel in targets:
                dest = os.path.join(ROOT, *rel.split('/'))
                if os.path.isfile(dest):
                    b = os.path.join(bdir, *rel.split('/'))
                    os.makedirs(os.path.dirname(b), exist_ok=True)
                    shutil.copy2(dest, b)
                    backed.append(rel)
            for rel in sorted(rels):
                dest = os.path.join(ROOT, *rel.split('/'))
                existed = os.path.isfile(dest)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                part = dest + '.ct-new'
                partial.append(part)
                shutil.copy2(os.path.join(tmp, *rel.split('/')), part)
                os.replace(part, dest)
                partial.remove(part)
                if not existed:
                    created.append(dest)
            vf = os.path.join(ROOT, 'VERSION.json')
            part = vf + '.ct-new'
            partial.append(part)
            with open(part, 'w', encoding='utf-8') as f:
                json.dump({'sha': latest['sha'], 'date': latest.get('date')}, f)
                f.write('\n')
            os.replace(part, vf)
            partial.remove(part)
        except Exception as e:
            for part in partial:
                try:
                    os.remove(part)
                except OSError:
                    pass
            for rel in backed:
                try:
                    shutil.copy2(os.path.join(bdir, *rel.split('/')), os.path.join(ROOT, *rel.split('/')))
                except Exception:
                    pass
            for dest in created:
                try:
                    os.remove(dest)
                except OSError:
                    pass
            return False, 'Could not copy the new files (%s). Your files were put back as they were.' % e
        prune_backups()
        return True, new_version
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def perform_update():
    """Re-check and install. Returns {'ok': True, 'to': {...}} or {'ok': False, 'error': ...}.
    Does not restart; the caller does that on success."""
    if not update_lock.acquire(False):
        return {'ok': False, 'error': 'An update is already in progress'}
    try:
        res = check_update(True)
        if not res.get('ok'):
            return res
        if res['status'] == 'up-to-date':
            return {'ok': False, 'error': 'Already up to date'}
        if res['status'] != 'available':
            return {'ok': False, 'error': 'This copy has changes that are not on GitHub, so it cannot be updated automatically.'}
        fin = finalize_check(res, True)
        if not fin['canApply']:
            return {'ok': False, 'error': fin['note'] or 'This copy cannot be updated automatically.'}
        info = version_info()
        latest = res['latest']
        if fin['mode'] == 'git':
            ok, err = apply_git()
            new_version = None
        else:
            ok, err = apply_zip(latest, info)
            new_version = err if ok else None
            err = None if ok else err
        if not ok:
            return {'ok': False, 'error': err}
        with check_lock:
            _check_cache['result'] = None
        nv = version_info()
        to_sha = nv['sha'] or latest['sha']
        shown = '%s (%s)' % ('v' + (new_version or nv['version']), to_sha[:7])
        stamp('Updated to %s - restarting...' % shown)
        return {'ok': True, 'restarting': True, 'to': {'sha': to_sha, 'short': to_sha[:7]}}
    finally:
        update_lock.release()


# ---------------------------------------------------------------- broker


class Client(object):
    """One WebSocket connection."""

    def __init__(self, sock, addr):
        self.sock = sock
        self.addr = addr
        self.send_lock = threading.Lock()
        self.id = None
        self.key = None
        self.links = set()
        self.dead = False

    def _send_frame(self, opcode, payload):
        n = len(payload)
        head = bytearray([0x80 | opcode])
        if n < 126:
            head.append(n)
        elif n < 65536:
            head.append(126)
            head += struct.pack('>H', n)
        else:
            head.append(127)
            head += struct.pack('>Q', n)
        with self.send_lock:
            self.sock.sendall(bytes(head) + payload)

    def send_raw(self, opcode, payload=b''):
        try:
            self._send_frame(opcode, payload)
            return True
        except Exception:
            self.kill()
            return False

    def send_json(self, obj):
        data = json.dumps(obj, separators=(',', ':')).encode('utf-8')
        return self.send_raw(0x1, data)

    def kill(self):
        """Force the socket closed; the reader thread then cleans up."""
        self.dead = True
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
        try:
            self.sock.close()
        except Exception:
            pass


broker_lock = threading.Lock()
peers = {}      # peer id -> Client
links = {}      # lid -> (initiator Client, target Client)
all_clients = set()


def handle_message(c, msg):
    op = msg.get('op')
    if op == 'ping':
        c.send_json({'op': 'pong'})
    elif op == 'reg':
        want = msg.get('id')
        key = msg.get('key')
        if not isinstance(key, str) or key == '':
            key = None
        old = None
        notify = []
        with broker_lock:
            if c.id is not None:
                reply = {'op': 'err', 'type': 'invalid-message', 'message': 'Already registered'}
            else:
                if want is None or want == '':
                    want = str(uuid.uuid4())
                if not isinstance(want, str):
                    reply = {'op': 'err', 'type': 'invalid-message', 'message': 'Bad id'}
                else:
                    holder = peers.get(want)
                    if holder is not None and holder is not c and key is not None and holder.key == key:
                        # TAKEOVER: same key re-registering the id (e.g. a second tab)
                        old = holder
                        notify = teardown_locked(old)
                        holder = None
                    if holder is not None:
                        reply = {'op': 'err', 'type': 'unavailable-id', 'message': 'ID is taken'}
                    else:
                        peers[want] = c
                        c.id = want
                        c.key = key
                        reply = {'op': 'open', 'id': want}
        if old is not None:
            old.send_json({'op': 'err', 'type': 'replaced', 'message': 'Opened somewhere else'})
            for other, lid in notify:
                other.send_json({'op': 'cclose', 'lid': lid})
            old.send_raw(0x8, struct.pack('>H', 1000))
            old.kill()
            stamp('~ peer %s replaced (%s)' % (want, old.addr[0]))
        c.send_json(reply)
        if reply['op'] == 'open':
            stamp('+ peer %s (%s)' % (c.id, c.addr[0]))
    elif op == 'conn':
        cid = msg.get('cid')
        to = msg.get('to')
        lid = None
        with broker_lock:
            target = peers.get(to) if isinstance(to, str) else None
            if c.id is None or target is None or target.dead:
                target = None
            else:
                lid = str(uuid.uuid4())
                links[lid] = (c, target)
                c.links.add(lid)
                target.links.add(lid)
        if target is None:
            c.send_json({'op': 'cfail', 'cid': cid, 'type': 'peer-unavailable',
                         'message': 'Could not connect to peer %s' % (to,)})
            return
        target.send_json({'op': 'inc', 'lid': lid, 'from': c.id, 'meta': msg.get('meta')})
        c.send_json({'op': 'copen', 'cid': cid, 'lid': lid})
    elif op == 'msg':
        lid = msg.get('lid')
        with broker_lock:
            link = links.get(lid)
            other = None
            if link is not None:
                if link[0] is c:
                    other = link[1]
                elif link[1] is c:
                    other = link[0]
        if other is not None:
            other.send_json({'op': 'msg', 'lid': lid, 'd': msg.get('d')})
    elif op == 'cclose':
        lid = msg.get('lid')
        with broker_lock:
            link = links.get(lid)
            other = None
            if link is not None and (link[0] is c or link[1] is c):
                other = link[1] if link[0] is c else link[0]
                del links[lid]
                link[0].links.discard(lid)
                link[1].links.discard(lid)
        if other is not None:
            other.send_json({'op': 'cclose', 'lid': lid})


def teardown_locked(c):
    """Unregister c and drop its links (caller holds broker_lock).
    Returns [(other client, lid)] that must be told 'cclose'."""
    notify = []
    all_clients.discard(c)
    if c.id is not None and peers.get(c.id) is c:
        del peers[c.id]
    for lid in list(c.links):
        link = links.pop(lid, None)
        if link is None:
            continue
        other = link[1] if link[0] is c else link[0]
        other.links.discard(lid)
        notify.append((other, lid))
    c.links.clear()
    return notify


def cleanup(c):
    c.dead = True
    with broker_lock:
        had_id = c.id if (c.id is not None and peers.get(c.id) is c) else None
        notify = teardown_locked(c)
    for other, lid in notify:
        other.send_json({'op': 'cclose', 'lid': lid})
    if had_id is not None:
        stamp('- peer %s (%s)' % (had_id, c.addr[0]))
    try:
        c.sock.close()
    except Exception:
        pass


def keepalive_loop():
    while True:
        time.sleep(PING_EVERY)
        with broker_lock:
            targets = list(all_clients)
        for c in targets:
            c.send_raw(0x9, b'')


def connected_ips():
    with broker_lock:
        return [c.addr[0] for c in peers.values()]


def close_all_clients():
    with broker_lock:
        targets = list(all_clients)
    for c in targets:
        c.send_raw(0x8, struct.pack('>H', 1001))
        c.kill()


# ---------------------------------------------------------------- websocket frames


def read_exact(rfile, n):
    data = rfile.read(n)
    if data is None or len(data) < n:
        raise EOFError('connection closed')
    return data


def serve_websocket(c, rfile):
    """Read frames until closed. Raises on any problem; the caller cleans up."""
    frag_op = None
    frag = bytearray()
    while not c.dead:
        b1, b2 = read_exact(rfile, 2)
        fin = bool(b1 & 0x80)
        opcode = b1 & 0x0F
        masked = bool(b2 & 0x80)
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack('>H', read_exact(rfile, 2))[0]
        elif length == 127:
            length = struct.unpack('>Q', read_exact(rfile, 8))[0]
        if length > MAX_MESSAGE:
            c.send_raw(0x8, struct.pack('>H', 1009))
            return
        mask = read_exact(rfile, 4) if masked else None
        payload = read_exact(rfile, length) if length else b''
        if mask and length:
            # XOR the whole payload at once using big integers (fast, no per-byte loop)
            key = (mask * (length // 4 + 1))[:length]
            payload = (int.from_bytes(payload, 'big') ^ int.from_bytes(key, 'big')).to_bytes(length, 'big')

        if opcode == 0x8:            # close: echo and stop
            c.send_raw(0x8, payload[:2])
            return
        if opcode == 0x9:            # ping
            c.send_raw(0xA, payload)
            continue
        if opcode == 0xA:            # pong
            continue

        if opcode in (0x1, 0x2):
            frag_op = opcode
            frag = bytearray(payload)
        elif opcode == 0x0:
            if frag_op is None:
                continue
            frag += payload
        else:
            continue
        if len(frag) > MAX_MESSAGE:
            c.send_raw(0x8, struct.pack('>H', 1009))
            return
        if not fin:
            continue
        data, kind = bytes(frag), frag_op
        frag_op, frag = None, bytearray()
        if kind != 0x1:
            continue                 # binary frames are not used
        try:
            msg = json.loads(data.decode('utf-8'))
        except Exception:
            continue
        if isinstance(msg, dict):
            handle_message(c, msg)


# ---------------------------------------------------------------- http

LOCAL_ADDRS = ('127.0.0.1', '::1', '::ffff:127.0.0.1')


class Handler(BaseHTTPRequestHandler):
    server_version = 'CommanderTableLAN/2'

    def log_message(self, fmt, *args):
        pass

    def do_HEAD(self):
        self.handle_get(True)

    def do_GET(self):
        self.handle_get(False)

    def do_OPTIONS(self):
        # No CORS: cross-site pages must not be able to preflight the API.
        self.drain_body()
        self.send_json(405, {'ok': False, 'error': 'Method not allowed'})

    def do_POST(self):
        self.drain_body()
        try:
            path = unquote(urlsplit(self.path).path)
        except Exception:
            path = ''
        if path != '/api/update/apply':
            return self.send_json(404, {'ok': False, 'error': 'Not found'})
        if not self.is_local():
            return self.send_json(403, {'ok': False, 'error': 'Updates can only be installed from the computer that hosts the game.'})
        if self.headers.get('X-CT-Update') is None:
            return self.send_json(403, {'ok': False, 'error': 'Missing X-CT-Update header'})
        host = (self.headers.get('Host') or '').strip().lower()
        host = host.rsplit(':', 1)[0] if not host.endswith(']') else host
        if host not in ('localhost', '127.0.0.1', '[::1]') and not host.endswith('.localhost'):
            return self.send_json(403, {'ok': False, 'error': 'Open the game at http://localhost:%d/ on this computer to update.' % PORT})
        res = perform_update()
        self.send_json(200, res)
        if res.get('ok'):
            threading.Timer(0.8, restart_server).start()

    def is_local(self):
        return self.client_address[0] in LOCAL_ADDRS

    def drain_body(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if 0 < n <= 65536:
                self.rfile.read(n)
        except Exception:
            pass

    def send_body(self, code, ctype, body, head_only, cache='no-cache'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', cache)
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def send_json(self, code, obj, head_only=False):
        body = json.dumps(obj, separators=(',', ':')).encode('utf-8')
        self.send_body(code, 'application/json; charset=utf-8', body, head_only, cache='no-store')

    def not_found(self, head_only):
        self.send_body(404, 'text/plain; charset=utf-8', b'Not found', head_only)

    def handle_get(self, head_only):
        try:
            parts = urlsplit(self.path)
            path = unquote(parts.path)
        except Exception:
            return self.not_found(head_only)

        if (path == '/ws' or path.startswith('/room/')) and 'websocket' in self.headers.get('Upgrade', '').lower():
            return self.handle_ws()
        if path == '/js/lan-mode.js':
            info = version_info()
            cfg = {
                'port': PORT,
                'urls': LAN_URLS,
                'version': info['version'],
                'sha': info['sha'],
                'short': info['short'],
                'source': info['source'],
                'local': self.is_local(),
                'repo': GITHUB_REPO,
                'started': STARTED_MS,
            }
            body = ('window.CT_LAN = %s;\n' % json.dumps(cfg)).encode('utf-8')
            return self.send_body(200, 'application/javascript; charset=utf-8', body, head_only, cache='no-store')
        if path == '/api/version':
            info = version_info()
            info['started'] = STARTED_MS
            return self.send_json(200, info, head_only)
        if path == '/api/update/check':
            force = parse_qs(parts.query).get('force', [''])[0] not in ('', '0', 'false')
            res = finalize_check(check_update(force), self.is_local())
            return self.send_json(200, res, head_only)

        if path == '/':
            path = '/index.html'
        if '\x00' in path or '\\' in path:
            return self.not_found(head_only)
        segments = [s for s in path.split('/') if s != '']
        if not segments or any(s.startswith('.') for s in segments):
            return self.not_found(head_only)
        full = os.path.realpath(os.path.join(ROOT, *segments))
        root_real = os.path.realpath(ROOT)
        try:
            inside = os.path.commonpath([root_real, full]) == root_real
        except ValueError:
            inside = False
        if not inside or not os.path.isfile(full):
            return self.not_found(head_only)
        try:
            with open(full, 'rb') as f:
                body = f.read()
        except OSError:
            return self.not_found(head_only)
        ext = os.path.splitext(full)[1].lower()
        ctype = CONTENT_TYPES.get(ext) or mimetypes.guess_type(full)[0] or 'application/octet-stream'
        self.send_body(200, ctype, body, head_only)

    def handle_ws(self):
        key = self.headers.get('Sec-WebSocket-Key')
        if not key:
            self.send_body(400, 'text/plain; charset=utf-8', b'Bad request', False)
            return
        accept = base64.b64encode(hashlib.sha1((key.strip() + WS_GUID).encode('ascii')).digest()).decode('ascii')
        sock = self.connection
        sock.sendall(('HTTP/1.1 101 Switching Protocols\r\n'
                      'Upgrade: websocket\r\n'
                      'Connection: Upgrade\r\n'
                      'Sec-WebSocket-Accept: %s\r\n\r\n' % accept).encode('ascii'))
        self.close_connection = True
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass
        sock.settimeout(IDLE_TIMEOUT)
        c = Client(sock, self.client_address)
        with broker_lock:
            all_clients.add(c)
        try:
            c.send_json({'op': 'hello', 'v': 2, 'server': 'lan', 'maxMsg': HELLO_MAX_MSG})
            serve_websocket(c, self.rfile)
        except Exception:
            pass
        finally:
            cleanup(c)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows SO_REUSEADDR lets a second server bind the same port, which
    # would defeat the "port is busy" check, so only enable it elsewhere.
    allow_reuse_address = (os.name != 'nt')


# ---------------------------------------------------------------- lifecycle


def stop_server():
    """Stop listening and drop every WebSocket."""
    global HTTPD
    httpd, HTTPD = HTTPD, None
    if httpd is not None:
        try:
            httpd.shutdown()
        except Exception:
            pass
        try:
            httpd.server_close()
        except Exception:
            pass
    close_all_clients()


def restart_server():
    """Ask the supervisor for a fresh process (exit code 42)."""
    stamp('Restarting the server...')
    stop_server()
    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except Exception:
        pass
    os._exit(RESTART_CODE)


def bind_server(port, retry_seconds):
    deadline = time.time() + retry_seconds
    while True:
        try:
            return Server(('0.0.0.0', port), Handler)
        except OSError:
            if time.time() >= deadline:
                raise
            time.sleep(0.3)


def start_serving(open_browser):
    """Bind, print the banner and start the server thread. Exits the process if the port is busy."""
    global HTTPD, LAN_URLS, STARTED_MS
    retry = 10 if os.environ.get('CT_LAN_RESTARTED') else 0
    try:
        httpd = bind_server(PORT, retry)
    except OSError as e:
        say('Port %d is busy — is the server already running? Try --port %d  (%s)' % (PORT, PORT + 1, e))
        sys.exit(1)
    HTTPD = httpd
    STARTED_MS = int(time.time() * 1000)
    LAN_URLS = lan_urls(PORT)
    say('Commander Table LAN server  %s' % version_string())
    say('Players on your network open:')
    for u in LAN_URLS:
        say('  ' + u)
    say('Keep this window open while you play. Close it (or press Ctrl+C) to stop.')
    say()
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    threading.Thread(target=keepalive_loop, daemon=True).start()
    if open_browser:
        open_game()


def open_game():
    try:
        webbrowser.open('http://localhost:%d/' % PORT)
    except Exception:
        pass


# ---------------------------------------------------------------- terminal menu


def fmt_uptime(seconds):
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return '%dh %dm' % (h, m)
    if m:
        return '%dm %ds' % (m, s)
    return '%ds' % s


def describe_check(res):
    """Print an update-check result."""
    if not res.get('ok'):
        say('  ' + res.get('error', 'Update check failed'))
        return
    st = res['status']
    latest = res['latest']
    if st == 'up-to-date':
        say('  You are up to date (%s).' % version_string())
    elif st == 'available':
        n = res.get('behind_by')
        if n:
            say('  %d newer version%s available:' % (n, '' if n == 1 else 's'))
        else:
            say('  A newer version is available (latest: %s - %s).' % (latest['short'], latest['message']))
        for cm in res.get('commits') or []:
            say('    %s  %s' % (cm['short'], cm['message']))
    else:
        say('  This copy has changes that are not on GitHub, so it cannot be updated automatically.')
        say('  (GitHub latest: %s - %s)' % (latest['short'], latest['message']))


def show_status():
    info = version_info()
    say('  Version:  %s' % version_string(info))
    if HTTPD is None:
        say('  Server:   not running')
    else:
        say('  Server:   running on port %d, up %s' % (PORT, fmt_uptime(time.time() - STARTED_MS / 1000.0)))
        for u in LAN_URLS:
            say('            ' + u)
        ips = connected_ips()
        say('  Players:  %d connected%s' % (len(ips), (' (%s)' % ', '.join(ips)) if ips else ''))
    if last_check['result'] is not None:
        say('  Last update check (%s):' % time.strftime('%H:%M:%S', time.localtime(last_check['at'])))
        describe_check(finalize_check(last_check['result'], True))
    else:
        say('  Last update check: none yet')


def menu_check_updates():
    say('  Checking GitHub...')
    res = check_update(True)
    fin = finalize_check(res, True)
    describe_check(fin)
    if not res.get('ok') or res['status'] != 'available':
        return
    if not fin['canApply']:
        if fin.get('note'):
            say('  ' + fin['note'])
        return
    try:
        ans = input('  Install it now? [y/N] ').strip().lower()
    except EOFError:
        return
    if ans not in ('y', 'yes'):
        return
    out = perform_update()
    if out.get('ok'):
        restart_server()
    say('  Update failed: %s' % out.get('error'))


def read_choice(prompt):
    return input(prompt).strip().lower()


def start_menu():
    """Pre-start menu. Returns when the user chose to start the game."""
    while True:
        say()
        say('  Commander Table  %s - LAN server' % version_string())
        say()
        say('  [1] Start the game (opens your browser)   <- press Enter')
        say('  [2] Status')
        say('  [3] Check for updates')
        say('  [Q] Quit')
        say()
        c = read_choice('  Choose: ')
        if c in ('', '1'):
            return
        if c == '2':
            show_status()
        elif c == '3':
            menu_check_updates()
        elif c in ('q', 'quit', 'exit'):
            sys.exit(0)


def running_menu():
    """Menu while serving. Returns on Q (clean stop requested)."""
    while True:
        say()
        say('  [1] Open the game in your browser')
        say('  [2] Status')
        say('  [3] Check for updates')
        say('  [Q] Stop the server and quit')
        say()
        c = read_choice('  Choose: ')
        if c == '1':
            open_game()
        elif c == '2':
            show_status()
        elif c == '3':
            menu_check_updates()
        elif c in ('q', 'quit', 'exit'):
            return


def serve_forever_quietly():
    while True:
        time.sleep(3600)


def child_main(args):
    global PORT
    PORT = args.port
    interactive = sys.stdin is not None and sys.stdin.isatty()
    try:
        if interactive and not args.start:
            try:
                start_menu()
            except EOFError:
                pass
            start_serving(not args.no_browser)
        else:
            start_serving(not args.no_browser)
        if interactive:
            try:
                running_menu()
            except EOFError:
                say('Input closed; the server keeps running. Press Ctrl+C to stop.')
                serve_forever_quietly()
        else:
            serve_forever_quietly()
    except KeyboardInterrupt:
        pass
    say('Stopping.')
    stop_server()
    return 0


def supervise():
    """Run this script as a child process; restart it whenever it exits with 42."""
    base = sys.argv[1:]
    argv = list(base)
    env = dict(os.environ)
    env['CT_LAN_CHILD'] = '1'
    exe = sys.executable or 'python'
    while True:
        try:
            p = subprocess.Popen([exe, os.path.abspath(__file__)] + argv, env=env)
        except OSError as e:
            say('Could not start the server: %s' % e)
            return 1
        while True:
            try:
                code = p.wait()
                break
            except KeyboardInterrupt:
                continue        # the child handles Ctrl+C itself
        if code != RESTART_CODE:
            return code
        argv = list(base)
        for flag in ('--start', '--no-browser'):
            if flag not in argv:
                argv.append(flag)
        env['CT_LAN_RESTARTED'] = '1'


def main():
    if not os.environ.get('CT_LAN_CHILD'):
        sys.exit(supervise())
    ap = argparse.ArgumentParser(description='Commander Table LAN server')
    ap.add_argument('--port', type=int, default=8790)
    ap.add_argument('--no-browser', action='store_true')
    ap.add_argument('--start', action='store_true', help='skip the start menu and serve immediately')
    args = ap.parse_args()
    sys.exit(child_main(args))


if __name__ == '__main__':
    main()
