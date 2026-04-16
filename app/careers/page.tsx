'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CareerNode from '@/components/CareerNode';
import CareersInputCard from '@/components/careers/CareersInputCard';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Node, NodeTypes } from 'reactflow';
import { ArrowLeft, Columns3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

const nodeTypes = { careerNode: CareerNode } satisfies NodeTypes;

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

export default function CareersPage() {
  const router = useRouter();
  const store = useSessionStore();
  const {
    resumeText,
    freeText,
    jobTitle,
    jobAdvert,
    distilledProfile,
    careers,
    comparing,
  } = store;

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as any[]);
  const [loading, setLoading] = useState(false);
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

  // Generate careers on mount if we have inputs but no careers yet.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasInput =
      !!state.resumeText ||
      !!state.freeText?.trim() ||
      !!state.jobTitle?.trim() ||
      !!state.jobAdvert?.trim() ||
      !!state.distilledProfile;
    if (!hasInput || state.careers || needsSetup) return;

    (async () => {
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/getCareers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: state.resumeText ?? undefined,
            freeText: state.freeText || undefined,
            jobTitle: state.jobTitle || undefined,
            jobAdvert: state.jobAdvert || undefined,
            distilledProfile: state.distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to generate careers');
        }
        const data = await res.json();
        useSessionStore.getState().setCareers(data);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to generate');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  function handleCompareLaunch() {
    if (comparing.length < 2) return;
    store.setComparePrefill({ richCareerTitles: [...comparing] });
    store.clearComparing();
    router.push('/compare');
  }

  function handleCompareCancel() {
    store.clearComparing();
  }

  if (needsSetup) {
    return (
      <div className='h-full flex flex-col items-center justify-center p-10'>
        <h1 className='text-[var(--text-2xl)] font-semibold text-ink mb-4'>
          Set up an AI provider
        </h1>
        <Link href='/settings' className='underline'>
          Go to Settings
        </Link>
      </div>
    );
  }

  // Input card view -- show with page shell
  if (!careers || careers.length === 0) {
    return (
      <div className='h-full overflow-y-auto'>
        <div className='container mx-auto p-6 max-w-4xl'>
          {/* Top bar */}
          <div className='flex items-center justify-between mb-6'>
            <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
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
            <CareersInputCard />
          )}
        </div>
        <Toaster />
      </div>
    );
  }

  // Result view -- ReactFlow layout
  return (
    <div className='h-full flex flex-col'>
      <div className='flex items-center justify-between p-3 flex-shrink-0'>
        <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
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
