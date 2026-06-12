// Save/load a whole session to a portable JSON file — the explicit
// counterpart to the automatic localStorage persistence. Lets a session move
// between machines (home ↔ campus lab) and serves as a manual backup.

import { useSessionStore } from '@/lib/session-store';
import { downloadJsonFile } from '@/lib/download';

export const SESSION_FILE_VERSION = 1;

type SessionFile = {
  app: 'career-compass';
  kind: 'session';
  version: number;
  savedAt: string;
  state: Record<string, unknown>;
};

// One-shot navigation prefills are excluded, mirroring the persist
// middleware's partialize.
const EXCLUDED_KEYS = new Set(['boardPrefill', 'comparePrefill']);

function snapshotState(): Record<string, unknown> {
  const state = useSessionStore.getState() as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'function' || EXCLUDED_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function buildSessionFile(savedAt = new Date().toISOString()): SessionFile {
  return {
    app: 'career-compass',
    kind: 'session',
    version: SESSION_FILE_VERSION,
    savedAt,
    state: snapshotState(),
  };
}

export function saveSessionToFile(): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJsonFile(`career-compass-session-${stamp}.json`, JSON.stringify(buildSessionFile()));
}

// Parses and applies a session file. Throws with a user-safe message on
// anything that isn't a session file; unknown keys are ignored so files from
// newer app versions degrade gracefully.
export function loadSessionFromFile(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const file = parsed as Partial<SessionFile> | null;
  if (
    !file ||
    typeof file !== 'object' ||
    file.app !== 'career-compass' ||
    file.kind !== 'session' ||
    !file.state ||
    typeof file.state !== 'object'
  ) {
    throw new Error('That file is not a Career Compass session.');
  }

  const current = useSessionStore.getState() as unknown as Record<string, unknown>;
  const incoming: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(file.state)) {
    if (!(key in current) || typeof current[key] === 'function' || EXCLUDED_KEYS.has(key)) continue;
    incoming[key] = value;
  }

  // Reset first so anything absent from the file returns to its default,
  // then apply the file's state.
  useSessionStore.getState().reset();
  useSessionStore.setState(incoming);
}
