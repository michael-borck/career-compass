import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Columns3, Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoadingDots from '@/components/ui/loadingdots';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import OdysseyElaboration from '@/components/odyssey/OdysseyElaboration';
import OdysseyDashboard from '@/components/odyssey/OdysseyDashboard';
import OdysseyCompareView from '@/components/odyssey/OdysseyCompareView';
import { useSessionStore, type OdysseyLifeType } from '@/lib/session-store';
import { odysseyPlanToMarkdown } from '@/lib/markdown-export';
import { odysseyPlanToDocx } from '@/components/odyssey/odyssey-docx';
import { suggestLife, elaborateLife } from '../services/odyssey';
import { isConfigured as isLLMConfigured } from '../services/llm';

const TYPES: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];

const TITLES: Record<OdysseyLifeType, string> = {
  current: 'Life 1 — Current Path',
  pivot: 'Life 2 — The Pivot',
  wildcard: 'Life 3 — The Wildcard',
};

export default function Odyssey() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const { odysseyLives } = store;
  const [view, setView] = useState<'cards' | 'compare'>('cards');

  const elaboratedCount = TYPES.filter((t) => !!odysseyLives[t].headline).length;
  const canCompare = elaboratedCount >= 2;

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    navigate('/');
  }

  const markdown = odysseyPlanToMarkdown(odysseyLives);

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-5xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link to='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            <SaveDocxButton getBlob={() => odysseyPlanToDocx(odysseyLives)} filename='odyssey-plan.docx' />
            <CopyMarkdownButton getMarkdown={() => markdown} label='Copy as text' />
            {view === 'cards' ? (
              <Button
                variant='outline'
                onClick={() => setView('compare')}
                disabled={!canCompare}
                title={canCompare ? 'Compare all three lives' : 'Elaborate at least two lives first'}
              >
                <Columns3 className='w-4 h-4 mr-2' />
                Compare all three
              </Button>
            ) : (
              <Button variant='outline' onClick={() => setView('cards')}>
                <ArrowLeft className='w-4 h-4 mr-2' />
                Back to cards
              </Button>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        <div className='editorial-rule justify-center mb-2'>
          <span>Odyssey Plan</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
          Imagine three lives
        </h1>
        <p className='text-[var(--text-base)] text-ink-muted text-center max-w-2xl mx-auto mb-8'>
          Three alternative five-year futures. Brainstorm each seed, let the AI flesh it out,
          then rate how each one feels. There are no wrong answers.
        </p>

        {view === 'cards' ? (
          <div className='space-y-6'>
            {TYPES.map((type) => (
              <LifeCard key={type} type={type} />
            ))}
          </div>
        ) : (
          <OdysseyCompareView lives={odysseyLives} />
        )}

        <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
          Ready to see the bigger picture?{' '}
          <Link to='/career-story' className='underline hover:text-accent'>
            Build your career story
          </Link>
        </p>
      </div>
      <Toaster />
    </div>
  );
}

// Inlined replacement for the legacy OdysseyLifeCard. Uses renderer-side
// service functions (suggestLife / elaborateLife) instead of broken fetch
// calls to deleted Next.js routes.
function LifeCard({ type }: { type: OdysseyLifeType }) {
  const navigate = useNavigate();
  const store = useSessionStore();
  const life = store.odysseyLives[type];
  const [elaborating, setElaborating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const isElaborated = !!life.headline;

  async function ensureProvider(): Promise<boolean> {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return false;
    }
    return true;
  }

  function profilePayload() {
    return {
      resume: store.resumeText ?? undefined,
      freeText: store.freeText || undefined,
      jobTitle: store.jobTitle || undefined,
      jobAdvert: store.jobAdvert || undefined,
      distilledProfile: store.distilledProfile ?? undefined,
    };
  }

  async function runElaborate() {
    if (!life.seed.trim()) return;
    if (!(await ensureProvider())) return;

    setElaborating(true);
    try {
      const { elaboration, trimmed } = await elaborateLife({
        type,
        label: life.label.trim() || TITLES[type],
        seed: life.seed.trim(),
        ...profilePayload(),
      });
      store.setOdysseyElaboration(type, elaboration);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'i' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : 'Could not elaborate this life. Try again.'
      );
    } finally {
      setElaborating(false);
    }
  }

  async function runSuggest() {
    if (!(await ensureProvider())) return;

    const hasContent = life.label.trim() || life.seed.trim();
    if (hasContent && !confirm('Replace your current seed with a suggestion?')) {
      return;
    }

    setSuggesting(true);
    try {
      const { label, description } = await suggestLife({
        type,
        ...profilePayload(),
      });
      store.setOdysseySeed(type, label, description);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not generate a suggestion. Try again or type one yourself.'
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function runRegenerate() {
    if (
      !confirm(
        'Regenerate this life? The current elaboration will be replaced. Your dashboard ratings will be kept.'
      )
    ) {
      return;
    }
    await runElaborate();
  }

  function runReset() {
    if (!confirm('Reset this life? This clears the seed, elaboration, and ratings.')) return;
    store.resetOdysseyLife(type);
  }

  return (
    <div className='border border-border rounded-lg bg-paper p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-[var(--text-xl)] font-semibold text-ink'>{TITLES[type]}</h2>
        {isElaborated && (
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={runRegenerate}
              disabled={elaborating || suggesting}
            >
              <RotateCcw className='w-3 h-3 mr-1' />
              {elaborating ? 'Regenerating…' : 'Regenerate'}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={runReset}
              disabled={elaborating || suggesting}
            >
              <Trash2 className='w-3 h-3 mr-1' />
              Reset
            </Button>
          </div>
        )}
      </div>

      <div className='space-y-3'>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>Label</label>
          <Input
            value={life.label}
            onChange={(e) => store.setOdysseySeed(type, e.target.value, life.seed)}
            placeholder='A short name for this life (3-8 words)'
            disabled={elaborating || suggesting}
          />
        </div>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>Seed</label>
          <Textarea
            value={life.seed}
            rows={3}
            onChange={(e) => store.setOdysseySeed(type, life.label, e.target.value)}
            placeholder='One or two sentences about this life, written in first person.'
            disabled={elaborating || suggesting}
          />
        </div>
      </div>

      {!isElaborated && (
        <div className='flex gap-3 mt-4'>
          <Button
            onClick={runElaborate}
            disabled={!life.seed.trim() || elaborating || suggesting}
          >
            {elaborating ? (
              <>
                <LoadingDots color='white' /> Elaborating…
              </>
            ) : (
              'Elaborate this life'
            )}
          </Button>
          <Button
            variant='outline'
            onClick={runSuggest}
            disabled={elaborating || suggesting}
          >
            <Sparkles className='w-4 h-4 mr-2' />
            {suggesting ? 'Thinking…' : 'Suggest from profile'}
          </Button>
        </div>
      )}

      {isElaborated && (
        <>
          <OdysseyElaboration life={life} />
          <OdysseyDashboard
            dashboard={life.dashboard}
            onChange={(field, value) => store.setOdysseyDashboard(type, field, value)}
          />
        </>
      )}
    </div>
  );
}
