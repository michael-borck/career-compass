import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import CompareTable from '@/components/compare/CompareTable';
import { useSessionStore } from '@/lib/session-store';
import { comparisonToMarkdown } from '@/lib/markdown-export';
import { comparisonToDocx } from '@/components/compare/compare-docx';
import { generateComparison } from '../services/compare';
import { extractTextFromFile } from '../services/file-upload';
import { isConfigured as isLLMConfigured } from '../services/llm';

export default function Compare() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const { comparison } = store;
  const [loading, setLoading] = useState(false);

  // Quick-compare inputs (inline form)
  const [target1, setTarget1] = useState('');
  const [target2, setTarget2] = useState('');
  const [target3, setTarget3] = useState('');
  const [prefillLabel, setPrefillLabel] = useState(false);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const prefill = store.consumeComparePrefill();
    if (!prefill) return;

    // Rich-mode auto-run path: requires Find-my-careers results in session
    // (richCareerTitles). The /careers page isn't ported yet, but preserve
    // the flow so it works once it is.
    if (prefill.richCareerTitles && prefill.richCareerTitles.length >= 2) {
      const careers = store.careers ?? [];
      const resolved = prefill.richCareerTitles
        .map((title) => careers.find((c) => c.jobTitle === title))
        .filter((c): c is NonNullable<typeof c> => !!c);

      if (resolved.length !== prefill.richCareerTitles.length) {
        toast.error(
          'The selected careers are no longer available. Generate careers again and retry.'
        );
        return;
      }

      (async () => {
        if (!(await isLLMConfigured())) {
          toast.error('Set up an LLM provider first.');
          navigate('/settings');
          return;
        }
        setLoading(true);
        try {
          const state = useSessionStore.getState();
          const targets = resolved.map((c) => ({
            label: c.jobTitle,
            context: c,
          }));
          const { comparison: result, trimmed } = await generateComparison({
            mode: 'rich',
            targets,
            resume: state.resumeText ?? undefined,
            freeText: state.freeText || undefined,
            distilledProfile: state.distilledProfile ?? undefined,
          });
          useSessionStore.getState().setComparison(result);
          if (trimmed) {
            toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
          }
        } catch (err) {
          console.error(err);
          toast.error(
            err instanceof Error
              ? err.message
              : 'The comparison came back garbled. Try again — a second attempt often works.'
          );
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    // Quick-compare seed path: prefill the first target field.
    if (prefill.seedTarget) {
      setTarget1(prefill.seedTarget);
      setPrefillLabel(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canRun = target1.trim().length > 0 && target2.trim().length > 0;

  async function handleResumeSelect(file: File) {
    try {
      const { text, filename } = await extractTextFromFile(file);
      store.setResume(text, filename);
    } catch (err) {
      console.error(err);
      toast.error('Could not read that file. Try a different format.');
    }
  }

  async function runQuickCompare() {
    if (!canRun) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      navigate('/settings');
      return;
    }
    setLoading(true);
    try {
      const state = useSessionStore.getState();
      const targets: { label: string }[] = [
        { label: target1.trim() },
        { label: target2.trim() },
      ];
      if (target3.trim()) targets.push({ label: target3.trim() });

      const { comparison: result, trimmed } = await generateComparison({
        mode: 'quick',
        targets,
        resume: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
      useSessionStore.getState().setComparison(result);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'The comparison came back garbled. Try again — a second attempt often works.'
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

  function handleRunAnother() {
    if (!comparison) return;
    if (!confirm('Run another comparison? The current result will be cleared.')) return;
    if (comparison.roles.length > 0) {
      setTarget1(comparison.roles[0].label);
      setPrefillLabel(true);
      setTarget2('');
      setTarget3('');
    }
    store.setComparison(null);
  }

  function handleGapForRole(label: string) {
    store.setJobTitle(label);
    store.setGapAnalysis(null);
    navigate('/gap-analysis');
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-5xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link to='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {comparison && (
              <>
                <SaveDocxButton
                  getBlob={() => comparisonToDocx(comparison)}
                  filename='career-comparison.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => comparisonToMarkdown(comparison)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleRunAnother}>
                  Run another
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Comparing careers...</p>
          </div>
        )}

        {!loading && !comparison && (
          <div className='border border-border rounded-lg bg-paper p-6'>
            <div className='editorial-rule justify-center mb-2'>
              <span>Compare careers</span>
            </div>
            <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
              Quick side-by-side across seven dimensions
            </h2>

            <div className='border-l-2 border-accent p-4 bg-paper-warm mb-6 mt-4'>
              <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
                Quick compare is vague. It makes assumptions about each role. For a richer
                comparison, run <strong>Find my careers</strong> first, pick 2 or 3 from the
                spider graph, and compare from there.
              </p>
            </div>

            <div className='space-y-4'>
              <div>
                <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
                  Target 1 {prefillLabel && <span className='text-ink-quiet'>(from landing)</span>}
                </label>
                <Textarea
                  value={target1}
                  rows={2}
                  onChange={(e) => {
                    setTarget1(e.target.value);
                    setPrefillLabel(false);
                  }}
                  placeholder='Job title or paste a short job advert.'
                  disabled={loading}
                />
              </div>

              <div>
                <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
                  Target 2
                </label>
                <Textarea
                  value={target2}
                  rows={2}
                  onChange={(e) => setTarget2(e.target.value)}
                  placeholder='Job title (e.g. UX researcher) or paste a short job advert.'
                  disabled={loading}
                />
              </div>

              <div>
                <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
                  Target 3 <span className='text-ink-quiet'>(optional)</span>
                </label>
                <Textarea
                  value={target3}
                  rows={2}
                  onChange={(e) => setTarget3(e.target.value)}
                  placeholder='Job title or paste a short job advert.'
                  disabled={loading}
                />
              </div>

              <div>
                <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                  Resume (optional)
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
                  About you (optional)
                </label>
                <Textarea
                  value={store.freeText}
                  rows={3}
                  onChange={(e) => store.setFreeText(e.target.value)}
                  placeholder='A sentence or two about your background, interests, or goals.'
                  disabled={loading}
                />
              </div>

              <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                Adding a resume or About you makes the comparison more personalised.
              </p>

              <div className='flex justify-center pt-2'>
                <Button onClick={runQuickCompare} disabled={!canRun || loading}>
                  {loading ? (
                    <>
                      <LoadingDots color='white' /> Comparing...
                    </>
                  ) : (
                    <>
                      <Columns3 className='w-4 h-4 mr-2' />
                      Run comparison
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loading && comparison && (
          <div>
            <div className='editorial-rule justify-center mb-2'>
              <span>Career comparison</span>
            </div>
            <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
              {comparison.roles.length} roles side-by-side
            </h1>

            {comparison.mode === 'quick' && (
              <div className='border-l-2 border-accent p-4 bg-paper-warm mt-4 mb-6'>
                <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
                  This is a quick compare. The LLM inferred each role&apos;s details. For a
                  richer comparison based on your generated careers, run{' '}
                  <strong>Find my careers</strong> from the landing page.
                </p>
              </div>
            )}

            <CompareTable comparison={comparison} />

            <div className='mt-8 pt-6 border-t border-border'>
              <div className='editorial-rule justify-center mb-4'>
                <span>Next steps</span>
              </div>
              <div className='flex flex-wrap justify-center gap-3'>
                {comparison.roles.map((role) => (
                  <Button
                    key={role.label}
                    variant='outline'
                    size='sm'
                    onClick={() => handleGapForRole(role.label)}
                  >
                    Analyse gaps for {role.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
