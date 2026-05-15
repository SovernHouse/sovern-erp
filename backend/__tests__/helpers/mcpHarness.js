// Phase 4.11 — MCP tool smoke-test harness.
//
// Spawns backend/mcp/erpToolServer.js as a subprocess, talks JSON-RPC
// 2.0 over its stdin/stdout (newline-delimited), and exposes
// startMcp() / callTool() / listTools() / stopMcp() for Jest specs.
//
// The MCP server loads its OWN model registry — separate process from
// the Jest test runner. To get tables in its in-memory SQLite, the
// harness sets MCP_FORCE_SYNC=true when spawning, which triggers a
// startup-time sync() inside the subprocess.
//
// Each request gets a unique numeric id; responses are correlated by
// that id. Pending promises live in a map until their id arrives or
// the per-call timeout fires.

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', '..', 'mcp', 'erpToolServer.js');
const STARTUP_TIMEOUT_MS = 8000;
const CALL_TIMEOUT_MS    = 30000; // first tools/call may trigger lazy model load (~4s) in MCP subprocess

async function startMcp({ env = {} } = {}) {
  const child = spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MCP_FORCE_SYNC: 'true',
      // ERP_USER_ID is required by some tools that scope to a user;
      // tests that need it set their own.
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // State
  let buf = '';
  let nextId = 1;
  const pending = new Map(); // id -> { resolve, reject, timer }
  const handle = {
    child,
    stderr: [],
    closed: false,
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(`MCP ${msg.error.code}: ${msg.error.message}`));
        else p.resolve(msg.result);
      }
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    handle.stderr.push(chunk);
  });

  child.on('exit', () => {
    handle.closed = true;
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error('MCP subprocess exited before response'));
    }
    pending.clear();
  });

  function rpc(method, params) {
    if (handle.closed) return Promise.reject(new Error('MCP subprocess is closed'));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP call timed out after ${CALL_TIMEOUT_MS}ms: ${method}`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  // Wait for the subprocess to be ready by polling 'initialize'.
  // The startup-sync may take a second; retry until success or
  // STARTUP_TIMEOUT_MS.
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const result = await Promise.race([
        rpc('initialize', { protocolVersion: '2024-11-05' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('initialize hung')), 1500)),
      ]);
      if (result && result.protocolVersion) break;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 200));
    }
  }
  if (Date.now() >= deadline) {
    child.kill('SIGTERM');
    throw new Error(`MCP harness startup timed out. stderr: ${handle.stderr.join('').slice(-500)}. lastErr: ${lastErr?.message}`);
  }

  handle.rpc = rpc;
  handle.callTool = async (name, args = {}) => {
    const result = await rpc('tools/call', { name, arguments: args });
    if (!result || !Array.isArray(result.content)) return result;
    const first = result.content[0];
    if (first?.type === 'text') {
      try { return JSON.parse(first.text); } catch (_) { return first.text; }
    }
    return first;
  };
  handle.listTools = async () => {
    const result = await rpc('tools/list', {});
    return result.tools || [];
  };
  return handle;
}

async function stopMcp(handle) {
  if (!handle || handle.closed) return;
  handle.child.stdin.end();
  // Give it a beat to flush; then SIGTERM if still alive.
  await new Promise(r => setTimeout(r, 100));
  if (!handle.closed) {
    handle.child.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 100));
  }
}

module.exports = { startMcp, stopMcp };
