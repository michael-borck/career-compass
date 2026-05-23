import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { coverLetterToMarkdown } from '@/lib/markdown-export';
import { coverLetterToDocx } from '@/components/cover-letter/cover-letter-docx';
import LoadingDots from '@/components/ui/loadingdots';
import CoverLetterResultView from '@/components/cover-letter/CoverLetterResultView';
import { generateCoverLetter } from '../services/coverLetter';
import { extractTextFromFile } from '../services/file-upload';
import { useGeneration } from '../hooks/useGeneration';

export default function CoverLetter() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const letter = store.coverLetter;
  const hasJobTitle = !!store.jobTitle.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();
  const hasTarget = hasJobTitle || hasJobAdvert;

  const { loading, run: runGeneration, resetAutoRun } = useGeneration({
    generate: () => {
      const state = useSessionStore.getState();
      return generateCoverLetter({
        resume: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
    },
    persist: (r) => useSessionStore.getState().setCoverLetter(r.letter),
    trimmed: (r) => r.trimmed,
    errorFallback: 'Cover letter generation failed',
    // Auto-run when the user arrives with a target already in the store but no
    // cover letter yet. If they land cold, the input card below handles it.
    autoRun: () => {
      const state = useSessionStore.getState();
      return !!(state.jobTitle?.trim() || state.jobAdvert?.trim()) && !state.coverLetter;
    },
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

  function handleDraftAnother() {
    if (!letter) return;
    if (!confirm('Draft another? The current letter will be cleared.')) return;
    store.setCoverLetter(null);
    resetAutoRun();
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
            {letter && (
              <>
                <SaveDocxButton
                  getBlob={() => coverLetterToDocx(letter)}
                  filename={`cover-letter-${(letter.target || 'general').replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => coverLetterToMarkdown(letter)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleDraftAnother}>
                  Draft another
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
            <p className='text-ink-muted'>Drafting your cover letter…</p>
          </div>
        )}
        {!loading && !letter && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Cover Letter</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                A professional letter for the role you want
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                A job title or advert is required so the letter has a target. Add a resume or a few sentences about yourself for a more tailored draft.
              </p>

              <div className='space-y-4'>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Job title <span className='normal-case tracking-normal font-normal'>(or advert below)</span>
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
                    Job advert <span className='normal-case tracking-normal font-normal'>(or title above)</span>
                  </label>
                  <Textarea
                    value={store.jobAdvert}
                    rows={3}
                    onChange={(e) => store.setJobAdvert(e.target.value)}
                    placeholder='Paste a job listing or description.'
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
                    rows={3}
                    onChange={(e) => store.setFreeText(e.target.value)}
                    placeholder='A sentence or two about your background, interests, or goals.'
                    disabled={loading}
                  />
                </div>

                <div className='flex justify-center pt-2'>
                  <Button onClick={runGeneration} disabled={!hasTarget || loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Drafting…</>
                    ) : (
                      <><FileText className='w-4 h-4 mr-2' /> Draft my letter</>
                    )}
                  </Button>
                </div>

                {!hasTarget && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    Fill in a job title or paste a job advert to get started.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && letter && <CoverLetterResultView letter={letter} />}
      </div>
      <Toaster />
    </div>
  );
}
