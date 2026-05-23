import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import ReactFlow, {
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Node, NodeTypes } from 'reactflow';
import { ArrowLeft, Columns3, Compass, X } from 'lucide-react';
import CareerNode from '@/components/CareerNode';
import LocalFileUpload from '@/components/LocalFileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore } from '@/lib/session-store';
import { generateCareers } from '../services/careers';
import { extractTextFromFile } from '../services/file-upload';
import { isConfigured as isLLMConfigured } from '../services/llm';
import { useGeneration } from '../hooks/useGeneration';

const nodeTypes = { careerNode: CareerNode } satisfies NodeTypes;

// Fixed-position 6-card spoke layout around a central "Careers" root.
// Inlined from the legacy page — no separate layout helper exists.
const positions = [
  { x: 50, y: 550, connectPosition: 'top' },
  { x: 1050, y: 550, connectPosition: 'top' },
  { x: 50, y: 150, connectPosition: 'bottom' },
  { x: 1050, y: 150, connectPosition: 'bottom' },
  { x: 550, y: 700, connectPosition: 'top' },
  { x: 550, y: 0, connectPosition: 'bottom' },
];

function makeNodes(careers: any[]): Node[] {
  const root: Node = {
    id: '1',
    position: { x: 650, y: 450 },
    data: { label: 'Careers' },
    style: {
      background: 'hsl(var(--ink))',
      color: 'hsl(var(--paper))',
      fontSize: '20px',
      borderRadius: '6px',
    },
  };
  const cards: Node[] = careers.slice(0, 6).map((c, i) => ({
    id: String(i + 2),
    type: 'careerNode',
    position: { x: positions[i].x, y: positions[i].y },
    data: { ...c, connectPosition: positions[i].connectPosition },
  }));
  return [root, ...cards];
}

function makeEdges(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `e1-${i + 2}`,
    source: '1',
    target: String(i + 2),
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  }));
}

export default function Careers() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const { careers, comparing } = store;

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as any[]);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    (async () => setNeedsSetup(!(await isLLMConfigured())))();
  }, []);

  // Sync ReactFlow nodes with session-store careers.
  useEffect(() => {
    if (!careers || careers.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setNodes(makeNodes(careers));
    setEdges(makeEdges(Math.min(careers.length, 6)));
  }, [careers, setNodes, setEdges]);

  // Clear focus if the focused career is no longer in the new set.
  useEffect(() => {
    if (!careers) return;
    const focus = useSessionStore.getState().currentFocus;
    if (!focus) return;
    const stillPresent = careers.some((c) => c.jobTitle === focus);
    if (!stillPresent) {
      useSessionStore.getState().setFocus(null);
      useSessionStore.getState().addChatMessage({
        role: 'system',
        kind: 'focus-marker',
        content: '— focus cleared, new careers generated —',
      });
    }
  }, [careers]);

  const { loading, run: runGeneration } = useGeneration({
    generate: () => {
      const state = useSessionStore.getState();
      return generateCareers({
        resume: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
    },
    persist: (result) => useSessionStore.getState().setCareers(result),
    errorFallback: 'Failed to generate careers',
    // Auto-run on mount when inputs are present but no careers exist yet —
    // preserves the landing-page hand-off from the legacy app.
    autoRun: () => {
      const state = useSessionStore.getState();
      const hasInput =
        !!state.resumeText ||
        !!state.freeText?.trim() ||
        !!state.jobTitle?.trim() ||
        !!state.jobAdvert?.trim() ||
        !!state.distilledProfile;
      return hasInput && !state.careers && !needsSetup;
    },
  });

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

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
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    navigate('/');
  }

  function handleCompareLaunch() {
    if (comparing.length < 2) return;
    store.setComparePrefill({ richCareerTitles: [...comparing] });
    store.clearComparing();
    navigate('/compare');
  }

  function handleCompareCancel() {
    store.clearComparing();
  }

  // No provider configured — punt to settings.
  if (needsSetup) {
    return (
      <div className='h-full flex flex-col items-center justify-center p-10'>
        <h1 className='text-[var(--text-2xl)] font-semibold text-ink mb-4'>
          Set up an AI provider
        </h1>
        <Link to='/settings' className='underline'>
          Go to Settings
        </Link>
      </div>
    );
  }

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasJobTitle = !!store.jobTitle.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();
  const hasAny = hasResume || hasFreeText || hasJobTitle || hasJobAdvert;

  // Input form view -- no careers yet (or cleared).
  if (!careers || careers.length === 0) {
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
              <Button variant='outline' onClick={handleStartOver}>
                Start over
              </Button>
            </div>
          </div>

          {loading ? (
            <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
              <LoadingDots color='gray' />
              <p className='text-ink-muted'>Generating career paths…</p>
            </div>
          ) : (
            <div className='max-w-2xl mx-auto'>
              <div className='border border-border rounded-lg bg-paper p-6'>
                <div className='editorial-rule justify-center mb-2'>
                  <span>Find my careers</span>
                </div>
                <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
                  Generate 6 personalised career paths
                </h2>
                <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
                  Fill in any field to get started. The more you provide, the more personalised the results.
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

                  <div className='flex justify-center pt-2'>
                    <Button onClick={runGeneration} disabled={!hasAny || loading}>
                      {loading ? (
                        <><LoadingDots color='white' /> Generating…</>
                      ) : (
                        <><Compass className='w-4 h-4 mr-2' /> Find my careers</>
                      )}
                    </Button>
                  </div>

                  {!hasAny && (
                    <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
                      Fill in any field above to get started.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <Toaster />
      </div>
    );
  }

  // Result view -- ReactFlow layout.
  return (
    <div className='h-full flex flex-col'>
      <div className='flex items-center justify-between p-3 flex-shrink-0'>
        <Link to='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
          <ArrowLeft className='w-4 h-4' />
          Back to landing
        </Link>
        <div className='flex items-center gap-3'>
          <Button variant='outline' onClick={handleStartOver}>
            Start over
          </Button>
        </div>
      </div>
      {comparing.length > 0 && (
        <div className='mx-3 mt-3 border border-accent/30 bg-accent-soft rounded-lg px-5 py-3 flex items-center gap-4 flex-wrap flex-shrink-0'>
          <span className='block w-2 h-2 rounded-full bg-accent flex-shrink-0' />
          <div className='flex-1 text-[var(--text-sm)] text-ink flex flex-wrap gap-x-2 gap-y-1 items-center'>
            <span className='text-ink-quiet'>Comparing:</span>
            <span className='font-medium'>{comparing.join(', ')}</span>
            <span className='text-ink-quiet italic'>
              {comparing.length < 3 ? 'click one more (optional)' : 'maximum reached'}
            </span>
          </div>
          <Button
            size='sm'
            onClick={handleCompareLaunch}
            disabled={comparing.length < 2}
          >
            <Columns3 className='w-3 h-3 mr-1' />
            Compare {comparing.length}
          </Button>
          <Button size='sm' variant='outline' onClick={handleCompareCancel}>
            <X className='w-3 h-3 mr-1' />
            Cancel
          </Button>
        </div>
      )}
      <div className='flex-1 min-h-0'>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
        </ReactFlow>
      </div>
      <Toaster />
    </div>
  );
}
