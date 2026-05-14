import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { resumeReviewToMarkdown } from '@/lib/markdown-export';
import { resumeReviewToDocx } from '@/components/resume-review/resume-review-docx';
import LoadingDots from '@/components/ui/loadingdots';
import ResumeReviewResultView from '@/components/resume-review/ResumeReviewResultView';
import { generateResumeReview } from '../services/resumeReview';
import { extractTextFromFile } from '../services/file-upload';
import { isConfigured as isLLMConfigured } from '../services/llm';

export default function ResumeReview() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const review = store.resumeReview;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasResume = !!store.resumeText;

  async function runReview() {
    if (!hasResume) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const state = useSessionStore.getState();
      const { review: result, trimmed } = await generateResumeReview({
        resume: state.resumeText ?? '',
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
      useSessionStore.getState().setResumeReview(result);
      if (trimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Resume review failed');
    } finally {
      setLoading(false);
    }
  }

  // Auto-run when the user arrives from elsewhere with a resume already in
  // the session store but no review yet. If they land cold, the input card
  // below handles it.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    if (!state.resumeText || state.resumeReview) return;

    runReview();
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

  function handleReviewAgain() {
    if (!review) return;
    if (!confirm('Review again? The current feedback will be cleared.')) return;
    store.setResumeReview(null);
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
            {review && (
              <>
                <SaveDocxButton
                  getBlob={() => resumeReviewToDocx(review)}
                  filename={`resume-review-${(review.target ?? 'general').replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => resumeReviewToMarkdown(review)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleReviewAgain}>
                  Review again
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
            <p className='text-ink-muted'>Reviewing your resume…</p>
          </div>
        )}
        {!loading && !review && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Resume Review</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                Get actionable feedback
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                Upload your resume for feedback. Add a target role for tailored suggestions.
              </p>

              <div className='space-y-4'>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Resume
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
                  <Button onClick={runReview} disabled={!hasResume || loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Reviewing…</>
                    ) : (
                      <><ClipboardCheck className='w-4 h-4 mr-2' /> Review my resume</>
                    )}
                  </Button>
                </div>

                {!hasResume && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    Upload a resume to get started.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && review && <ResumeReviewResultView review={review} />}
      </div>
      <Toaster />
    </div>
  );
}
