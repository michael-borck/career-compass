// Guided local-AI onboarding, shown on the home page when no provider is
// configured. Walks the whole journey without a terminal:
//   probing → no Ollama: link to the official download + "check again"
//           → Ollama but no model: one-click in-app pull with live progress
//           → auto-connects and hands back to the normal home page.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  checkOllama,
  pullModel,
  connectOllama,
  OLLAMA_DOWNLOAD_URL,
  RECOMMENDED_MODEL,
  RECOMMENDED_MODEL_SIZE,
} from '../services/ollama-setup';

type Phase =
  | { kind: 'probing' }
  | { kind: 'no-ollama' }
  | { kind: 'no-model' }
  | { kind: 'pulling'; percent: number | null; status: string };

export default function OllamaSetupCard({ onConnected }: { onConnected: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'probing' });
  // Bumped by the "check again" button; the probe effect re-runs on change.
  const [probeNonce, setProbeNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const status = await checkOllama();
      if (cancelled) return;
      if (!status.running) {
        setPhase({ kind: 'no-ollama' });
        if (probeNonce > 0) {
          toast('Ollama not detected yet — finish the install, then check again.');
        }
        return;
      }
      if (status.models.length === 0) {
        setPhase({ kind: 'no-model' });
        return;
      }
      // Ollama is running with at least one model — connect to the first.
      await connectOllama(status.models[0]);
      if (cancelled) return;
      toast.success(`Connected to Ollama (${status.models[0]}).`);
      onConnected();
    };
    void probe();
    return () => {
      cancelled = true;
    };
    // onConnected is an inline parent callback; depending on it would re-probe
    // on every parent render. The nonce is the intentional re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeNonce]);

  async function handlePull() {
    setPhase({ kind: 'pulling', percent: null, status: 'starting' });
    try {
      await pullModel(RECOMMENDED_MODEL, ({ percent, status }) =>
        setPhase({ kind: 'pulling', percent, status })
      );
      await connectOllama(RECOMMENDED_MODEL);
      toast.success(`${RECOMMENDED_MODEL} ready — you're connected.`);
      onConnected();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Model download failed.');
      setPhase({ kind: 'no-model' });
    }
  }

  return (
    <div className='w-full max-w-2xl mx-auto mt-6 border border-accent/40 bg-accent-soft rounded-lg p-6 text-center'>
      <div className='editorial-rule justify-center mb-2'>
        <span>Set up your AI</span>
      </div>

      {phase.kind === 'probing' && <p className='text-ink-muted'>Looking for a local Ollama…</p>}

      {phase.kind === 'no-ollama' && (
        <>
          <p className='text-ink mb-1 font-medium'>
            Run everything privately on your own computer — free.
          </p>
          <p className='text-[var(--text-sm)] text-ink-muted mb-4'>
            Career Compass uses Ollama for local AI. Nothing you write leaves your device.
          </p>
          <div className='flex items-center justify-center gap-3 flex-wrap'>
            <a href={OLLAMA_DOWNLOAD_URL} target='_blank' rel='noreferrer'>
              <Button>
                <Download className='w-4 h-4 mr-2' />
                Get Ollama (free)
              </Button>
            </a>
            <Button
              variant='outline'
              onClick={() => {
                setPhase({ kind: 'probing' });
                setProbeNonce((n) => n + 1);
              }}
            >
              <RefreshCw className='w-4 h-4 mr-2' />
              I&rsquo;ve installed it — check again
            </Button>
          </div>
        </>
      )}

      {phase.kind === 'no-model' && (
        <>
          <p className='text-ink mb-1 font-medium'>Ollama is running — it just needs a model.</p>
          <p className='text-[var(--text-sm)] text-ink-muted mb-4'>
            One download and everything works, fully offline.
          </p>
          <Button onClick={() => void handlePull()}>
            <Download className='w-4 h-4 mr-2' />
            Download {RECOMMENDED_MODEL} · {RECOMMENDED_MODEL_SIZE}
          </Button>
        </>
      )}

      {phase.kind === 'pulling' && (
        <>
          <p className='text-ink mb-3 font-medium'>
            Downloading {RECOMMENDED_MODEL}
            {phase.percent !== null ? ` — ${phase.percent}%` : '…'}
          </p>
          <div
            className='w-full h-2 bg-paper border border-border rounded overflow-hidden mb-2'
            role='progressbar'
            aria-valuenow={phase.percent ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className='h-full bg-accent transition-[width] duration-300'
              style={{ width: `${phase.percent ?? 4}%` }}
            />
          </div>
          <p className='text-[var(--text-xs)] text-ink-quiet'>{phase.status}</p>
        </>
      )}

      <p className='text-[var(--text-xs)] text-ink-quiet mt-4'>
        <Sparkles className='w-3 h-3 inline mr-1' />
        Prefer a cloud provider (OpenAI, Claude, Gemini…)?{' '}
        <Link to='/settings' className='underline hover:text-accent'>
          Set one up in Settings
        </Link>
      </p>
    </div>
  );
}
