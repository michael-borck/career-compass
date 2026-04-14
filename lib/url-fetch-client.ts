import toast from 'react-hot-toast';
import { useSessionStore } from './session-store';

/**
 * If the session store has a urlInput that hasn't been fetched yet
 * (urlFetchedTitle is null), fire /api/fetchUrl, populate the target
 * field, and mark the fetch as complete. Idempotent — returns quickly
 * if no URL is pending.
 *
 * Returns true on success (or if nothing needed fetching).
 * Returns false if a fetch was attempted and failed — caller should
 * typically abort the action it was about to run.
 */
export async function ensureUrlFetched(): Promise<boolean> {
  const state = useSessionStore.getState();
  const urlInput = state.urlInput?.trim();
  if (!urlInput) return true; // nothing to do
  if (state.urlFetchedTitle) return true; // already fetched

  try {
    const res = await fetch('/api/fetchUrl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not fetch that URL');
    }
    const { text, fetchedTitle, classifiedAs } = (await res.json()) as {
      text: string;
      fetchedTitle: string;
      classifiedAs: 'jobAdvert' | 'freeText' | 'unknown';
    };

    // Unknown defaults to jobAdvert (target-focused actions benefit from it)
    const target: 'jobAdvert' | 'freeText' =
      classifiedAs === 'freeText' ? 'freeText' : 'jobAdvert';

    if (target === 'jobAdvert') {
      state.setJobAdvert(text);
    } else {
      state.setFreeText(text);
    }
    state.setUrlFetchedTitle(fetchedTitle);
    return true;
  } catch (err) {
    console.error('[ensureUrlFetched]', err);
    toast.error(err instanceof Error ? err.message : 'Could not fetch URL');
    return false;
  }
}
