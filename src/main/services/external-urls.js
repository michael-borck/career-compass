// Guard for shell.openExternal. Window-open requests originate from
// renderer content — including links inside LLM-generated output — so
// only hand plain web/mail URLs to the OS. Anything else (file://,
// app-registered custom protocols, malformed strings) is dropped.

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeExternalUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return SAFE_PROTOCOLS.has(parsed.protocol);
}

module.exports = { isSafeExternalUrl };
