// Renderer-callable HTTP fetch via Electron's net module. Bypasses CORS
// and preflight because main process is Node, not a browser origin.
// Returns the response body as a UTF-8 string (sufficient for JSON APIs);
// extend with binary support only when a caller needs it.
//
// Timeout: when `timeoutMs` is provided, the call rejects with
// "Request timed out after <ms>ms" and the underlying request is
// aborted. Electron's ClientRequest.setTimeout fires the `timeout`
// event after `ms` of inactivity but does NOT abort by itself, so we
// abort explicitly in the handler. A backup Node setTimeout is also
// scheduled to guarantee a hung connection never blocks the renderer
// for longer than `timeoutMs`, regardless of platform quirks. See
// https://www.electronjs.org/docs/latest/api/client-request#requestsettimeoutms-callback
//
// Test seam: `_apiFetchWithNet(net, args)` accepts a net module so the
// unit tests in api-fetch.test.js can supply a fake (Electron's `net`
// only exists inside the Electron runtime, not in a plain Node vitest
// process).

const electron = require('electron');

function _apiFetchWithNet(net, { url, method = 'GET', headers = {}, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = net.request({ method, url });
    } catch (err) {
      reject(new Error(`Invalid request: ${err.message}`));
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value);
    }

    let settled = false;
    let timeoutHandle = null;

    const fireTimeout = () => {
      if (settled) return;
      settled = true;
      try {
        request.abort();
      } catch {
        // already aborted — ignore
      }
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    };

    const clearBackupTimeout = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      // Primary path: ClientRequest.setTimeout (Electron 14+) emits 'timeout'
      // after `ms` of inactivity. It does NOT abort the request — that is
      // our job in the handler.
      request.on('timeout', fireTimeout);
      if (typeof request.setTimeout === 'function') {
        request.setTimeout(timeoutMs);
      }
      // Backup: a plain Node setTimeout in case ClientRequest.setTimeout
      // isn't honored on this Electron build. Cheap insurance.
      timeoutHandle = setTimeout(fireTimeout, timeoutMs);
    }

    const chunks = [];
    request.on('response', (response) => {
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (settled) return;
        settled = true;
        clearBackupTimeout();
        const buf = Buffer.concat(chunks);
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: response.headers,
          body: buf.toString('utf-8'),
        });
      });
      response.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearBackupTimeout();
        reject(err);
      });
    });

    request.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearBackupTimeout();
      reject(err);
    });
    request.on('abort', () => {
      if (settled) return;
      settled = true;
      clearBackupTimeout();
      reject(new Error('Request aborted'));
    });

    if (body !== undefined && body !== null) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

function apiFetch(args) {
  // Inside Electron, `require('electron')` returns the API object with
  // `net`. In a plain Node test process it returns the binary path string;
  // tests should call `_apiFetchWithNet` directly with a fake net.
  return _apiFetchWithNet(electron.net, args);
}

module.exports = { apiFetch, _apiFetchWithNet };
