#!/usr/bin/env python3
"""Protocol v2 conformance tests (docs/relay-protocol.md), stdlib only.

  python tests/test_relay_protocol.py --url ws://127.0.0.1:8111/room/TESTX
  python tests/test_relay_protocol.py --url wss://host/room/TESTX

The local example targets the actual Worker started with Miniflare/Wrangler on port 8111.

Exit code 1 if any case fails.
"""
import argparse
import base64
import json
import os
import queue
import socket
import ssl
import struct
import sys
import threading
import time
import traceback
import uuid
from urllib.parse import urlsplit

ORIGIN = 'http://localhost:8000'
CLOSED = object()   # queue sentinel: the socket is gone

TARGET = {'url': None}


# ---------------------------------------------------------------- minimal websocket client

class WS(object):
    def __init__(self, url):
        u = urlsplit(url)
        secure = u.scheme == 'wss'
        host = u.hostname
        port = u.port or (443 if secure else 80)
        path = (u.path or '/') + ('?' + u.query if u.query else '')
        raw = socket.create_connection((host, port), timeout=10)
        if secure:
            raw = ssl.create_default_context().wrap_socket(raw, server_hostname=host)
        self.sock = raw
        key = base64.b64encode(os.urandom(16)).decode('ascii')
        hosthdr = host if (port in (80, 443)) else '%s:%d' % (host, port)
        req = ('GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
               'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\nOrigin: %s\r\n\r\n'
               % (path, hosthdr, key, ORIGIN))
        raw.sendall(req.encode('ascii'))
        buf = b''
        while b'\r\n\r\n' not in buf:
            chunk = raw.recv(4096)
            if not chunk:
                raise IOError('handshake: connection closed')
            buf += chunk
        head, _, rest = buf.partition(b'\r\n\r\n')
        status = head.split(b'\r\n')[0].decode('latin1')
        if ' 101 ' not in status:
            raise IOError('handshake failed: ' + status)
        self.rest = rest
        self.q = queue.Queue()
        self.send_lock = threading.Lock()
        self.closed = False
        raw.settimeout(None)
        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()

    def _read(self, n):
        while len(self.rest) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise EOFError()
            self.rest += chunk
        data, self.rest = self.rest[:n], self.rest[n:]
        return data

    def _reader(self):
        frag = b''
        try:
            while True:
                b1, b2 = self._read(2)
                fin, op = bool(b1 & 0x80), b1 & 0x0F
                n = b2 & 0x7F
                if n == 126:
                    n = struct.unpack('>H', self._read(2))[0]
                elif n == 127:
                    n = struct.unpack('>Q', self._read(8))[0]
                payload = self._read(n) if n else b''
                if op == 0x8:
                    try:
                        self._send(0x8, payload[:2])
                    except Exception:
                        pass
                    break
                if op == 0x9:
                    self._send(0xA, payload)
                    continue
                if op == 0xA:
                    continue
                if op in (0x1, 0x2):
                    frag = payload
                else:
                    frag += payload
                if fin:
                    try:
                        self.q.put(json.loads(frag.decode('utf-8')))
                    except Exception:
                        self.q.put({'op': '?bad-json'})
                    frag = b''
        except Exception:
            pass
        self.closed = True
        self.q.put(CLOSED)

    def _send(self, opcode, payload):
        n = len(payload)
        head = bytearray([0x80 | opcode])
        if n < 126:
            head.append(0x80 | n)
        elif n < 65536:
            head.append(0x80 | 126)
            head += struct.pack('>H', n)
        else:
            head.append(0x80 | 127)
            head += struct.pack('>Q', n)
        mask = os.urandom(4)
        if n:
            k = (mask * (n // 4 + 1))[:n]
            payload = (int.from_bytes(payload, 'big') ^ int.from_bytes(k, 'big')).to_bytes(n, 'big')
        with self.send_lock:
            self.sock.sendall(bytes(head) + mask + payload)

    def send(self, obj):
        self._send(0x1, obj.encode('utf-8') if isinstance(obj, str) else json.dumps(obj).encode('utf-8'))

    def recv(self, timeout=5.0):
        """Next message dict, CLOSED if the socket ended, or None on timeout."""
        try:
            m = self.q.get(timeout=timeout)
        except queue.Empty:
            return None
        if m is CLOSED:
            self.q.put(CLOSED)   # sticky
        return m

    def expect(self, op, timeout=5.0, **fields):
        """Receive until a message with this op (and matching fields); raises if none."""
        end = time.time() + timeout
        seen = []
        while True:
            left = end - time.time()
            m = self.recv(max(left, 0.01)) if left > 0 else None
            if m is None:
                raise AssertionError('timed out waiting for %s %s (saw %s)' % (op, fields, seen))
            if m is CLOSED:
                raise AssertionError('socket closed while waiting for %s %s (saw %s)' % (op, fields, seen))
            if m.get('op') == op and all(m.get(k) == v for k, v in fields.items()):
                return m
            seen.append(m)

    def expect_none(self, timeout=0.6):
        m = self.recv(timeout)
        if m is not None and m is not CLOSED:
            raise AssertionError('unexpected message: %r' % (m,))
        return m

    def wait_closed(self, timeout=5.0):
        end = time.time() + timeout
        while time.time() < end:
            m = self.recv(max(end - time.time(), 0.01))
            if m is CLOSED:
                return True
        return False

    def close(self):
        try:
            if not self.closed:
                self._send(0x8, struct.pack('>H', 1000))
        except Exception:
            pass
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
        try:
            self.sock.close()
        except Exception:
            pass


# ---------------------------------------------------------------- test plumbing

class Ctx(object):
    def __init__(self):
        self.socks = []

    def ws(self, url=None):
        w = WS(url or TARGET['url'])
        self.socks.append(w)
        return w

    def peer(self, pid=None, key=None, url=None):
        """Connect, swallow hello, register; returns (ws, id)."""
        w = self.ws(url)
        w.expect('hello')
        w.send({'op': 'reg', 'id': pid, 'key': key})
        m = w.expect('open')
        return w, m['id']

    def close_all(self):
        for w in self.socks:
            w.close()
        self.socks = []


def uid(prefix='t'):
    return '%s-%s' % (prefix, uuid.uuid4().hex[:10])


CASES = []


def case(fn):
    CASES.append(fn)
    return fn


@case
def hello_received(c):
    w = c.ws()
    m = w.expect('hello')
    assert m.get('v') == 2, m
    assert m.get('server') in ('lan', 'cf-relay'), m
    assert isinstance(m.get('maxMsg'), int) and m['maxMsg'] > 0, m


@case
def ping_pong(c):
    w = c.ws()
    w.expect('hello')
    w.send({'op': 'ping'})
    w.expect('pong')
    # also usable after registration
    w.send({'op': 'reg', 'id': uid(), 'key': None})
    w.expect('open')
    w.send({'op': 'ping'})
    w.expect('pong')


@case
def reg_named_and_null(c):
    name = uid('named')
    w, got = c.peer(name)
    assert got == name, got
    w2, got2 = c.peer(None)
    assert isinstance(got2, str) and got2 and got2 != name, got2


@case
def dup_id_without_key(c):
    name = uid()
    c.peer(name)
    b = c.ws()
    b.expect('hello')
    b.send({'op': 'reg', 'id': name, 'key': None})
    b.expect('err', type='unavailable-id')
    # the socket stays open and may register again
    other = uid()
    b.send({'op': 'reg', 'id': other, 'key': None})
    b.expect('open', id=other)


@case
def dup_id_wrong_key(c):
    name = uid()
    a, _ = c.peer(name, key='key-one')
    b = c.ws()
    b.expect('hello')
    b.send({'op': 'reg', 'id': name, 'key': 'key-two'})
    b.expect('err', type='unavailable-id')
    # holder registered with a key but the newcomer has none
    b.send({'op': 'reg', 'id': name, 'key': None})
    b.expect('err', type='unavailable-id')
    # holder registered without a key, newcomer brings one
    name2 = uid()
    c.peer(name2, key=None)
    b.send({'op': 'reg', 'id': name2, 'key': 'key-two'})
    b.expect('err', type='unavailable-id')
    a.expect_none(0.3)   # the original holder was untouched


@case
def dup_id_same_key_takeover(c):
    name, other = uid('tk'), uid('partner')
    a, _ = c.peer(name, key='secret-key')
    p, _ = c.peer(other)
    p.send({'op': 'conn', 'cid': 'x1', 'to': name, 'meta': None})
    inc = a.expect('inc')
    p.expect('copen', cid='x1')
    lid = inc['lid']
    b = c.ws()
    b.expect('hello')
    b.send({'op': 'reg', 'id': name, 'key': 'secret-key'})
    a.expect('err', type='replaced')
    b.expect('open', id=name)
    p.expect('cclose', lid=lid)
    assert a.wait_closed(5), 'old socket should be closed after takeover'
    # the new socket really owns the id now
    p.send({'op': 'conn', 'cid': 'x2', 'to': name, 'meta': 'again'})
    b.expect('inc', **{'from': other})
    p.expect('copen', cid='x2')


@case
def conn_inc_then_copen(c):
    ida, idb = uid('a'), uid('b')
    a, _ = c.peer(ida)
    b, _ = c.peer(idb)
    meta = {'name': 'Zoë', 'n': [1, 2, 3]}
    a.send({'op': 'conn', 'cid': 'c1', 'to': idb, 'meta': meta})
    copen = a.expect('copen', cid='c1')
    inc = b.expect('inc', timeout=2.0)
    assert inc['from'] == ida, inc
    assert inc['meta'] == meta, inc
    assert inc['lid'] == copen['lid'] and copen['lid'], (inc, copen)


def linked_pair(c):
    ida, idb = uid('a'), uid('b')
    a, _ = c.peer(ida)
    b, _ = c.peer(idb)
    a.send({'op': 'conn', 'cid': 'c1', 'to': idb, 'meta': None})
    lid = a.expect('copen', cid='c1')['lid']
    b.expect('inc', lid=lid)
    return a, b, ida, idb, lid


@case
def msg_both_ways_and_large(c):
    a, b, _, _, lid = linked_pair(c)
    a.send({'op': 'msg', 'lid': lid, 'd': {'hello': 'b', 'n': 1}})
    assert b.expect('msg', lid=lid)['d'] == {'hello': 'b', 'n': 1}
    b.send({'op': 'msg', 'lid': lid, 'd': ['x', None, 2.5]})
    assert a.expect('msg', lid=lid)['d'] == ['x', None, 2.5]
    big = 'x' * (300 * 1024)
    a.send({'op': 'msg', 'lid': lid, 'd': {'blob': big}})
    got = b.expect('msg', lid=lid, timeout=15)
    assert got['d']['blob'] == big, 'large payload corrupted'
    b.send({'op': 'msg', 'lid': lid, 'd': {'blob': big}})
    assert a.expect('msg', lid=lid, timeout=15)['d']['blob'] == big


@case
def msg_from_outsider_ignored(c):
    a, b, _, _, lid = linked_pair(c)
    x, _ = c.peer(uid('x'))
    x.send({'op': 'msg', 'lid': lid, 'd': 'intruder'})
    a.expect_none(0.5)
    b.expect_none(0.2)


@case
def cclose_forwarding(c):
    a, b, _, _, lid = linked_pair(c)
    a.send({'op': 'cclose', 'lid': lid})
    b.expect('cclose', lid=lid)
    # the link is gone: further msgs go nowhere
    b.send({'op': 'msg', 'lid': lid, 'd': 'late'})
    a.expect_none(0.5)


@case
def socket_close_notifies_partner(c):
    a, b, ida, _, lid = linked_pair(c)
    a.close()
    b.expect('cclose', lid=lid)
    # id is released: it can be registered again
    time.sleep(0.2)
    c.peer(ida)


@case
def conn_to_missing_peer(c):
    a, _ = c.peer(uid())
    ghost = uid('ghost')
    a.send({'op': 'conn', 'cid': 'zz', 'to': ghost, 'meta': None})
    m = a.expect('cfail', cid='zz')
    assert m.get('type') == 'peer-unavailable', m


@case
def second_reg_invalid(c):
    a, _ = c.peer(uid())
    a.send({'op': 'reg', 'id': uid(), 'key': None})
    a.expect('err', type='invalid-message')
    a.send({'op': 'ping'})
    a.expect('pong')


@case
def twelve_peer_room(c):
    for i in range(12):
        c.peer(uid('r%d' % i))
    # Cloudflare relay room capacity; older protocol servers may not enforce the cap.
    w = c.ws()
    hello = w.expect('hello')
    w.send({'op': 'reg', 'id': uid('r13'), 'key': None})
    if hello.get('server') == 'cf-relay':
        w.expect('err', type='room-full')
    else:
        w.expect('open')


@case
def unknown_op_ignored(c):
    a, _ = c.peer(uid())
    a.send({'op': 'definitely-not-an-op', 'x': 1})
    a.send('this is not json')
    a.send('[1,2,3]')
    a.send({'noop': True})
    a.send({'op': 'ping'})
    a.expect('pong')
    assert not a.closed


# ---------------------------------------------------------------- runner

def main():
    ap = argparse.ArgumentParser(description='Relay protocol v2 tests')
    ap.add_argument('--url', required=True,
                    help='ws:// or wss:// URL of a relay room (for example, ws://127.0.0.1:8111/room/TESTX)')
    args = ap.parse_args()

    try:
        parsed = urlsplit(args.url)
        if parsed.scheme not in ('ws', 'wss') or not parsed.hostname:
            raise ValueError('expected a ws:// or wss:// URL with a hostname')
    except ValueError as e:
        ap.error('invalid --url: %s' % e)

    TARGET['url'] = args.url
    failures = 0
    print('target: %s' % TARGET['url'])

    for fn in CASES:
        ctx = Ctx()
        name = fn.__name__
        try:
            res = fn(ctx)
            print('PASS  %s%s' % (name, ('  (%s)' % res) if res else ''))
        except Exception as e:
            failures += 1
            msg = str(e) or e.__class__.__name__
            print('FAIL  %s: %s' % (name, msg))
            if not isinstance(e, AssertionError):
                traceback.print_exc()
        finally:
            ctx.close_all()
            time.sleep(0.25)

    total = len(CASES)
    print('\n%d/%d passed' % (total - failures, total))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
