// Shared parsing for Model JSON — the JSON text a provider returns, often
// wrapped in ``` fences and frequently missing fields.
//
// parseModelJson strips the fences and parses; it throws only on invalid JSON,
// never on a missing field. The coercers read fields leniently, substituting a
// default when a field is absent or the wrong type — model output is
// unreliable, so a feature degrades rather than fails.
//
// See CONTEXT.md ("Model JSON", "Coercer"). This replaces the per-builder
// cleanJSON / toString / toStringArray helpers that were copied across
// lib/prompts/*.ts.

// Returns `any` (not `unknown`) as a drop-in for the JSON.parse(cleanJSON(...))
// it replaces: each feature parser narrows the result with its own
// typeof/Array.isArray guards, then reads fields off it directly. Tightening to
// `unknown` would require adding narrowing to all of them — out of scope for the
// cleaner consolidation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseModelJson(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned.trim());
}

export function toString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

export function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
