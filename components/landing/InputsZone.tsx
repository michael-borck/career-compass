'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import LocalFileUpload from '@/components/LocalFileUpload';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSessionStore } from '@/lib/session-store';
import { fileToArrayBuffer } from '@/lib/utils';
import { profileToReadableText } from '@/lib/profile-text';

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
            <Textarea
              rows={3}
              placeholder='A few words about your background, interests, and goals.'
              value={store.freeText}
              onChange={(e) => {
                store.setFreeText(e.target.value);
                setAboutYouEdited(true);
                if (e.target.value.trim()) onClearHints();
              }}
            />
          </div>

          <div className={fieldClass(missingHints.jobAdvert)}>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job advert
            </label>
            <Textarea
              rows={4}
              placeholder='Paste a job posting you want to analyse or work toward.'
              value={store.jobAdvert}
              onChange={(e) => {
                store.setJobAdvert(e.target.value);
                if (e.target.value.trim()) onClearHints();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { NO_HINTS };
