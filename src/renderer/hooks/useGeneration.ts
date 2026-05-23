// useGeneration — the shared "run a feature generation" policy for pages.
//
// Every single-shot feature page repeated the same dance: gate on an LLM being
// configured (else toast + route to /settings), flip a loading flag, call the
// service in a try/catch, persist the result, surface a "trimmed" notice, toast
// errors, and a once-only auto-run on mount. This hook owns that policy; a page
// supplies only the parts that vary.
//
// See CONTEXT.md ("page generation").

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isConfigured } from '../services/llm';

export type UseGenerationOptions<T> = {
  // Gather inputs (typically from the session store) and call the service.
  generate: () => Promise<T>;
  // Persist the result (typically a session-store setter).
  persist: (result: T) => void;
  // Whether to show the "input was trimmed" notice for this result.
  trimmed?: (result: T) => boolean;
  // Fallback toast message when the thrown error has no usable message.
  errorFallback?: string;
  // When provided, the hook runs once on mount if the predicate returns true.
  autoRun?: () => boolean;
};

export type UseGenerationResult = {
  loading: boolean;
  run: () => Promise<void>;
  // Re-arm the once-only auto-run gate (for "generate another" flows).
  resetAutoRun: () => void;
};

export function useGeneration<T>(opts: UseGenerationOptions<T>): UseGenerationResult {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  // Latest opts in a ref so run() and the mount effect always see current
  // closures without the hook re-subscribing on every render.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  async function run() {
    const o = optsRef.current;
    if (!(await isConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const result = await o.generate();
      o.persist(result);
      if (o.trimmed?.(result)) {
        toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : o.errorFallback ?? 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    if (optsRef.current.autoRun?.()) void run();
    // Mount-only: the auto-run gate fires at most once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    run,
    resetAutoRun: () => {
      autoRanRef.current = false;
    },
  };
}
