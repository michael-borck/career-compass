import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { industryExplorationToMarkdown } from '@/lib/markdown-export';
import { industryExplorationToDocx } from '@/components/industry/industry-docx';
import LoadingDots from '@/components/ui/loadingdots';
import IndustryResultView from '@/components/industry/IndustryResultView';
import { generateIndustryExploration } from '../services/industry';
import { extractTextFromFile } from '../services/file-upload';
import { isConfigured as isLLMConfigured } from '../services/llm';

export default function Industry() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const exploration = store.industryExploration;
  const [loading, setLoading] = useState(false);
  const [industry, setIndustry] = useState('');

  async function runGeneration() {
    const trimmed = industry.trim();
    if (!trimmed) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const state = useSessionStore.getState();
      const { exploration: result, trimmed: wasTrimmed } =
        await generateIndustryExploration({
          industry: trimmed,
          resume: state.resumeText ?? undefined,
          aboutYou: state.freeText || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          jobTitle: state.jobTitle || undefined,
        });
      useSessionStore.getState().setIndustryExploration(result);
      if (wasTrimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Industry exploration failed');
    } finally {
      setLoading(false);
    }
  }

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

  function handleExploreAnother() {
    store.setIndustryExploration(null);
    setIndustry('');
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
            {exploration && (
              <>
                <SaveDocxButton
                  getBlob={() => industryExplorationToDocx(exploration)}
                  filename={`industry-${exploration.industry.replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => industryExplorationToMarkdown(exploration)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleExploreAnother}>
                  Explore another
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
            <p className='text-ink-muted'>Exploring the industry…</p>
          </div>
        )}
        {!loading && !exploration && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Explore an industry</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                What&apos;s it like to work in this industry?
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                Pick an industry and get an honest overview — key roles, how to break in, what&apos;s growing, and what to watch out for.
                Add a resume to personalise the entry points.
              </p>

              <div className='space-y-4'>
                <div>
                  <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                    Industry
                  </label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder='e.g. Healthcare tech, Renewable energy, Game development'
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
                    placeholder='Your background or interests — helps personalise the exploration.'
                    disabled={loading}
                  />
                </div>

                <div className='flex justify-center pt-2'>
                  <Button onClick={runGeneration} disabled={!industry.trim() || loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Exploring…</>
                    ) : (
                      <><Factory className='w-4 h-4 mr-2' /> Explore this industry</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {!loading && exploration && <IndustryResultView exploration={exploration} />}
      </div>
      <Toaster />
    </div>
  );
}
