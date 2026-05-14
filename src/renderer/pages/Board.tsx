import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import BoardVoices from '@/components/board/BoardVoices';
import BoardSynthesisPanel from '@/components/board/BoardSynthesisPanel';
import { useSessionStore } from '@/lib/session-store';
import { boardReviewToMarkdown } from '@/lib/markdown-export';
import { boardReviewToDocx } from '@/components/board/board-review-docx';
import { generateBoardReview } from '../services/board';
import { extractTextFromFile } from '../services/file-upload';
import { isConfigured as isLLMConfigured } from '../services/llm';

export default function Board() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const { boardReview } = store;

  const [framing, setFraming] = useState('');
  const [focusRole, setFocusRole] = useState('');
  const [loading, setLoading] = useState(false);

  // Consume any prefill from "Run again" (legacy parity).
  useEffect(() => {
    const prefill = store.consumeBoardPrefill();
    if (prefill) {
      if (prefill.framing) setFraming(prefill.framing);
      if (prefill.focusRole) setFocusRole(prefill.focusRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasProfile = hasResume || hasFreeText || !!store.distilledProfile;

  async function handleResumeSelect(file: File) {
    try {
      const { text, filename } = await extractTextFromFile(file);
      store.setResume(text, filename);
    } catch (err) {
      console.error(err);
      toast.error('Could not read that file. Try a different format.');
    }
  }

  async function runConvene() {
    if (!hasProfile) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const state = useSessionStore.getState();
      const { review, trimmed } = await generateBoardReview({
        framing,
        focusRole: focusRole.trim() || null,
        resume: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
      useSessionStore.getState().setBoardReview(review);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "The board's response wasn't quite right. Try again — sometimes a second attempt works."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    navigate('/');
  }

  function handleRunAgain() {
    if (!boardReview) return;
    if (
      !confirm(
        'Run the board again? The current review will be cleared. Your framing and focus will be kept.'
      )
    ) {
      return;
    }
    store.setBoardPrefill({
      framing: boardReview.framing,
      focusRole: boardReview.focusRole ?? undefined,
    });
    store.setBoardReview(null);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-3xl'>
        {/* Top bar */}
        <div className='flex items-center justify-between mb-6'>
          <Link to='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {boardReview && (
              <>
                <SaveDocxButton
                  getBlob={() => boardReviewToDocx(boardReview)}
                  filename='board-of-advisors.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => boardReviewToMarkdown(boardReview)}
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

        {/* Loading */}
        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Four advisors are reading your profile…</p>
          </div>
        )}

        {/* Input form */}
        {!loading && !boardReview && (
          <div className='border border-border rounded-lg bg-paper p-6'>
            <div className='editorial-rule justify-center mb-2'>
              <span>Board of advisors</span>
            </div>
            <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
              Four perspectives on your profile
            </h2>
            <p className='text-ink-muted text-center max-w-2xl mx-auto mb-6'>
              A recruiter, an HR partner, a hiring manager, and a mentor will each read your profile
              and share what they notice. They won&apos;t always agree. That&apos;s the point.
            </p>

            <div className='space-y-4'>
              <div>
                <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
                  What&apos;s on your mind? (optional)
                </label>
                <Textarea
                  value={framing}
                  rows={4}
                  onChange={(e) => setFraming(e.target.value)}
                  placeholder="e.g. I'm worried my degree feels too academic for industry data roles."
                  disabled={loading}
                />
              </div>

              <div>
                <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
                  A specific role to centre on? (optional)
                </label>
                <Input
                  value={focusRole}
                  onChange={(e) => setFocusRole(e.target.value)}
                  placeholder='Graduate data analyst'
                  disabled={loading}
                />
              </div>

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
                  About you
                </label>
                <Textarea
                  value={store.freeText}
                  rows={3}
                  onChange={(e) => store.setFreeText(e.target.value)}
                  placeholder='A sentence or two about your background, interests, or goals.'
                  disabled={loading}
                />
              </div>

              {!hasProfile && (
                <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                  Needs a profile. Upload a resume or write something in About you.
                </p>
              )}

              <div className='flex justify-center pt-2'>
                <Button onClick={runConvene} disabled={!hasProfile || loading}>
                  {loading ? (
                    <>
                      <LoadingDots color='white' /> Convening…
                    </>
                  ) : (
                    <>
                      <Users className='w-4 h-4 mr-2' />
                      Convene the board
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Result view */}
        {!loading && boardReview && (
          <div>
            <div className='editorial-rule justify-center mb-2'>
              <span>Board review</span>
            </div>
            <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
              Four perspectives on your profile
            </h1>

            {(boardReview.framing.trim() || boardReview.focusRole) && (
              <div className='text-center text-[var(--text-sm)] text-ink-muted mb-8 space-y-1'>
                {boardReview.framing.trim() && (
                  <div>
                    <span className='text-ink-quiet'>Your framing:</span> {boardReview.framing}
                  </div>
                )}
                {boardReview.focusRole && (
                  <div>
                    <span className='text-ink-quiet'>Focus role:</span> {boardReview.focusRole}
                  </div>
                )}
              </div>
            )}

            <BoardVoices voices={boardReview.voices} />
            <BoardSynthesisPanel synthesis={boardReview.synthesis} />
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
