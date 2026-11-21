const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const port = 41000 + Math.floor(Math.random() * 15000);
const serverFile = path.join(__dirname, '..', 'tools', 'agent-mcp', 'server.mjs');
const child = spawn(process.execPath, [serverFile], {
  env: { ...process.env, CT_AGENT_PORT: String(port) },
  stdio: ['pipe', 'pipe', 'pipe']
});
let nextId = 1, stdoutBuffer = '', stderrBuffer = '';
const pending = new Map();

function waitForReady() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MCP server did not start')), 5000);
    const poll = () => {
      if (stderrBuffer.includes('Ready.')) { clearTimeout(timer); resolve(); }
      else if (child.exitCode != null) { clearTimeout(timer); reject(new Error('MCP server exited during startup')); }
      else setTimeout(poll, 20);
    };
    poll();
  });
}

child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderrBuffer += chunk; });
child.stdout.on('data', chunk => {
  stdoutBuffer += chunk;
  let newline;
  while ((newline = stdoutBuffer.indexOf('\n')) >= 0) {
    const line = stdoutBuffer.slice(0, newline); stdoutBuffer = stdoutBuffer.slice(newline + 1);
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); waiter.resolve(message); }
  }
});

function rpc(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 5000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

(async () => {
  try {
    await waitForReady();
    const page = await fetch(`http://127.0.0.1:${port}/index.html?agent=1`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /js\/agent-bridge\.js\?v=/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/js/agent-bridge.js`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/AGENTS.md`)).status, 403);
    assert.equal((await fetch(`http://127.0.0.1:${port}/.git/config`)).status, 403);
    assert.equal((await fetch(`http://127.0.0.1:${port}/tools/agent-mcp/README.md`)).status, 403);

    const init = await rpc('initialize', { protocolVersion: '2025-03-26' });
    assert.equal(init.result.serverInfo.name, 'commander-table-agent');
    const listed = await rpc('tools/list');
    const names = listed.result.tools.map(tool => tool.name);
    assert.deepEqual(names, ['agent_status', 'observe_game', 'send_chat', 'draw_cards', 'move_card', 'tap_card', 'untap_all', 'pass_turn']);
    const noTab = await rpc('tools/call', { name: 'agent_status', arguments: {} });
    assert.equal(noTab.result.isError, true);
    assert.match(noTab.result.content[0].text, /No game tab is connected/);
    console.log('MCP server protocol, tools, and loopback file access passed.');
  } finally {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
