'use client';

import toast, { Toaster } from 'react-hot-toast';
import CareerNode from '@/components/CareerNode';
import { fileToArrayBuffer } from '@/lib/utils';
import LocalFileUpload from '@/components/LocalFileUpload';
import { settingsStore, secureStorage } from '@/lib/settings-store';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import LoadingDots from '@/components/ui/loadingdots';
import { finalCareerInfo } from '@/lib/types';

const nodeTypes = {
  careerNode: CareerNode,
} satisfies NodeTypes;

// TODO: Clean this up
const initialNodes = [
  {
    id: '1',
    position: { x: 650, y: 450 },
    data: { label: 'Careers' },
    style: { background: 'hsl(var(--ink))', color: 'hsl(var(--paper))', fontSize: '20px', borderRadius: '6px' },
  },
  {
    id: '2',
    type: 'careerNode',
    position: { x: 50, y: 550 },
    data: {
      jobTitle: 'SEO Specialist',
      jobDescription: `Uses research to improve a website's ranking in search engine results`,
      timeline: '2-3 months',
      salary: '$59k - $77k',
      difficulty: 'Low',
      connectPosition: 'top',
    },
  },
  {
    id: '3',
    type: 'careerNode',
    position: { x: 1050, y: 550 },
    data: {
      jobTitle: 'UX Designer',
      jobDescription:
        'Creates user-centred design solutions to improve product usability and user experience.',
      timeline: '3-6 months',
      salary: '$85k - $110k',
      difficulty: 'Medium',
      connectPosition: 'top',
    },
  },
  {
    id: '4',
    type: 'careerNode',
    position: { x: 50, y: 150 },
    data: {
      jobTitle: 'Digital Marketing Specialist',
      jobDescription:
        'Develops online marketing campaigns to drive business growth.',
      timeline: '2-4 months',
      salary: '$50k - $70k',
      difficulty: 'Low',
      connectPosition: 'bottom',
    },
  },
  {
    id: '5',
    type: 'careerNode',
    position: { x: 1050, y: 150 },
    data: {
      jobTitle: 'Software Engineer',
      jobDescription:
        'Designs, develops, and tests software applications to meet business needs.',
      timeline: '6-12 months',
      salary: '$100k - $140k',
      difficulty: 'High',
      connectPosition: 'bottom',
    },
  },
  {
    id: '6',
    type: 'careerNode',
    position: { x: 550, y: 700 },
    data: {
      jobTitle: 'Cybersecurity Specialist',
      jobDescription:
        'Protects computer systems and networks from cyber threats by developing and implementing security protocols.',
      timeline: '6-12 months',
      salary: '$80k - $120k',
      difficulty: 'High',
      connectPosition: 'top',
    },
  },
  {
    id: '7',
    type: 'careerNode',
    position: { x: 550, y: 0 },
    data: {
      jobTitle: 'Business Analyst',
      jobDescription:
        'Analyses business needs and develops solutions to improve operations and processes.',
      timeline: '3-6 months',
      salary: '$65k - $90k',
      difficulty: 'Medium',
      connectPosition: 'bottom',
    },
  },
] satisfies Node[];

const initialEdges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  },
  {
    id: 'e1-3',
    source: '1',
    target: '3',
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  },
  {
    id: 'e1-4',
    source: '1',
    target: '4',
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  },
  {
    id: 'e1-5',
    source: '1',
    target: '5',
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  },
  {
    id: 'e1-6',
    source: '1',
    target: '6',
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  },
  {
    id: 'e1-7',
    source: '1',
    target: '7',
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  },
];

export default function Start() {
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes as Node[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [careerInfo, setCareerInfo] = useState<finalCareerInfo[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);

  // Check if LLM is configured on mount
  useEffect(() => {
    async function checkSetup() {
      try {
        const saved = await settingsStore.get();
        if (!saved.model || !saved.model.trim()) {
          setNeedsSetup(true);
        }
      } catch {
        setNeedsSetup(true);
      }
    }
    checkSetup();
  }, []);

  useEffect(() => {
    setNodes((initialNodes) =>
      initialNodes.map((node) => {
        if (node.id === '1') {
          node.data = {
            label: 'Careers',
          };
        } else {
          let realdata = careerInfo[Number(node.id) - 2];

          if (node.id === '2' || node.id === '3' || node.id === '6') {
            // @ts-ignore
            node.data = { ...realdata, connectPosition: 'top' };
          } else {
            // @ts-ignore
            node.data = { ...realdata, connectPosition: 'bottom' };
          }
        }
        return node;
      })
    );
  }, [careerInfo]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const notify = () => toast.error('Failed to generate, please try again.');

  async function generateCareers() {
    if (!selectedFile && !additionalContext.trim()) return;

    setLoading(true);
    try {
      // Load LLM settings from client-side store (has access to electron-store + secure storage)
      const savedSettings = await settingsStore.get();
      let apiKey = await secureStorage.getApiKey(savedSettings.provider);

      // Fall back to environment variable if no stored key
      if (!apiKey && typeof window !== 'undefined' && (window as any).electronAPI) {
        const envVarMap: Record<string, string> = {
          openai: 'OPENAI_API_KEY',
          claude: 'ANTHROPIC_API_KEY',
          groq: 'GROQ_API_KEY',
          gemini: 'GOOGLE_API_KEY',
          openrouter: 'OPENROUTER_API_KEY',
        };
        const envVar = envVarMap[savedSettings.provider];
        if (envVar) {
          apiKey = await (window as any).electronAPI.getEnvVar(envVar) || '';
        }
      }

      const llmConfig = {
        provider: savedSettings.provider,
        model: savedSettings.model,
        apiKey: apiKey || '',
        baseURL: savedSettings.baseURL,
      };

      // Parse the file if one was uploaded, otherwise use empty string
      let resumeText = '';
      if (selectedFile) {
        const arrayBuffer = await fileToArrayBuffer(selectedFile);
        let response = await fetch('/api/parsePdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileData: Array.from(new Uint8Array(arrayBuffer)),
            filename: selectedFile.name
          }),
        });
        resumeText = await response.json();
      }

      // Generate careers — pass LLM config from client
      let response2 = await fetch('/api/getCareers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeInfo: resumeText,
          context: additionalContext,
          llmConfig,
        }),
      });

      if (!response2.ok) {
        const errData = await response2.json().catch(() => ({ error: 'Unknown server error' }));
        console.error('Failed to fetch careers:', errData);
        setLoading(false);
        toast.error(errData.error || 'Failed to generate careers. Check your AI provider settings.');
        return;
      }

      let data2 = await response2.json();
      setCareerInfo(data2);
      setLoading(false);
    } catch (error) {
      console.error('Error processing file:', error);
      setLoading(false);
      notify();
    }
  }

  return (
    <div>
      {careerInfo.length !== 0 ? (
        <div className='w-screen h-[1200px] mx-auto'>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
          >
            <Controls />
          </ReactFlow>
        </div>
      ) : (
        <div className='p-10 mt-16 flex justify-center items-center flex-col'>
          {needsSetup && !setupDismissed && (
            <div className='w-full max-w-2xl mb-8 border border-accent/20 bg-accent-soft rounded-lg p-6'>
              <div className='flex items-start justify-between'>
                <div>
                  <h2 className='text-[var(--text-xl)] font-semibold text-ink mb-2'>Welcome to Career Compass</h2>
                  <p className='text-ink-muted text-[var(--text-base)] leading-relaxed mb-3'>
                    Before you can explore career paths, you need to connect an AI provider.
                    Go to Settings to choose a provider, add your secret key, and select a model.
                  </p>
                  <Link
                    href='/settings'
                    className='inline-block bg-ink text-paper px-6 py-2 rounded-lg font-medium transition-colors duration-[250ms] hover:bg-accent'
                  >
                    Go to Settings
                  </Link>
                </div>
                <button
                  onClick={() => setSetupDismissed(true)}
                  className='text-ink-quiet hover:text-ink ml-4 flex-shrink-0'
                  aria-label='Dismiss'
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          <div className="editorial-rule">
            <span>Explore</span>
          </div>
          <h1 className='text-center text-[var(--text-3xl)] mb-5 font-semibold text-ink'>
            Explore career paths
          </h1>
          <p className='mb-8 text-center text-ink-muted max-w-3xl text-[var(--text-lg)] leading-relaxed'>
            Upload a resume or describe your skills and interests below.
            We'll suggest 6 personalised career paths for you.
          </p>
          <LocalFileUpload
            onFileSelect={(file) => {
              setSelectedFile(file);
              setFileName(file.name);
            }}
            className='w-full max-w-2xl mx-auto'
          />
          {fileName && (
            <p className='mt-4 text-[var(--text-sm)] text-ink-muted'>
              Selected: {fileName}
            </p>
          )}
          <div className='w-full max-w-2xl mt-5 flex items-center gap-3'>
            <div className='flex-1 h-px bg-border'></div>
            <span className='text-[var(--text-sm)] text-ink-quiet'>or just describe yourself</span>
            <div className='flex-1 h-px bg-border'></div>
          </div>
          <Textarea
            placeholder='Tell us about your skills, experience, education, and interests. For example: "I have 3 years of experience in marketing, a business degree, and I enjoy working with data and writing."'
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            className='mt-5 max-w-2xl'
            rows={6}
          />
          <Button
            onClick={generateCareers}
            className='mt-10 text-base px-5 py-7 w-60'
            disabled={!selectedFile && !additionalContext.trim()}
          >
            {loading ? (
              <LoadingDots style='big' color='white' />
            ) : (
              'Find your ideal career'
            )}
          </Button>
        </div>
      )}
      <Toaster />
    </div>
  );
}
