/**
 * Returns true only if the entire trimmed input is a single http(s) URL.
 * Used to detect whether a paste into a text field is a URL that should
 * offer to be fetched.
 */
export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Quick rejection: must start with http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) return false;
  // Must not contain whitespace (disqualifies "hello https://x.com world")
  if (/\s/.test(trimmed)) return false;
  // Must parse as a URL and have a non-empty hostname with a dot
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    // hostname must have a dot and not start with one (e.g. ".com" is invalid)
    if (!url.hostname || !url.hostname.includes('.')) return false;
    if (url.hostname.startsWith('.')) return false;
    return true;
  } catch {
    return false;
  }
}
