// Phase 4.16 — heartbeat-based liveness for claude -p subprocess.
//
// Mocks child_process.spawn so we can drive the fake subprocess's stdout /
// stderr / close events on demand and use jest fake timers to walk the
// clock forward without 200-second wall-clock waits.

const { EventEmitter } = require('events');

// Build a fake subprocess that pretends to be a spawned child. The
// production code does:
//   const child = spawn(...);
//   child.stdin.write(prompt); child.stdin.end();
//   child.stdout.on('data', ...); child.stderr.on('data', ...);
//   child.on('close', ...); child.on('error', ...); child.kill('SIGTERM');
function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: jest.fn(), end: jest.fn() };
  child.kill = jest.fn();
  return child;
}

// Phase 4.16.2: claude -p is now invoked with --output-format stream-json
// so each stdout flush is a JSON event. Helpers to emit the kinds of
// events the production code parses.
function emitAssistantText(child, text) {
  const event = {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  };
  child.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
}
function emitResultEvent(child, text) {
  const event = { type: 'result', subtype: 'success', is_error: false, result: text };
  child.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
}
function emitRawChunk(child, raw) {
  // Used when a test wants to drive raw bytes (e.g. partial line buffering)
  // rather than a well-formed event.
  child.stdout.emit('data', Buffer.from(raw));
}

// jest.mock() is hoisted above any const declaration, so we can't capture
// a closure variable. Use jest.fn() returned by requireMock instead — the
// mock module exposes spawn as a jest.fn() that tests can mockReturnValueOnce.
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn: spawnMock } = require('child_process');

// Require the controller AFTER the mock is set up.
const { __testing } = require('../../controllers/aiController');
const {
  runClaudeSubprocess,
  IDLE_TIMEOUT_MS,
  IDLE_CHECK_INTERVAL_MS,
  HARD_CAP_MS,
  SIGTERM_TO_SIGKILL_MS,
} = __testing;

describe('Phase 4.16 — runClaudeSubprocess heartbeat liveness', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exposes the timeout constants (Phase 4.16.1: idle bumped 30s → 120s)', () => {
    expect(IDLE_TIMEOUT_MS).toBe(120_000);
    expect(IDLE_CHECK_INTERVAL_MS).toBe(5_000);
    expect(HARD_CAP_MS).toBe(900_000);
    expect(SIGTERM_TO_SIGKILL_MS).toBe(3_000);
  });

  it('200-second turn that keeps emitting stdout every 10s does NOT time out', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const onProgress = jest.fn();
    const promise = runClaudeSubprocess('sys', 'user', null, { onProgress });

    // Tick: emit an assistant text event every 10s for 200s. Each event
    // resets the idle clock; with IDLE_TIMEOUT_MS=120s a 10s cadence is
    // comfortably under threshold.
    for (let i = 0; i < 20; i++) {
      emitAssistantText(child, `tick ${i}\n`);
      await Promise.resolve();
      jest.advanceTimersByTime(10_000);
    }
    // Final result event with the full text.
    emitResultEvent(child, Array.from({ length: 20 }, (_, i) => `tick ${i}`).join('\n'));
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.text).toContain('tick 0');
    expect(result.text).toContain('tick 19');
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(20);
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('kills subprocess after stdout goes silent past IDLE_TIMEOUT_MS', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);

    // One initial chunk to confirm the subprocess started.
    emitAssistantText(child, 'starting\n');
    await Promise.resolve();

    // Advance 125s (5s past the 120s idle threshold) without any further
    // stdout. The idle watchdog samples every 5s, so worst case the kill
    // fires at 125s. (Phase 4.16.1: was 30s + 5s buffer pre-bump.)
    jest.advanceTimersByTime(125_000);

    // The watchdog should have called kill('SIGTERM').
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    // The follow-up SIGKILL timer fires 3s later.
    jest.advanceTimersByTime(SIGTERM_TO_SIGKILL_MS + 100);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');

    // After kill, the production code resolves with subprocess_idle_timeout.
    // (The fake child never actually emits 'close' here; we rely on
    // runClaudeSubprocess's internal finish() being called by the watchdog.)
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/idle_timeout/);
  });

  // Phase 4.16.1: explicit boundary coverage on the new 120s threshold.

  it('Phase 4.16.1: 90s of silence then a stdout resume does NOT kill', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);

    // Subprocess starts.
    emitAssistantText(child, 'start\n');
    await Promise.resolve();

    // 90 seconds of silence — below the 120s threshold. Watchdog samples
    // every 5s, sees idleMs=90_000 < 120_000, does nothing.
    jest.advanceTimersByTime(90_000);
    expect(child.kill).not.toHaveBeenCalled();

    // Subprocess resumes emitting — idle clock resets.
    emitAssistantText(child, 'resumed\n');
    await Promise.resolve();

    // Another 90s of silence after the resume — still below threshold.
    jest.advanceTimersByTime(90_000);
    expect(child.kill).not.toHaveBeenCalled();

    // Close cleanly.
    child.emit('close', 0);
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.text).toContain('resumed');
  });

  it('Phase 4.16.1: 130s of silence kills (just past the 120s threshold)', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);

    emitAssistantText(child, 'start\n');
    await Promise.resolve();

    // 130s of silence — 10s past the threshold. Worst-case watchdog kill
    // latency is 120s + 5s poll = 125s, so by 130s the kill has fired.
    jest.advanceTimersByTime(130_000);

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/idle_timeout/);
  });

  it('stdout chunks reset the idle clock — subprocess stays alive past 30s when active', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);

    // Emit a chunk every 20s for 100s (5 chunks). Each resets the idle
    // clock to 0; 20s < IDLE_TIMEOUT_MS so the watchdog should never fire.
    for (let i = 0; i < 5; i++) {
      emitAssistantText(child, `progress ${i}\n`);
      await Promise.resolve();
      jest.advanceTimersByTime(20_000);
    }
    emitResultEvent(child, 'final');
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('hard cap kills subprocess at HARD_CAP_MS even when stdout keeps flowing', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);

    // Emit a chunk every 5s — never lets the idle watchdog fire. But after
    // HARD_CAP_MS (900s) the absolute ceiling should kick in.
    const chunks = Math.ceil(HARD_CAP_MS / 5_000) + 2;
    for (let i = 0; i < chunks; i++) {
      emitAssistantText(child, `chunk ${i}\n`);
      await Promise.resolve();
      jest.advanceTimersByTime(5_000);
      if (child.kill.mock.calls.length > 0) break;
    }
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/hard_cap_timeout/);
  });

  it('AbortSignal-triggered abort kills subprocess', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const ac = new AbortController();
    const promise = runClaudeSubprocess('sys', 'user', null, { signal: ac.signal });

    // One chunk to confirm subprocess is alive.
    emitAssistantText(child, 'alive\n');
    await Promise.resolve();

    ac.abort();
    await Promise.resolve();

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toBe('aborted_by_caller');
  });

  it('already-aborted signal kills subprocess immediately', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const ac = new AbortController();
    ac.abort();  // pre-aborted

    const result = await runClaudeSubprocess('sys', 'user', null, { signal: ac.signal });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('aborted_by_caller');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('onProgress callback throwing does not kill the subprocess', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const onProgress = jest.fn(() => { throw new Error('callback boom'); });
    const promise = runClaudeSubprocess('sys', 'user', null, { onProgress });

    emitAssistantText(child, 'hello');
    await Promise.resolve();
    emitResultEvent(child, 'hello');
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.text).toBe('hello');
    expect(onProgress).toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('nonzero exit with empty stdout returns ok:false + stderr text', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);
    child.stderr.emit('data', Buffer.from('boom: missing flag\n'));
    child.emit('close', 1);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/boom: missing flag/);
  });

  // Phase 4.16.2: stream-json parsing.

  it('parses stream-json: result event provides final text', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);
    emitAssistantText(child, 'partial response');
    emitResultEvent(child, 'final canonical response');
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    // 'result' event takes precedence over accumulated assistant text
    expect(result.text).toBe('final canonical response');
  });

  it('parses stream-json: falls back to accumulated assistant text when result event missing', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);
    emitAssistantText(child, 'piece one ');
    emitAssistantText(child, 'piece two');
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.text).toBe('piece one piece two');
  });

  it('parses stream-json: handles a chunk split across stdout reads', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);
    const fullEvent = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'split across reads' }) + '\n';
    const mid = Math.floor(fullEvent.length / 2);
    emitRawChunk(child, fullEvent.slice(0, mid));
    await Promise.resolve();
    emitRawChunk(child, fullEvent.slice(mid));
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.text).toBe('split across reads');
  });

  it('parses stream-json: skips non-JSON lines without failing the turn', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);
    emitRawChunk(child, 'this is not json\n');
    emitResultEvent(child, 'response anyway');
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.text).toBe('response anyway');
  });

  it('parses stream-json: result.is_error=true surfaces as ok:false', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);
    const errEvent = { type: 'result', subtype: 'error', is_error: true, result: '' };
    child.stdout.emit('data', Buffer.from(JSON.stringify(errEvent) + '\n'));
    child.emit('close', 0);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/claude result error/);
  });

  it('spawn error event is caught and surfaced', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const promise = runClaudeSubprocess('sys', 'user', null);
    child.emit('error', new Error('ENOENT: claude not found'));

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ENOENT/);
  });
});
