import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { careerStoryToMarkdown } from '@/lib/markdown-export';
import { careerStoryToDocx } from '@/components/career-story/career-story-docx';
import LoadingDots from '@/components/ui/loadingdots';
import CareerStoryResultView from '@/components/career-story/CareerStoryResultView';
import { generateCareerStory } from '../services/careerStory';
import { extractTextFromFile } from '../services/file-upload';
import { useGeneration } from '../hooks/useGeneration';

export default function CareerStory() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const careerStory = store.careerStory;
  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasProfile = hasResume || hasFreeText || !!store.distilledProfile;
  const canRun = hasResume || hasFreeText;

  const { loading, run: runGeneration, resetAutoRun } = useGeneration({
    generate: () => {
      const state = useSessionStore.getState();
      return generateCareerStory({
        resume: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
        careers: state.careers ?? undefined,
        gapAnalysis: state.gapAnalysis ?? undefined,
        learningPath: state.learningPath ?? undefined,
        boardReview: state.boardReview ?? undefined,
        odysseyLives: state.odysseyLives,
        comparison: state.comparison ?? undefined,
        elevatorPitch: state.elevatorPitch ?? undefined,
        coverLetter: state.coverLetter ?? undefined,
        resumeReview: state.resumeReview ?? undefined,
        interviewFeedback: state.interviewFeedback ?? undefined,
        valuesCompass: state.valuesCompass ?? undefined,
      });
    },
    persist: (r) => useSessionStore.getState().setCareerStory(r.story),
    trimmed: (r) => r.trimmed,
    errorFallback: 'Career story generation failed',
    // Auto-run on mount when there's enough profile in session and no story yet.
    autoRun: () => {
      const state = useSessionStore.getState();
      return !!(state.resumeText || state.freeText?.trim() || state.distilledProfile) && !state.careerStory;
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

  function handleBuildAnother() {
    if (!careerStory) return;
    if (!confirm('Build another? The current story will be cleared.')) return;
    store.setCareerStory(null);
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
            {careerStory && (
              <>
                <SaveDocxButton
                  getBlob={() => careerStoryToDocx(careerStory)}
                  filename='my-career-story.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => careerStoryToMarkdown(careerStory)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleBuildAnother}>
                  Build another
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
            <p className='text-ink-muted'>Building your career story…</p>
          </div>
        )}
        {!loading && !careerStory && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Career story</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                Your career story
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                Find the thread connecting your experiences, interests, and goals.
              </p>

              <div className='border-l-2 border-accent p-4 bg-paper-warm mb-6 mt-4'>
                <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
                  This works best when you have explored other features first. The career story
                  draws on everything in your session: your generated careers, gap analysis,
                  Odyssey lives, board review, and more. The more you have done, the richer the
                  story.
                </p>
              </div>

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
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Job title{' '}
                    <span className='normal-case tracking-normal font-normal text-ink-muted'>
                      (optional)
                    </span>
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
                    Job advert{' '}
                    <span className='normal-case tracking-normal font-normal text-ink-muted'>
                      (optional)
                    </span>
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
                  <Button onClick={runGeneration} disabled={!canRun || loading}>
                    {loading ? (
                      <>
                        <LoadingDots color='white' /> Generating…
                      </>
                    ) : (
                      <>
                        <BookOpen className='w-4 h-4 mr-2' /> Build my career story
                      </>
                    )}
                  </Button>
                </div>

                {!canRun && !hasProfile && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    Add a resume or write something in About you.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && careerStory && <CareerStoryResultView story={careerStory} />}
      </div>
      <Toaster />
    </div>
  );
}
