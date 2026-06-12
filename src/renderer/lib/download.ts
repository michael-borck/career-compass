/**
 * Triggers a browser download for a Blob. No-op in environments without
 * `document` (e.g. tests without jsdom).
 */
export function downloadBlob(filename: string, blob: Blob): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Triggers a browser download for a JSON string. */
export function downloadJsonFile(filename: string, json: string): void {
  downloadBlob(filename, new Blob([json], { type: 'application/json' }));
}
