'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import LocalFileUpload from '@/components/LocalFileUpload';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSessionStore } from '@/lib/session-store';
import { fileToArrayBuffer } from '@/lib/utils';
import { profileToReadableText } from '@/lib/profile-text';
import { looksLikeUrl } from '@/lib/url-detect';

export type MissingHints = {
  resume: boolean;
  jobTitle: boolean;
  aboutYou: boolean;
  jobAdvert: boolean;
  message: string | null;
};

const NO_HINTS: MissingHints = {
  resume: false,
  jobTitle: false,
  aboutYou: false,
  jobAdvert: false,
  message: null,
};

type Props = {
  missingHints: MissingHints;
  onClearHints: () => void;
};

export default function InputsZone({ missingHints, onClearHints }: Props) {
  const store = useSessionStore();
  const [aboutYouEdited, setAboutYouEdited] = useState(false);
  const prefilledRef = useRef(false);

  // Paste-to-fetch state. Per field so Job advert and About you are independent.
  const [pastedUrl, setPastedUrl] = useState<{
    field: 'jobAdvert' | 'freeText';
    url: string;
  } | null>(null);
  const [fetchingFor, setFetchingFor] = useState<'jobAdvert' | 'freeText' | null>(null);
  const [fetchedLabel, setFetchedLabel] = useState<{
    field: 'jobAdvert' | 'freeText';
    domain: string;
    title: string;
  } | null>(null);

  // One-time pre-fill of "About you" from a distilled profile, only if the
  // textarea is currently empty. Never overwrites student input.
  useEffect(() => {
    if (prefilledRef.current) return;
    const state = useSessionStore.getState();
    if (state.distilledProfile && state.freeText.trim() === '') {
      const text = profileToReadableText(state.distilledProfile);
      if (text.trim()) {
        store.setFreeText(text);
        prefilledRef.current = true;
      }
    } else {
      prefilledRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPrefillHint =
    !aboutYouEdited &&
    prefilledRef.current &&
    !!store.distilledProfile &&
    store.freeText.trim() !== '';

  async function handleResumeSelect(file: File) {
    try {
      const ab = await fileToArrayBuffer(file);
      const res = await fetch('/api/parsePdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: Array.from(new Uint8Array(ab)),
          filename: file.name,
        }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const text = await res.json();
      store.setResume(text, file.name);
      onClearHints();
    } catch (err) {
      console.error(err);
      toast.error('Could not parse that file.');
    }
  }

  function fieldClass(highlighted: boolean): string {
    return highlighted
      ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper rounded-lg'
      : '';
  }

  function handlePaste(
    field: 'jobAdvert' | 'freeText',
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) {
    const pasted = e.clipboardData.getData('text');
    if (!looksLikeUrl(pasted)) return; // let it paste normally
    e.preventDefault();
    setPastedUrl({ field, url: pasted.trim() });
  }

  async function handleFetchPastedUrl() {
    if (!pastedUrl) return;
    const { field, url } = pastedUrl;
    setFetchingFor(field);
    setPastedUrl(null);
    try {
      const res = await fetch('/api/fetchUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not fetch that URL');
      }
      const { text, fetchedTitle, domain } = (await res.json()) as {
        text: string;
        fetchedTitle: string;
        domain: string;
        classifiedAs: string;
      };
      if (field === 'jobAdvert') {
        store.setJobAdvert(text);
      } else {
        store.setFreeText(text);
      }
      setFetchedLabel({ field, domain, title: fetchedTitle });
      // Also persist a marker in the store so it survives navigation
      store.setUrlInput(url);
      store.setUrlFetchedTitle(fetchedTitle);
      toast.success('Page content fetched.');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not fetch URL');
    } finally {
      setFetchingFor(null);
    }
  }

  function handleKeepUrlAsText() {
    if (!pastedUrl) return;
    const { field, url } = pastedUrl;
    // Append (or replace if empty) the URL as plain text
    if (field === 'jobAdvert') {
      store.setJobAdvert(store.jobAdvert ? `${store.jobAdvert}\n${url}` : url);
    } else {
      store.setFreeText(store.freeText ? `${store.freeText}\n${url}` : url);
    }
    setPastedUrl(null);
  }

  function handleClearFetchedLabel() {
    setFetchedLabel(null);
  }

  return (
    <div className='w-full max-w-5xl space-y-4'>
      {missingHints.message && (
        <div className='border border-accent/30 bg-accent-soft text-ink rounded-lg px-4 py-3 text-[var(--text-sm)]'>
          {missingHints.message}
        </div>
      )}

      <div className='grid md:grid-cols-2 gap-4'>
        {/* Left column: Resume drop zone (fills the column height) */}
        <div className={`flex flex-col ${fieldClass(missingHints.resume)}`}>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Resume
          </label>
          <div className='flex-1 flex flex-col'>
            <LocalFileUpload
              onFileSelect={handleResumeSelect}
              className='flex-1 flex items-center justify-center'
            />
          </div>
          {store.resumeFilename && (
            <p className='text-[var(--text-xs)] text-ink-muted mt-1'>
              Selected: {store.resumeFilename}
            </p>
          )}
        </div>

        {/* Right column: three stacked inputs */}
        <div className='flex flex-col gap-4'>
          <div className={fieldClass(missingHints.jobTitle)}>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job title
            </label>
            <Input
              placeholder='e.g., Data Analyst'
              value={store.jobTitle}
              onChange={(e) => {
                store.setJobTitle(e.target.value);
                if (e.target.value.trim()) onClearHints();
              }}
            />
          </div>

          <div className={fieldClass(missingHints.aboutYou)}>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              About you
            </label>
            {showPrefillHint && (
              <p className='text-[var(--text-xs)] text-ink-quiet mb-1 italic'>
                Pre-filled from your advisor chat. Edit freely.
              </p>
            )}

            {/* Paste-a-URL confirm banner */}
            {pastedUrl && pastedUrl.field === 'freeText' && (
              <div className='mb-2 border border-accent/30 bg-accent-soft rounded-lg px-3 py-2 text-[var(--text-sm)] text-ink flex items-center gap-2 flex-wrap'>
                <span className='flex-1 min-w-0 truncate'>
                  Looks like a URL. Fetch the page content, or keep it as text?
                </span>
                <button
                  type='button'
                  onClick={handleFetchPastedUrl}
                  className='px-3 py-1 rounded bg-ink text-paper hover:bg-accent text-[var(--text-xs)] font-medium'
                >
                  Fetch page
                </button>
                <button
                  type='button'
                  onClick={handleKeepUrlAsText}
                  className='px-3 py-1 rounded border border-border text-ink hover:bg-paper text-[var(--text-xs)] font-medium'
                >
                  Keep as text
                </button>
              </div>
            )}

            {/* Fetching indicator */}
            {fetchingFor === 'freeText' && (
              <div className='mb-2 text-[var(--text-xs)] text-ink-quiet italic'>
                Fetching page content…
              </div>
            )}

            {/* Fetched-from label */}
            {fetchedLabel?.field === 'freeText' && (
              <div className='mb-1 flex items-center gap-2 text-[var(--text-xs)] text-ink-muted italic'>
                <span>
                  Fetched from <strong className='not-italic'>{fetchedLabel.domain}</strong>
                </span>
                <button
                  type='button'
                  onClick={handleClearFetchedLabel}
                  className='text-ink-quiet hover:text-ink'
                  aria-label='Clear fetched label'
                >
                  ✕
                </button>
              </div>
            )}

            <Textarea
              rows={3}
              placeholder='Background, interests, goals. Paste a URL (e.g. your portfolio) to fetch the page content.'
              value={store.freeText}
              onChange={(e) => {
                store.setFreeText(e.target.value);
                setAboutYouEdited(true);
                if (e.target.value.trim()) onClearHints();
                // clear the fetched label if the student edits the content
                if (fetchedLabel?.field === 'freeText') setFetchedLabel(null);
              }}
              onPaste={(e) => handlePaste('freeText', e)}
            />
          </div>

          <div className={fieldClass(missingHints.jobAdvert)}>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job advert
            </label>

            {/* Paste-a-URL confirm banner */}
            {pastedUrl && pastedUrl.field === 'jobAdvert' && (
              <div className='mb-2 border border-accent/30 bg-accent-soft rounded-lg px-3 py-2 text-[var(--text-sm)] text-ink flex items-center gap-2 flex-wrap'>
                <span className='flex-1 min-w-0 truncate'>
                  Looks like a URL. Fetch the page content, or keep it as text?
                </span>
                <button
                  type='button'
                  onClick={handleFetchPastedUrl}
                  className='px-3 py-1 rounded bg-ink text-paper hover:bg-accent text-[var(--text-xs)] font-medium'
                >
                  Fetch page
                </button>
                <button
                  type='button'
                  onClick={handleKeepUrlAsText}
                  className='px-3 py-1 rounded border border-border text-ink hover:bg-paper text-[var(--text-xs)] font-medium'
                >
                  Keep as text
                </button>
              </div>
            )}

            {/* Fetching indicator */}
            {fetchingFor === 'jobAdvert' && (
              <div className='mb-2 text-[var(--text-xs)] text-ink-quiet italic'>
                Fetching page content…
              </div>
            )}

            {/* Fetched-from label */}
            {fetchedLabel?.field === 'jobAdvert' && (
              <div className='mb-1 flex items-center gap-2 text-[var(--text-xs)] text-ink-muted italic'>
                <span>
                  Fetched from <strong className='not-italic'>{fetchedLabel.domain}</strong>
                </span>
                <button
                  type='button'
                  onClick={handleClearFetchedLabel}
                  className='text-ink-quiet hover:text-ink'
                  aria-label='Clear fetched label'
                >
                  ✕
                </button>
              </div>
            )}

            <Textarea
              rows={4}
              placeholder='Or a few words about the job posting. Paste a URL to fetch the page content.'
              value={store.jobAdvert}
              onChange={(e) => {
                store.setJobAdvert(e.target.value);
                if (e.target.value.trim()) onClearHints();
                // clear the fetched label if the student edits the content
                if (fetchedLabel?.field === 'jobAdvert') setFetchedLabel(null);
              }}
              onPaste={(e) => handlePaste('jobAdvert', e)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { NO_HINTS };
