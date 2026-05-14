import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { gapAnalysisToMarkdown } from '@/lib/markdown-export';
import { gapAnalysisToDocx } from '@/components/gap-analysis/gap-analysis-docx';
import LoadingDots from '@/components/ui/loadingdots';
import GapAnalysisView from '@/components/results/GapAnalysisView';
import { generateGapAnalysis } from '../services/gapAnalysis';
import { extractTextFromFile } from '../services/file-upload';
import { isConfigured as isLLMConfigured } from '../services/llm';

export default function GapAnalysis() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const analysis = store.gapAnalysis;
  const sources = useSessionStore((s) => s.gapAnalysisSources) ?? [];
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasJobTitle = !!store.jobTitle.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();
  const hasTarget = hasJobTitle || hasJobAdvert;
  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasProfile = hasResume || hasFreeText || !!store.distilledProfile;
  const canRun = hasTarget && hasProfile;

  async function runGeneration() {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const state = useSessionStore.getState();
      // Read the user's stored search-engine preference so we mirror the
      // legacy flow: any non-disabled engine counts as opt-in for grounding.
      const settings = await window.electronAPI.store.get<{ searchEngine?: string }>(
        'settings',
        {}
      );
      const grounded = (settings?.searchEngine ?? 'duckduckgo') !== 'disabled';

      const { analysis: result, sources: srcList, groundingFailed } =
        await generateGapAnalysis({
          jobAdvert: state.jobAdvert || undefined,
          jobTitle: state.jobTitle || undefined,
          resume: state.resumeText ?? undefined,
          aboutYou: state.freeText || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          skillsMapping: state.skillsMapping ?? undefined,
          grounded,
        });
      useSessionStore.getState().setGapAnalysis(result);
      useSessionStore.getState().setGapAnalysisSources(srcList);
      if (groundingFailed) {
        toast('Web search failed — analysis ran without sources.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
    } finally {
      setLoading(false);
    }
  }

  // Auto-run when the user arrives with target+profile already in the
  // session store but no analysis yet. If they land cold, the input card
  // below handles it.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasT = !!(state.jobTitle?.trim() || state.jobAdvert?.trim());
    const hasP = !!(state.resumeText || state.freeText?.trim() || state.distilledProfile);
    if (!hasT || !hasP || state.gapAnalysis) return;

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

  function handleRunAgain() {
    if (!analysis) return;
    if (!confirm('Run again? The current result will be cleared.')) return;
    store.setGapAnalysis(null);
    autoRanRef.current = false;
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-4xl'>
        {/* Top bar - always visible */}
        <div className='flex items-center justify-between mb-6'>
          <Link to='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {analysis && (
              <>
                <SaveDocxButton
                  getBlob={() => gapAnalysisToDocx(analysis, sources)}
                  filename={`gap-analysis-${analysis.target.replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => gapAnalysisToMarkdown(analysis, sources)}
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
            <p className='text-ink-muted'>Running gap analysis…</p>
          </div>
        )}
        {!loading && !analysis && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Gap analysis</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                What you have vs what you need
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                Needs a target (job title or job advert) and a profile (resume or about you). One of each is enough.
              </p>

              <div className='space-y-4'>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Job title
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
                    Job advert
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

                <div className='flex justify-center pt-2'>
                  <Button onClick={runGeneration} disabled={!canRun || loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Analysing…</>
                    ) : (
                      <><SearchCheck className='w-4 h-4 mr-2' /> Run gap analysis</>
                    )}
                  </Button>
                </div>

                {!canRun && (hasTarget || hasProfile) && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    {!hasTarget ? 'Add a job title or job advert above.' : 'Add a resume or write something in About you.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && analysis && <GapAnalysisView analysis={analysis} />}
      </div>
      <Toaster />
    </div>
  );
}
