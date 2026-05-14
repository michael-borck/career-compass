import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import { useSessionStore } from '@/lib/session-store';
import LoadingDots from '@/components/ui/loadingdots';
import PortfolioPreview from '@/components/portfolio/PortfolioPreview';
import { generatePortfolio } from '../services/portfolio';
import { extractTextFromFile } from '../services/file-upload';
import { isConfigured as isLLMConfigured } from '../services/llm';

export default function Portfolio() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const portfolio = store.portfolio;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const canRun = hasResume || hasFreeText || !!store.distilledProfile;

  async function runPortfolio() {
    if (!canRun) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const state = useSessionStore.getState();
      const { portfolio: result, trimmed } = await generatePortfolio({
        resume: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
      useSessionStore.getState().setPortfolio(result);
      if (trimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Portfolio generation failed');
    } finally {
      setLoading(false);
    }
  }

  // Auto-run when the user arrives with profile signal already in the session
  // store but no portfolio yet. Cold landing falls through to the input card.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasP = !!(state.resumeText || state.freeText?.trim() || state.distilledProfile);
    if (!hasP || state.portfolio) return;

    runPortfolio();
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

  function handleGenerateAnother() {
    if (!portfolio) return;
    if (!confirm('Generate another? The current portfolio will be cleared.')) return;
    store.setPortfolio(null);
    autoRanRef.current = false;
  }

  function handleSaveHtml() {
    if (!portfolio) return;
    const slug = portfolio.target
      ? portfolio.target.replace(/\s+/g, '-').toLowerCase()
      : 'personal';
    const blob = new Blob([portfolio.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Portfolio saved as HTML');
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
            {portfolio && (
              <>
                <Button variant='outline' onClick={handleSaveHtml}>
                  Save as HTML
                </Button>
                <Button variant='outline' onClick={handleGenerateAnother}>
                  Generate another
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
            <p className='text-ink-muted'>Generating your portfolio page…</p>
          </div>
        )}
        {!loading && !portfolio && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Portfolio page</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                Your personal portfolio
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                The more profile detail you provide, the richer the page. Add a target role to tailor it for a specific career.
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
                    Job title <span className='normal-case tracking-normal font-normal text-ink-muted'>(optional)</span>
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
                    Job advert <span className='normal-case tracking-normal font-normal text-ink-muted'>(optional)</span>
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
                  <Button onClick={runPortfolio} disabled={!canRun || loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Generating…</>
                    ) : (
                      <><Globe className='w-4 h-4 mr-2' /> Generate portfolio page</>
                    )}
                  </Button>
                </div>

                {!canRun && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    Add a resume or write something in About you.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && portfolio && <PortfolioPreview portfolio={portfolio} />}
      </div>
      <Toaster />
    </div>
  );
}
