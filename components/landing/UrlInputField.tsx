'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { X, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSessionStore } from '@/lib/session-store';

export default function UrlInputField() {
  const store = useSessionStore();
  const [url, setUrl] = useState(store.urlInput);
  const [fetching, setFetching] = useState(false);
  const [fetchedInto, setFetchedInto] = useState<'jobAdvert' | 'freeText' | null>(
    store.urlFetchedTitle ? 'jobAdvert' : null
  );
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(
    store.urlFetchedTitle
  );

  async function handleBlur() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (store.urlFetchedTitle) return; // already fetched the current URL

    setFetching(true);
    try {
      const res = await fetch('/api/fetchUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not fetch that URL');
      }
      const { text, fetchedTitle: title, classifiedAs } = (await res.json()) as {
        text: string;
        fetchedTitle: string;
        classifiedAs: 'jobAdvert' | 'freeText' | 'unknown';
      };

      // Unknown defaults to jobAdvert (target-focused)
      const target: 'jobAdvert' | 'freeText' =
        classifiedAs === 'freeText' ? 'freeText' : 'jobAdvert';

      if (target === 'jobAdvert') {
        store.setJobAdvert(text);
      } else {
        store.setFreeText(text);
      }
      store.setUrlInput(trimmed);
      store.setUrlFetchedTitle(title);
      setFetchedInto(target);
      setFetchedTitle(title);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not fetch URL');
    } finally {
      setFetching(false);
    }
  }

  function handleClear() {
    setUrl('');
    setFetchedInto(null);
    setFetchedTitle(null);
    store.setUrlInput('');
    store.setUrlFetchedTitle(null);
  }

  return (
    <div className='w-full'>
      <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
        URL (optional)
      </label>
      <div className='relative'>
        <LinkIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-quiet pointer-events-none' />
        <Input
          value={url}
          onChange={(e) => {
            const newUrl = e.target.value;
            setUrl(newUrl);
            store.setUrlInput(newUrl);
            // Any edit invalidates the prior fetch — re-fetch on next blur or action
            store.setUrlFetchedTitle(null);
            setFetchedInto(null);
            setFetchedTitle(null);
          }}
          onBlur={handleBlur}
          placeholder='Paste a LinkedIn job, portfolio URL, or job posting'
          className='pl-9'
        />
        {fetching && (
          <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-quiet animate-spin' />
        )}
      </div>
      {fetchedTitle && fetchedInto && (
        <div className='mt-1 flex items-center gap-2 text-[var(--text-xs)] text-ink-muted italic'>
          <span>
            Fetched <strong className='not-italic'>{fetchedTitle}</strong> → added to{' '}
            {fetchedInto === 'jobAdvert' ? 'Job advert' : 'About you'}
          </span>
          <button
            type='button'
            onClick={handleClear}
            className='text-ink-quiet hover:text-ink'
            aria-label='Clear fetched URL'
          >
            <X className='w-3 h-3' />
          </button>
        </div>
      )}
    </div>
  );
}
