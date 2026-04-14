'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import CareerNode from '@/components/CareerNode';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Node, NodeTypes } from 'reactflow';
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
  useEffect(() => {
    const hasInput =
      !!resumeText ||
      !!freeText.trim() ||
      !!jobTitle.trim() ||
      !!jobAdvert.trim() ||
      !!distilledProfile;
    if (!hasInput || careers || loading || needsSetup) return;

    (async () => {
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/getCareers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: resumeText ?? undefined,
            freeText: freeText || undefined,
            jobTitle: jobTitle || undefined,
            jobAdvert: jobAdvert || undefined,
            distilledProfile: distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to generate careers');
        }
        const data = await res.json();
        store.setCareers(data);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to generate');
      } finally {
        setLoading(false);
      }
    })();
  }, [resumeText, freeText, jobTitle, jobAdvert, distilledProfile, careers, loading, needsSetup, store]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
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

  if (loading) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4'>
        <LoadingDots style='big' color='gray' />
        <p className='text-ink-muted'>Generating career paths…</p>
      </div>
    );
  }

  if (!careers || careers.length === 0) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4'>
        <p className='text-ink-muted'>No careers yet.</p>
        <Link href='/' className='underline'>Back to start</Link>
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col'>
      <div className='flex justify-end p-3 gap-3 flex-shrink-0'>
        <Button variant='outline' onClick={handleStartOver}>
          Start over
        </Button>
      </div>
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
