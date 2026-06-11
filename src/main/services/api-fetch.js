// @ts-check
// Renderer-callable HTTP fetch via Electron's net module. Bypasses CORS
// and preflight because main process is Node, not a browser origin.
// Returns the response body as a UTF-8 string (sufficient for JSON APIs);
// extend with binary support only when a caller needs it.
//
// Timeout: when `timeoutMs` is provided, the call rejects with
// "Request timed out after <ms>ms" and the underlying request is aborted.
// The plain Node setTimeout is the mechanism that actually fires: typing
// this module surfaced that Electron's net.ClientRequest has no setTimeout
// or 'timeout' event (those are Node http API members). The setTimeout
// probe + 'timeout' listener stay as zero-cost defense in case a future
// Electron adds them.
//
// Test seam: `_apiFetchWithNet(net, args)` accepts a net module so the
// unit tests in api-fetch.test.js can supply a fake (Electron's `net`
// only exists inside the Electron runtime, not in a plain Node vitest
// process).

const electron = require('electron');

// Hard ceiling on response body size. Provider APIs return JSON in the
// kilobyte-to-low-megabyte range; anything bigger means a misbehaving or
// hostile endpoint, and buffering it would exhaust main-process memory.
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

// Redirect chains beyond this are a loop or a hostile endpoint; Electron's
// default 'follow' mode would chase them indefinitely.
const MAX_REDIRECTS = 5;

/**
 * @typedef {Object} ApiFetchArgs
 * @property {string} url
 * @property {string} [method]
 * @property {Record<string, string>} [headers]
 * @property {string | object | null} [body]
 * @property {number} [timeoutMs]
 */

/**
 * Electron's ClientRequest plus the Node-style timeout members this code
 * probes for defensively. They are NOT part of Electron's documented net API
 * (typing this surfaced that) — which is why the runtime typeof guard exists
 * and the backup Node timer below is the mechanism that actually fires.
 * @typedef {import('electron').ClientRequest & {
 *   setTimeout?: (ms: number) => void,
 *   on: (event: 'timeout', listener: () => void) => void,
 * }} TimeoutCapableRequest
 */

/**
 * @param {{ request: (options: object) => TimeoutCapableRequest }} net
 * @param {ApiFetchArgs} args
 */
function _apiFetchWithNet(net, { url, method = 'GET', headers = {}, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    // Only plain web schemes. The renderer is trusted code, but this handler
    // is the one place a compromised renderer could reach file:// or other
    // schemes through the main process — fail closed. localhost stays
    // allowed (Ollama, custom providers).
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new Error(`URL must be http or https, got ${parsed.protocol}`));
      return;
    }

    let request;
    try {
      // redirect: 'manual' so each hop goes through the counted handler
      // below instead of being followed without limit.
      request = net.request({ method, url, redirect: 'manual' });
    } catch (err) {
      reject(new Error(`Invalid request: ${err instanceof Error ? err.message : String(err)}`));
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value);
    }

    let settled = false;
    /** @type {NodeJS.Timeout | null} */
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
      // Defensive probe — see the module header: Electron's ClientRequest
      // has neither setTimeout nor a 'timeout' event, so in practice the
      // Node timer below is what fires.
      request.on('timeout', fireTimeout);
      if (typeof request.setTimeout === 'function') {
        request.setTimeout(timeoutMs);
      }
      timeoutHandle = setTimeout(fireTimeout, timeoutMs);
    }

    let redirectCount = 0;
    request.on('redirect', () => {
      if (settled) return;
      redirectCount += 1;
      if (redirectCount > MAX_REDIRECTS) {
        settled = true;
        clearBackupTimeout();
        try {
          request.abort();
        } catch {
          // already aborted — ignore
        }
        reject(new Error(`Too many redirects (limit ${MAX_REDIRECTS})`));
        return;
      }
      request.followRedirect();
    });

    /** @type {Buffer[]} */
    const chunks = [];
    let receivedBytes = 0;
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        if (settled) return;
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_RESPONSE_BYTES) {
          settled = true;
          clearBackupTimeout();
          try {
            request.abort();
          } catch {
            // already aborted — ignore
          }
          reject(new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes`));
          return;
        }
        chunks.push(chunk);
      });
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

/** @param {ApiFetchArgs} args */
function apiFetch(args) {
  // Inside Electron, `require('electron')` returns the API object with
  // `net`. In a plain Node test process it returns the binary path string;
  // tests should call `_apiFetchWithNet` directly with a fake net. The cast
  // widens Electron's Net to the timeout-probing request shape above.
  return _apiFetchWithNet(/** @type {any} */ (electron.net), args);
}

module.exports = { apiFetch, _apiFetchWithNet, MAX_RESPONSE_BYTES, MAX_REDIRECTS };
