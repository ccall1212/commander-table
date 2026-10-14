#!/usr/bin/env python3
"""Commander Table LAN server.

Serves the game's static files and relays PeerJS-style traffic between browsers
over WebSockets, so the game works on networks where WebRTC is blocked.

Usage:  python lan-server.py [--port 8790] [--no-browser]

Python 3.8+ standard library only.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
import os
import socket
import struct
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_MESSAGE = 8 * 1024 * 1024
PING_EVERY = 15
IDLE_TIMEOUT = 45

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


# ---------------------------------------------------------------- broker


class Client(object):
    """One WebSocket connection."""

    def __init__(self, sock, addr):
        self.sock = sock
        self.addr = addr
        self.send_lock = threading.Lock()
        self.id = None
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
    if op == 'reg':
        want = msg.get('id')
        with broker_lock:
            if c.id is not None:
                reply = {'op': 'err', 'type': 'invalid-message', 'message': 'Already registered'}
            else:
                if want is None or want == '':
                    want = str(uuid.uuid4())
                if not isinstance(want, str):
                    reply = {'op': 'err', 'type': 'invalid-message', 'message': 'Bad id'}
                elif want in peers:
                    reply = {'op': 'err', 'type': 'unavailable-id', 'message': 'ID is taken'}
                else:
                    peers[want] = c
                    c.id = want
                    reply = {'op': 'open', 'id': want}
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


def cleanup(c):
    c.dead = True
    notify = []
    with broker_lock:
        all_clients.discard(c)
        had_id = c.id
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


class Handler(BaseHTTPRequestHandler):
    server_version = 'CommanderTableLAN/1'

    def log_message(self, fmt, *args):
        pass

    def do_HEAD(self):
        self.handle_get(True)

    def do_GET(self):
        self.handle_get(False)

    def send_body(self, code, ctype, body, head_only):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def not_found(self, head_only):
        self.send_body(404, 'text/plain; charset=utf-8', b'Not found', head_only)

    def handle_get(self, head_only):
        try:
            path = unquote(urlsplit(self.path).path)
        except Exception:
            return self.not_found(head_only)

        if path == '/ws' and 'websocket' in self.headers.get('Upgrade', '').lower():
            return self.handle_ws()
        if path == '/js/lan-mode.js':
            body = ('window.CT_LAN = %s;\n' % json.dumps({'port': PORT, 'urls': LAN_URLS})).encode('utf-8')
            return self.send_body(200, 'application/javascript; charset=utf-8', body, head_only)

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


def main():
    global PORT, LAN_URLS
    ap = argparse.ArgumentParser(description='Commander Table LAN server')
    ap.add_argument('--port', type=int, default=8790)
    ap.add_argument('--no-browser', action='store_true')
    args = ap.parse_args()
    PORT = args.port

    try:
        httpd = Server(('0.0.0.0', PORT), Handler)
    except OSError as e:
        say('Port %d is busy — is the server already running? Try --port %d  (%s)' % (PORT, PORT + 1, e))
        sys.exit(1)

    LAN_URLS = lan_urls(PORT)
    say('Commander Table LAN server')
    say('Players on your network open:')
    for u in LAN_URLS:
        say('  ' + u)
    say('Keep this window open while you play. Close it (or press Ctrl+C) to stop.')
    say()

    threading.Thread(target=keepalive_loop, daemon=True).start()
    if not args.no_browser:
        try:
            webbrowser.open('http://localhost:%d/' % PORT)
        except Exception:
            pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        say('Stopping.')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
