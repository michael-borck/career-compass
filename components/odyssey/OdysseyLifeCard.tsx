'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type OdysseyLifeType } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import OdysseyElaboration from './OdysseyElaboration';
import OdysseyDashboard from './OdysseyDashboard';

const TITLES: Record<OdysseyLifeType, string> = {
  current: 'Life 1 — Current Path',
  pivot: 'Life 2 — The Pivot',
  wildcard: 'Life 3 — The Wildcard',
};

type Props = { type: OdysseyLifeType };

export default function OdysseyLifeCard({ type }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const life = store.odysseyLives[type];
  const [elaborating, setElaborating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const isElaborated = !!life.headline;

  async function ensureProvider(): Promise<boolean> {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
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
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/odysseyElaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          label: life.label.trim() || TITLES[type],
          seed: life.seed.trim(),
          ...profilePayload(),
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not elaborate this life.');
      }
      const { elaboration, trimmed } = await res.json();
      store.setOdysseyElaboration(type, elaboration);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not elaborate this life. Try again.');
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
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/odysseySuggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...profilePayload(), llmConfig }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not generate a suggestion.');
      }
      const { label, description } = await res.json();
      store.setOdysseySeed(type, label, description);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not generate a suggestion. Try again or type one yourself.');
    } finally {
      setSuggesting(false);
    }
  }

  async function runRegenerate() {
    if (!confirm('Regenerate this life? The current elaboration will be replaced. Your dashboard ratings will be kept.')) {
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
            <Button variant='outline' size='sm' onClick={runRegenerate} disabled={elaborating || suggesting}>
              <RotateCcw className='w-3 h-3 mr-1' />
              {elaborating ? 'Regenerating…' : 'Regenerate'}
            </Button>
            <Button variant='outline' size='sm' onClick={runReset} disabled={elaborating || suggesting}>
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
          <Button onClick={runElaborate} disabled={!life.seed.trim() || elaborating || suggesting}>
            {elaborating ? (
              <><LoadingDots color='white' /> Elaborating…</>
            ) : (
              'Elaborate this life'
            )}
          </Button>
          <Button variant='outline' onClick={runSuggest} disabled={elaborating || suggesting}>
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
