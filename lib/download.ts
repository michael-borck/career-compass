/**
 * Triggers a browser download for a JSON string. Used by the Talk Buddy
 * export buttons. No-op in environments without `document` (e.g. SSR).
 */
export function downloadJsonFile(filename: string, json: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
