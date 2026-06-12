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

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { _apiFetchWithNet, MAX_RESPONSE_BYTES, MAX_REDIRECTS } from './api-fetch.js';

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
      req.followRedirect = vi.fn();
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
    state.lastRequest.emit('response', fakeResponse({ statusCode: 200, body: 'late' }));
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
    await expect(_apiFetchWithNet(net, { url: 'https://example.com/x' })).rejects.toThrow(
      /Invalid request: bad url/
    );
  });
});

describe('apiFetch — URL validation', () => {
  it('rejects an unparseable URL without calling net.request', async () => {
    const { net } = makeFakeNet();
    await expect(_apiFetchWithNet(net, { url: 'http://[::1' })).rejects.toThrow(/Invalid URL/);
    expect(net.request).not.toHaveBeenCalled();
  });

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'ftp://example.com/x'])(
    'rejects %s without calling net.request',
    async (url) => {
      const { net } = makeFakeNet();
      await expect(_apiFetchWithNet(net, { url })).rejects.toThrow(/URL must be http or https/);
      expect(net.request).not.toHaveBeenCalled();
    }
  );

  it('allows http://localhost (Ollama and custom providers)', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'http://localhost:11434/api/tags' });
    await tick();
    state.lastRequest.emit('response', fakeResponse({ body: '{}' }));
    const res = await promise;
    expect(res.ok).toBe(true);
  });
});

describe('apiFetch — redirect limit', () => {
  it('requests with manual redirect mode and follows redirects up to the limit', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/r' });
    await tick();
    expect(net.request).toHaveBeenCalledWith(expect.objectContaining({ redirect: 'manual' }));
    for (let i = 0; i < MAX_REDIRECTS; i++) {
      state.lastRequest.emit('redirect');
    }
    expect(state.lastRequest.followRedirect).toHaveBeenCalledTimes(MAX_REDIRECTS);
    state.lastRequest.emit('response', fakeResponse({ body: 'ok' }));
    const res = await promise;
    expect(res.ok).toBe(true);
  });

  it('aborts and rejects past the redirect limit', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/loop' });
    await tick();
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      state.lastRequest.emit('redirect');
    }
    await expect(promise).rejects.toThrow(/Too many redirects/);
    expect(state.lastRequest.followRedirect).toHaveBeenCalledTimes(MAX_REDIRECTS);
    expect(state.lastRequest.abort).toHaveBeenCalled();
  });
});

describe('apiFetch — response size cap', () => {
  it('aborts and rejects when the response exceeds MAX_RESPONSE_BYTES', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/huge' });
    await tick();
    const res = new EventEmitter();
    res.statusCode = 200;
    res.statusMessage = 'OK';
    res.headers = {};
    state.lastRequest.emit('response', res);
    res.emit('data', Buffer.alloc(MAX_RESPONSE_BYTES));
    res.emit('data', Buffer.alloc(1));
    await expect(promise).rejects.toThrow(/Response exceeded/);
    expect(state.lastRequest.abort).toHaveBeenCalled();
  });

  it('ignores data arriving after the size-cap rejection (no double settle)', async () => {
    const { net, state } = makeFakeNet();
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/huge' });
    await tick();
    const res = new EventEmitter();
    res.statusCode = 200;
    res.statusMessage = 'OK';
    res.headers = {};
    state.lastRequest.emit('response', res);
    res.emit('data', Buffer.alloc(MAX_RESPONSE_BYTES + 1));
    await expect(promise).rejects.toThrow(/Response exceeded/);
    res.emit('data', Buffer.from('late'));
    res.emit('end');
    await tick();
    // Test passes if no unhandled rejection / double-settle error.
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

describe('apiFetch — streaming mode', () => {
  it('delivers 2xx bodies via onChunk and resolves with an empty body', async () => {
    const { net, state } = makeFakeNet();
    const received = [];
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/sse' }, (t) =>
      received.push(t)
    );
    await tick();
    const res = new EventEmitter();
    res.statusCode = 200;
    res.statusMessage = 'OK';
    res.headers = {};
    state.lastRequest.emit('response', res);
    res.emit('data', Buffer.from('data: {"a":1}\n'));
    res.emit('data', Buffer.from('data: {"a":2}\n'));
    res.emit('end');
    const out = await promise;
    expect(received).toEqual(['data: {"a":1}\n', 'data: {"a":2}\n']);
    expect(out.ok).toBe(true);
    expect(out.body).toBe('');
  });

  it('keeps multi-byte UTF-8 sequences intact across chunk boundaries', async () => {
    const { net, state } = makeFakeNet();
    const received = [];
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/sse' }, (t) =>
      received.push(t)
    );
    await tick();
    const res = new EventEmitter();
    res.statusCode = 200;
    res.statusMessage = 'OK';
    res.headers = {};
    state.lastRequest.emit('response', res);
    const emoji = Buffer.from('🎓'); // 4 bytes
    res.emit('data', emoji.subarray(0, 2));
    res.emit('data', emoji.subarray(2));
    res.emit('end');
    await promise;
    expect(received.join('')).toBe('🎓');
  });

  it('buffers non-2xx bodies so the error payload is available', async () => {
    const { net, state } = makeFakeNet();
    const received = [];
    const promise = _apiFetchWithNet(net, { url: 'https://example.com/sse' }, (t) =>
      received.push(t)
    );
    await tick();
    state.lastRequest.emit(
      'response',
      fakeResponse({ statusCode: 429, statusMessage: 'Too Many', body: '{"error":"rate"}' })
    );
    const out = await promise;
    expect(received).toEqual([]);
    expect(out.ok).toBe(false);
    expect(out.body).toBe('{"error":"rate"}');
  });
});
