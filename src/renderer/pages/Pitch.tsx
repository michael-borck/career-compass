import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { pitchToMarkdown } from '@/lib/markdown-export';
import { pitchToDocx } from '@/components/pitch/pitch-docx';
import LoadingDots from '@/components/ui/loadingdots';
import PitchResultView from '@/components/pitch/PitchResultView';
import { generatePitch } from '../services/pitch';
import { extractTextFromFile } from '../services/file-upload';
import { settingsStore } from '@/lib/settings-store';

// Lightweight gating check that mirrors lib/llm-client.ts isLLMConfigured.
// We don't import that module directly — Phase 4 deletes it — but the check
// is two lines and renderer-local.
async function isLLMConfigured(): Promise<boolean> {
  try {
    const saved = await settingsStore.get();
    return !!(saved.model && saved.model.trim());
  } catch {
    return false;
  }
}

export default function Pitch() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const pitch = store.elevatorPitch;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasJobTitle = !!store.jobTitle.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();
  const hasAny =
    hasResume || hasFreeText || hasJobTitle || hasJobAdvert || !!store.distilledProfile;

  async function runGeneration() {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const state = useSessionStore.getState();
      const { pitch: result, trimmed } = await generatePitch({
        resume: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
      useSessionStore.getState().setElevatorPitch(result);
      if (trimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Pitch generation failed');
    } finally {
      setLoading(false);
    }
  }

  // Auto-run when the user arrives from elsewhere with inputs already in the
  // session store but no pitch yet (the canonical "I just generated careers,
  // jump to pitch" flow). If they land cold, the input card below handles it.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasInput =
      !!state.resumeText ||
      !!state.freeText?.trim() ||
      !!state.jobTitle?.trim() ||
      !!state.jobAdvert?.trim() ||
      !!state.distilledProfile;
    if (!hasInput || state.elevatorPitch) return;

    runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleWriteAnother() {
    if (!pitch) return;
    if (!confirm('Write another? The current pitch will be cleared.')) return;
    store.setElevatorPitch(null);
    autoRanRef.current = false;
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
            {pitch && (
              <>
                <SaveDocxButton
                  getBlob={() => pitchToDocx(pitch)}
                  filename={`elevator-pitch-${(pitch.target ?? 'general').replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => pitchToMarkdown(pitch)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleWriteAnother}>
                  Write another
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
            <p className='text-ink-muted'>Writing your elevator pitch…</p>
          </div>
        )}
        {!loading && !pitch && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Elevator Pitch</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                Your story in 30 seconds
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                The more you provide, the more tailored the pitch. A target role makes it specific.
              </p>

              <div className='space-y-4'>
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
                    rows={3}
                    onChange={(e) => store.setFreeText(e.target.value)}
                    placeholder='A sentence or two about your background, interests, or goals.'
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Job title <span className='normal-case tracking-normal font-normal'>(optional)</span>
                  </label>
                  <Input
                    value={store.jobTitle}
                    onChange={(e) => store.setJobTitle(e.target.value)}
                    placeholder='e.g. Data analyst, UX researcher'
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Job advert <span className='normal-case tracking-normal font-normal'>(optional)</span>
                  </label>
                  <Textarea
                    value={store.jobAdvert}
                    rows={3}
                    onChange={(e) => store.setJobAdvert(e.target.value)}
                    placeholder='Paste a job listing or description.'
                    disabled={loading}
                  />
                </div>

                <div className='flex justify-center pt-2'>
                  <Button onClick={runGeneration} disabled={!hasAny || loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Writing…</>
                    ) : (
                      <><Presentation className='w-4 h-4 mr-2' /> Write my pitch</>
                    )}
                  </Button>
                </div>

                {!hasAny && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    Fill in at least one field above to get started.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && pitch && <PitchResultView pitch={pitch} />}
      </div>
      <Toaster />
    </div>
  );
}
