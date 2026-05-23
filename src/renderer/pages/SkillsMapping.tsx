import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { skillsMappingToMarkdown } from '@/lib/markdown-export';
import { skillsMappingToDocx } from '@/components/skills-mapping/skills-mapping-docx';
import LoadingDots from '@/components/ui/loadingdots';
import SkillsMappingResultView from '@/components/skills-mapping/SkillsMappingResultView';
import { generateSkillsMapping } from '../services/skillsMapping';
import { extractTextFromFile } from '../services/file-upload';
import { useGeneration } from '../hooks/useGeneration';

export default function SkillsMapping() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const mapping = store.skillsMapping;
  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasProfile = hasResume || hasFreeText || !!store.distilledProfile;

  const { loading, run: runGeneration } = useGeneration({
    generate: () => {
      const state = useSessionStore.getState();
      return generateSkillsMapping({
        resume: state.resumeText ?? undefined,
        aboutYou: state.freeText || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
        jobTitle: state.jobTitle || undefined,
      });
    },
    persist: (r) => useSessionStore.getState().setSkillsMapping(r.mapping),
    trimmed: (r) => r.trimmed,
    errorFallback: 'Skills mapping failed',
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

  function handleRunAgain() {
    store.setSkillsMapping(null);
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
            {mapping && (
              <>
                <SaveDocxButton
                  getBlob={() => skillsMappingToDocx(mapping)}
                  filename='skills-mapping.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => skillsMappingToMarkdown(mapping)}
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
            <p className='text-ink-muted'>Mapping your skills to professional frameworks…</p>
          </div>
        )}
        {!loading && !mapping && (
          <div className='max-w-2xl mx-auto'>
            <div className='border border-border rounded-lg bg-paper p-6'>
              <div className='editorial-rule justify-center mb-2'>
                <span>Skills mapping</span>
              </div>
              <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                Map your skills to professional frameworks
              </h2>
              <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                Translate your skills into the language employers use. Maps to SFIA, O*NET, ESCO, and AQF.
                Needs a profile (resume or about you). Add a job title to focus on the most relevant skills.
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
                    Target role <span className='normal-case tracking-normal font-normal'>(optional)</span>
                  </label>
                  <Input
                    value={store.jobTitle}
                    onChange={(e) => store.setJobTitle(e.target.value)}
                    placeholder='e.g. Data analyst — focuses the mapping on relevant skills'
                    disabled={loading}
                  />
                </div>

                <div className='flex justify-center pt-2'>
                  <Button onClick={runGeneration} disabled={!hasProfile || loading}>
                    {loading ? (
                      <><LoadingDots color='white' /> Mapping…</>
                    ) : (
                      <><Grid3X3 className='w-4 h-4 mr-2' /> Map my skills</>
                    )}
                  </Button>
                </div>

                {!hasProfile && (
                  <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                    Add a resume or write something in About you.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && mapping && <SkillsMappingResultView mapping={mapping} />}
      </div>
      <Toaster />
    </div>
  );
}
