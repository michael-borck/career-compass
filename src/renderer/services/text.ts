// Whitespace normalization for extracted text. Mirrors the same helper in
// src/main/services/file-processors.js — needed renderer-side for markdown
// and plain text (which are decoded in the browser, not via IPC) so the
// renderer code path matches the IPC code path.

export function normalizeText(input: string): string {
  return input.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
}
