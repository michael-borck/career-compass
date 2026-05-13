// Renderer-callable HTTP fetch via Electron's net module. Bypasses CORS
// and preflight because main process is Node, not a browser origin.
// Returns the response body as a UTF-8 string (sufficient for JSON APIs);
// extend with binary support only when a caller needs it.

const { net } = require('electron');

function apiFetch({ url, method = 'GET', headers = {}, body }) {
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

    const chunks = [];
    request.on('response', (response) => {
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: response.headers,
          body: buf.toString('utf-8'),
        });
      });
      response.on('error', (err) => reject(err));
    });

    request.on('error', (err) => reject(err));
    request.on('abort', () => reject(new Error('Request aborted')));

    if (body !== undefined && body !== null) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

module.exports = { apiFetch };
