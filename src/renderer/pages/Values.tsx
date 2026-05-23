import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { valuesCompassToMarkdown } from '@/lib/markdown-export';
import { valuesCompassToDocx } from '@/components/values/values-docx';
import LoadingDots from '@/components/ui/loadingdots';
import ValuesResultView from '@/components/values/ValuesResultView';
import { generateValuesCompass } from '../services/values';
import { extractTextFromFile } from '../services/file-upload';
import { useGeneration } from '../hooks/useGeneration';

export default function Values() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const compass = store.valuesCompass;
  const [valuesSeed, setValuesSeed] = useState('');

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasSeed = !!valuesSeed.trim();
  const hasAnything = hasResume || hasFreeText || !!store.distilledProfile || hasSeed;

  const { loading, run: runGeneration } = useGeneration({
    generate: () => {
      const state = useSessionStore.getState();
      return generateValuesCompass({
        resume: state.resumeText ?? undefined,
        aboutYou: state.freeText || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
        valuesSeed: valuesSeed || undefined,
      });
    },
    persist: (r) => useSessionStore.getState().setValuesCompass(r.compass),
    trimmed: (r) => r.trimmed,
    errorFallback: 'Values compass failed',
  });

  async function handleResumeSelect(file: File) {
    try {
      const { text, filename } = await extractTextFromFile(file);
      store.setResume(text, filename);
    } catch (err) {
      console.error(err);
      toast.error('Could not read that file. Try a different format.');
    }
  }

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    navigate('/');
  }

  function handleRunAgain() {
    store.setValuesCompass(null);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-4xl'>
        {/* Top bar */}
        <div className='flex items-center justify-between mb-6'>
          <Link to='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {compass && (
              <>
                <SaveDocxButton
                  getBlob={() => valuesCompassToDocx(compass)}
                  filename='values-compass.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => valuesCompassToMarkdown(compass)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleRunAgain}>
                  Run again
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Reflecting on your values…</p>
          </div>
        )}
        {!loading && !compass && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Values compass</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                What matters most to you in your work?
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                Identify your core work values — autonomy, impact, stability, creativity, and more.
                Works with just a few words, but richer with a resume or profile.
              </p>

              <div className='space-y-4'>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    What matters to you? <span className='normal-case tracking-normal font-normal'>(optional)</span>
                  </label>
                  <Textarea
                    value={valuesSeed}
                    rows={3}
                    onChange={(e) => setValuesSeed(e.target.value)}
                    placeholder='e.g. "I want work that feels meaningful, not just a pay cheque. I like working with people but need time to focus alone too."'
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Resume <span className='normal-case tracking-normal font-normal'>(optional)</span>
                  </label>
                  <LocalFileUpload
                    onFileSelect={handleResumeSelect}
                    className='w-full flex items-center justify-center'
                  />
                  {store.resumeFilename && (
                    <p className='text-[var(--text-xs)] text-ink-muted mt-1'>
                      Selected: {store.resumeFilename}
                    </p>
                  )}
                </div>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    About you <span className='normal-case tracking-normal font-normal'>(optional)</span>
                  </label>
                  <Textarea
                    value={store.freeText}
                    rows={2}
                    onChange={(e) => store.setFreeText(e.target.value)}
                    placeholder='Your background or interests.'
                    disabled={loading}
                  />
                </div>

                <div className='flex justify-center pt-2'>
                  <Button onClick={runGeneration} disabled={loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Reflecting…</>
                    ) : (
                      <><Heart className='w-4 h-4 mr-2' /> Find my values</>
                    )}
                  </Button>
                </div>

                {!hasAnything && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    Write something above, or just hit the button for a starting point.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && compass && <ValuesResultView compass={compass} />}
      </div>
      <Toaster />
    </div>
  );
}
