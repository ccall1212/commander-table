/* Room vault integration checks against a local Miniflare Durable Object.

   Install Miniflare outside the project and run:
     npm install --prefix /tmp/ct-vault-runtime --no-audit --no-fund miniflare@4
     NODE_PATH=/tmp/ct-vault-runtime/node_modules node tests/test_room_vault.cjs

   This test never connects to or deploys a Cloudflare Worker.
*/
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Miniflare } = require('miniflare');

const ROOT = path.resolve(__dirname, '..');
const WORKER = path.join(ROOT, 'relay', 'worker.js');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-room-vault-'));
const ORIGIN = 'http://localhost:8000';

function makeMiniflare() {
  return new Miniflare({
    modules: true,
    scriptPath: WORKER,
    compatibilityDate: '2025-09-01',
    durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
    durableObjectsPersist: STATE,
  });
}

class ClientSocket {
  constructor(ws) {
    this.ws = ws;
    this.messages = [];
    this.waiters = [];
    ws.addEventListener('message', ev => {
      let value;
      try { value = JSON.parse(ev.data); } catch (_) { value = ev.data; }
      const at = this.waiters.findIndex(w => w.match(value));
      if (at >= 0) this.waiters.splice(at, 1)[0].resolve(value);
      else this.messages.push(value);
    });
  }

  send(value) { this.ws.send(JSON.stringify(value)); }

  waitFor(match, timeout = 5000) {
    const at = this.messages.findIndex(match);
    if (at >= 0) return Promise.resolve(this.messages.splice(at, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { match, resolve: value => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w !== waiter);
        reject(new Error('timed out waiting for relay message'));
      }, timeout);
      this.waiters.push(waiter);
    });
  }

  async register(id, key) {
    const opened = this.waitFor(m => m && m.op === 'open');
    this.send({ op: 'reg', id, key });
    await opened;
  }

  async vault(rid, action, fields = {}) {
    const reply = this.waitFor(m => m && m.op === 'vault' && m.rid === rid);
    this.send({ op: 'vault', rid, action, ...fields });
    return reply;
  }

  close() { try { this.ws.close(1000, 'test done'); } catch (_) {} }
}

async function connect(mf, room = 'ABCDE') {
  const response = await mf.dispatchFetch(`http://localhost/room/${room}`, {
    headers: { Upgrade: 'websocket', Origin: ORIGIN },
  });
  assert.equal(response.status, 101, 'room socket upgrades');
  const ws = response.webSocket;
  ws.accept();
  const client = new ClientSocket(ws);
  const hello = await client.waitFor(m => m && m.op === 'hello');
  assert.equal(hello.v, 2, 'vault is an additive v2 feature');
  assert.ok(hello.features.includes('room-vault-v1'));
  return client;
}

async function expectError(client, rid, action, fields, error) {
  const reply = await client.vault(rid, action, fields);
  assert.equal(reply.ok, false, `${action} should fail`);
  assert.equal(reply.error, error);
  return reply;
}

async function run() {
  let mf = makeMiniflare();
  try {
    const host = await connect(mf);
    await host.register('ctable-v1-abcde', 'host-secret-a');

    const guest = await connect(mf);
    await guest.register('guestseat', 'guest-key');
    await expectError(guest, 'g1', 'list', {}, 'unauthorized');
    await expectError(guest, 'g2', 'clear', {}, 'unauthorized');

    const anonymous = await connect(mf);
    await expectError(anonymous, 'anon1', 'list', {}, 'unauthorized');
    await anonymous.register('not-the-host', 'guest-key-2');
    await expectError(anonymous, 'anon2', 'put', { pid: 'seat-1', data: { me: {}, deck: {} } }, 'unauthorized');

    const malformed = await expectError(host, 'bad1', 'put', { pid: 'seat-1', data: { me: {} } }, 'bad-data');
    assert.equal(malformed.error, 'bad-data');
    await expectError(host, 'bad2', 'put', { pid: '../seat', data: { me: {}, deck: {} } }, 'bad-pid');

    const largeUtf8 = '🧙🏻‍♀️秘密カード/'.repeat(12000);
    const original = {
      me: { pid: 'seat-1', name: '玩家 🔮', zones: { hand: [{ iid: 'seat-1_c1', privateText: largeUtf8 }] } },
      deck: { name: '秘密的套牌', cards: [{ id: 'alpha', qty: 100 }] },
    };
    const put = await host.vault('put1', 'put', { pid: 'seat-1', data: original });
    assert.equal(put.ok, true);
    assert.ok(put.result.bytes > 60 * 1024, 'payload crosses the 64 KiB storage chunk boundary');

    const source = await connect(mf);
    await source.register('seat-1', 'source-seat-key');
    source.close(); // the source browser/socket can disappear; the host vault retains its full backup

    const listed = await host.vault('list1', 'list');
    assert.deepEqual(listed.result.map(x => x.pid), ['seat-1']);
    assert.equal(JSON.stringify(listed).includes(largeUtf8), false, 'list contains metadata only');
    const got = await host.vault('get1', 'get', { pid: 'seat-1' });
    assert.equal(got.ok, true);
    assert.deepEqual(got.result.data, original, 'chunked UTF-8 survives retrieval after source disconnect');
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(guest.messages.some(m => JSON.stringify(m).includes(largeUtf8)), false,
      'private retrieval is only returned on the requesting host socket');

    const replacement1 = { me: { pid: 'seat-1', name: 'first update' }, deck: { cards: [] } };
    const replacement2 = { me: { pid: 'seat-1', name: 'last update' }, deck: { cards: [] } };
    const concurrent = await Promise.all([
      host.vault('put2', 'put', { pid: 'seat-1', data: replacement1 }),
      host.vault('put3', 'put', { pid: 'seat-1', data: replacement2 }),
    ]);
    assert.ok(concurrent.every(x => x.ok), 'overlapping writes are serialized and acknowledged');
    assert.deepEqual((await host.vault('get2', 'get', { pid: 'seat-1' })).result.data, replacement2,
      'the later message is the committed revision');

    const tooLarge = { me: { blob: 'x'.repeat(900001) }, deck: { cards: [] } };
    await expectError(host, 'huge1', 'put', { pid: 'seat-1', data: tooLarge }, 'too-large');

    const deleted = await host.vault('delete1', 'delete', { pid: 'seat-1' });
    assert.equal(deleted.ok, true);
    assert.equal(deleted.result.deleted, true);
    await expectError(host, 'after-delete', 'get', { pid: 'seat-1' }, 'not-found');
    // Delete releases payload bytes but preserves the host binding until TTL, preventing a
    // different host key from claiming this public seat ID in the same room.
    const hostId = 'ctable-v1-abcde';
    host.close();
    await new Promise(resolve => setTimeout(resolve, 10));
    const impostor = await connect(mf);
    await impostor.register(hostId, 'different-host-key');
    await expectError(impostor, 'wrong-host', 'put', { pid: 'seat-1', data: replacement1 }, 'unauthorized');
    await expectError(impostor, 'wrong-get', 'get', { pid: 'seat-1' }, 'unauthorized');
    await expectError(impostor, 'wrong-delete', 'delete', { pid: 'seat-1' }, 'unauthorized');
    await expectError(impostor, 'wrong-list', 'list', {}, 'unauthorized');
    await expectError(impostor, 'wrong-clear', 'clear', {}, 'unauthorized');
    await expectError(impostor, 'wrong-fresh-pid', 'put', { pid: 'fresh-seat', data: replacement1 }, 'unauthorized');
    impostor.close();
    await new Promise(resolve => setTimeout(resolve, 10));

    const returningHost = await connect(mf);
    await returningHost.register(hostId, 'host-secret-a');
    const putAgain = await returningHost.vault('put4', 'put', { pid: 'seat-1', data: replacement1 });
    assert.equal(putAgain.ok, true, 'the original host key can resume the room vault');
    assert.deepEqual((await returningHost.vault('list2', 'list')).result.map(x => x.pid), ['seat-1'],
      'an attempted fresh-pid claim by another host cannot poison the legitimate owner list');
    assert.deepEqual((await returningHost.vault('get3', 'get', { pid: 'seat-1' })).result.data, replacement1,
      'the legitimate host can still read its prior board');

    const cleared = await returningHost.vault('clear1', 'clear');
    assert.equal(cleared.ok, true);
    assert.equal(cleared.result.cleared, 1);
    await expectError(returningHost, 'after-clear', 'get', { pid: 'seat-1' }, 'not-found');
    await expectError(returningHost, 'bad-action', 'bogus', {}, 'bad-action');

    // Restart the Miniflare worker with the same SQLite persistence root and verify the
    // Durable Object's owner binding survives a new runtime context.
    returningHost.close();
    await new Promise(resolve => setTimeout(resolve, 10));
    await mf.dispose();
    mf = makeMiniflare();
    const afterRestart = await connect(mf);
    await afterRestart.register(hostId, 'host-secret-a');
    const latestAfterRestart = {
      me: { pid: 'seat-1', name: 'latest after restart' },
      deck: { cards: [{ id: 'latest', qty: 1 }] },
      revision: 200,
    };
    const staleDelayedSave = {
      me: { pid: 'seat-1', name: 'delayed old save' },
      deck: { cards: [{ id: 'stale', qty: 1 }] },
      revision: 199,
    };
    const putAfterRestart = await afterRestart.vault('put5', 'put', { pid: 'seat-1', data: latestAfterRestart });
    assert.equal(putAfterRestart.ok, true, 'original host key retains its owner slot after restart');
    assert.equal(putAfterRestart.result.revision, 200);
    // Simulate an old request delayed across the source/host runtime restart. It must not
    // replace the board snapshot saved at the higher revision.
    const delayed = await afterRestart.vault('put6', 'put', { pid: 'seat-1', data: staleDelayedSave });
    assert.equal(delayed.ok, true);
    assert.equal(delayed.result.ignored, true, 'lower revision is acknowledged without committing');
    assert.equal(delayed.result.revision, 200);
    assert.deepEqual((await afterRestart.vault('get-latest', 'get', { pid: 'seat-1' })).result.data, latestAfterRestart,
      'a delayed old put cannot overwrite the latest durable board after restart');

    // Expiry cleanup runs through the same method invoked by Durable Object alarm().
    const namespace = await mf.getDurableObjectNamespace('ROOMS');
    const stub = namespace.get(namespace.idFromName('ABCDE'));
    await stub.expireVault(Date.now() + (25 * 60 * 60 * 1000));
    await expectError(afterRestart, 'expired', 'get', { pid: 'seat-1' }, 'not-found');
    afterRestart.close();
    await new Promise(resolve => setTimeout(resolve, 10));

    const reusedRoom = await connect(mf);
    await reusedRoom.register(hostId, 'new-room-host-key');
    const reused = await reusedRoom.vault('reuse-room', 'put', { pid: 'fresh-seat', data: replacement1 });
    assert.equal(reused.ok, true, 'expiry removes the room-wide binding so a later room incarnation can claim it');
    reusedRoom.close();
    await new Promise(resolve => setTimeout(resolve, 10));
    const oldHost = await connect(mf);
    await oldHost.register(hostId, 'host-secret-a');
    await expectError(oldHost, 'expired-old-host', 'list', {}, 'unauthorized');

    // A guest cannot use a canonical-looking id in the wrong room's DO.
    const wrongRoom = await connect(mf, 'FGHJK');
    await wrongRoom.register(hostId, 'host-secret-a');
    await expectError(wrongRoom, 'wrong-room', 'list', {}, 'unauthorized');

    // Ordinary v2 registration and linked msg forwarding still use the original framing.
    const a = await connect(mf, 'JKLMN');
    const b = await connect(mf, 'JKLMN');
    await a.register('peer-a', 'a-key');
    await b.register('peer-b', 'b-key');
    const inc = b.waitFor(m => m && m.op === 'inc');
    const copen = a.waitFor(m => m && m.op === 'copen');
    a.send({ op: 'conn', cid: 'link-check', to: 'peer-b', meta: null });
    const incoming = await inc, opened = await copen;
    const payload = { op: 'msg', lid: incoming.lid, d: { t: 'legacy-v2', value: 'unchanged' } };
    const forwarded = b.waitFor(m => m && m.op === 'msg');
    a.send({ op: 'msg', lid: opened.lid, d: payload.d });
    assert.deepEqual(await forwarded, payload, 'v2 link messages still forward unchanged');

    [guest, anonymous, source, afterRestart, reusedRoom, oldHost, wrongRoom, a, b].forEach(s => s.close());
    console.log('PASS room vault: host auth, guest denial, chunking/Unicode, durability after source close and worker restart, serialized updates, delete/clear, TTL cleanup, and unchanged protocol v2 links');
  } finally {
    await mf.dispose();
    fs.rmSync(STATE, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
