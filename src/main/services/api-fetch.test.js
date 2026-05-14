// Tests for apiFetch — particularly the timeout path.
//
// Why we don't load real Electron: `electron.net.request` only exists
// inside the Electron main process. Vitest runs under plain Node, so
// we call the inner `_apiFetchWithNet(net, args)` helper with a fake
// `net` whose `request(...)` returns a ClientRequest-shaped
// EventEmitter. This lets us drive the same event flow Electron's net
// would (response/data/end/error/timeout/abort) and assert on
// resolve/reject behavior — including the timeout abort that motivated
// these changes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { _apiFetchWithNet } from './api-fetch.js';

// Builds a fake net + a place to grab the most recent ClientRequest.
function makeFakeNet() {
  const state = { lastRequest: null };
  const net = {
    request: vi.fn(() => {
      const req = new EventEmitter();
      req.headers = {};
      req.setHeader = vi.fn((k, v) => {
        req.headers[k] = v;
      });
      req.setTimeout = vi.fn();
      req.write = vi.fn();
      req.end = vi.fn();
      req.abort = vi.fn(() => {
        // Electron's real abort emits 'abort' on the request. The 'abort'
        // handler in apiFetch checks `settled` so post-timeout aborts are
        // no-ops, matching production.
        process.nextTick(() => req.emit('abort'));
      });
      state.lastRequest = req;
      return req;
    }),
  };
  return { net, state };
}

function fakeResponse({ statusCode = 200, statusMessage = 'OK', headers = {}, body = '' } = {}) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.statusMessage = statusMessage;
  res.headers = headers;
  process.nextTick(() => {
    if (body) res.emit('data', Buffer.from(body, 'utf-8'));
    res.emit('end');
  });
  return res;
}

function tick() {
  return new Promise((r) => setImmediate(r));
}

describe('apiFetch — happy path', () => {
  it('resolves with body, status, headers, and ok=true on 2xx', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/json',
      method: 'GET',
    });
    await tick();
    expect(state.lastRequest).toBeTruthy();
    state.lastRequest.emit(
      'response',
      fakeResponse({ statusCode: 200, statusMessage: 'OK', body: '{"ok":true}' })
    );
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.statusText).toBe('OK');
    expect(res.body).toBe('{"ok":true}');
  });

  it('returns ok=false for non-2xx but still resolves', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/x' });
    await tick();
    state.lastRequest.emit(
      'response',
      fakeResponse({ statusCode: 404, statusMessage: 'Not Found', body: 'nope' })
    );
    const res = await promise;
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    expect(res.body).toBe('nope');
  });
});

describe('apiFetch — timeout via backup Node setTimeout', () => {
  it('rejects with "Request timed out after 50ms" within ~200ms and aborts', async () => {
    const { net, state } = makeFakeNet();
    const start = Date.now();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/hang',
      method: 'GET',
      timeoutMs: 50,
    });
    await expect(promise).rejects.toThrow(/Request timed out after 50ms/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(300);
    expect(state.lastRequest.abort).toHaveBeenCalled();
  });

  it('also responds to the ClientRequest "timeout" event when Electron emits it', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/hang',
      method: 'GET',
      timeoutMs: 5000, // long enough the backup setTimeout won't fire first
    });
    await tick();
    state.lastRequest.emit('timeout');
    await expect(promise).rejects.toThrow(/Request timed out after 5000ms/);
    expect(state.lastRequest.abort).toHaveBeenCalled();
  });
});

describe('apiFetch — no timeout configured', () => {
  it('does not call request.setTimeout when timeoutMs is omitted', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/x' });
    await tick();
    expect(state.lastRequest.setTimeout).not.toHaveBeenCalled();
    state.lastRequest.emit('response', fakeResponse({ body: 'ok' }));
    const res = await promise;
    expect(res.status).toBe(200);
  });

  it('calls request.setTimeout(ms) when timeoutMs is set', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/x',
      timeoutMs: 1234,
    });
    await tick();
    expect(state.lastRequest.setTimeout).toHaveBeenCalledWith(1234);
    state.lastRequest.emit('response', fakeResponse({ body: 'ok' }));
    await promise;
  });

  it('ignores timeoutMs=0 (no timer scheduled)', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/x',
      timeoutMs: 0,
    });
    await tick();
    expect(state.lastRequest.setTimeout).not.toHaveBeenCalled();
    state.lastRequest.emit('response', fakeResponse({ body: 'ok' }));
    await promise;
  });
});

describe('apiFetch — race conditions', () => {
  it('does not double-settle when response arrives after a timeout', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/late',
      timeoutMs: 30,
    });
    await expect(promise).rejects.toThrow(/Request timed out/);
    // Simulate a late response — must be ignored without crashing.
    state.lastRequest.emit(
      'response',
      fakeResponse({ statusCode: 200, body: 'late' })
    );
    await tick();
    // Test passes if no unhandled rejection / double-settle error.
  });

  it('rejects on request "error" event when not yet settled', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/err' });
    await tick();
    state.lastRequest.emit('error', new Error('ECONNRESET'));
    await expect(promise).rejects.toThrow('ECONNRESET');
  });

  it('rejects on a synchronous net.request throw with "Invalid request"', async () => {
    const net = {
      request: vi.fn(() => {
        throw new Error('bad url');
      }),
    };
    await expect(
      _apiFetchWithNet(net, { url: 'http://[::1' })
    ).rejects.toThrow(/Invalid request: bad url/);
  });
});

describe('apiFetch — request wiring', () => {
  it('sets all headers, writes a string body verbatim, and ends the request', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/post',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test': '1' },
      body: '{"hello":"world"}',
    });
    await tick();
    const req = state.lastRequest;
    expect(req.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(req.setHeader).toHaveBeenCalledWith('X-Test', '1');
    expect(req.write).toHaveBeenCalledWith('{"hello":"world"}');
    expect(req.end).toHaveBeenCalled();
    req.emit('response', fakeResponse({ body: '' }));
    await promise;
  });

  it('JSON-stringifies a non-string body', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/post',
      method: 'POST',
      body: { a: 1 },
    });
    await tick();
    expect(state.lastRequest.write).toHaveBeenCalledWith('{"a":1}');
    state.lastRequest.emit('response', fakeResponse({ body: '' }));
    await promise;
  });

  it('does not write or stringify when body is undefined', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, {
      url: 'https://example.com/get',
      method: 'GET',
    });
    await tick();
    expect(state.lastRequest.write).not.toHaveBeenCalled();
    expect(state.lastRequest.end).toHaveBeenCalled();
    state.lastRequest.emit('response', fakeResponse({ body: '' }));
    await promise;
  });
});
