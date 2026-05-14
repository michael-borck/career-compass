// Chat / Career Advisor page (renderer port of app/chat/page.tsx).
//
// Multi-turn conversation that lives in zustand sessionStore.chatMessages.
// Every send appends the user message synchronously, then calls
// runChatTurn() with the latest snapshot of state (so any in-flight store
// updates are visible to the LLM call). The assistant reply is appended on
// return.
//
// Non-streaming — the legacy /api/chat route was also non-streaming, the
// user waits for the full reply.
//
// Distillation is lazy: it only runs when the user clicks one of three
// buttons:
//   - "Generate careers from this chat"  → opens ProfileReviewModal
//   - "Try as Odyssey plan"               → distill with Odyssey guidance,
//                                           seed odyssey, navigate /odyssey
//   - "Try as board review"               → distill with Board guidance,
//                                           seed board, navigate /board
//
// Look-up (the "Look up" composer button) calls runChatSearch() to fetch
// SourceRefs, then immediately calls handleSend(query, results) with the
// query as the user message and the sources passed in as searchSources.
// After the assistant reply comes back, the sources are attached to that
// reply via setChatSourcesForMessage so the message list can render them.
//
// Search is NOT auto-grounded each turn — only when the user explicitly
// clicks Look up. Mirrors the legacy behaviour.
//
// Paperclip attachments use extractTextFromFile (PDF/DOCX/MD/TXT) and
// update session-store directly. No /api/parsePdf round-trip — the IPC
// bridge handles the parse in the main process.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { X, FileText, Type, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import ProfileReviewModal from '@/components/chat/ProfileReviewModal';
import {
  useSessionStore,
  type StudentProfile,
  type SourceRef,
} from '@/lib/session-store';
import { runChatTurn, runChatSearch, distillProfile } from '../services/chat';
import { isConfigured as isLLMConfigured } from '../services/llm';
import { extractTextFromFile, isSupportedFile } from '../services/file-upload';

export default function Chat() {
  const navigate = useNavigate();
  const store = useSessionStore();
  const messages = store.chatMessages;
  const currentFocus = store.currentFocus;

  const [sending, setSending] = useState(false);
  const [paperclipOpen, setPaperclipOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProfile, setReviewProfile] = useState<StudentProfile | null>(null);
  const [reviewTrimmed, setReviewTrimmed] = useState(false);
  const [distilling, setDistilling] = useState(false);

  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 1 && !distilling;

  function clearFocus() {
    store.setFocus(null);
    store.addChatMessage({
      role: 'system',
      kind: 'focus-marker',
      content: '— focus cleared —',
    });
  }

  function startOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    navigate('/');
  }

  async function handleSend(text: string, searchSources?: SourceRef[]) {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    store.addChatMessage({ role: 'user', content: text });
    setSending(true);
    try {
      const state = useSessionStore.getState();
      const { reply, trimmed } = await runChatTurn({
        messages: state.chatMessages,
        currentFocus: state.currentFocus,
        resumeText: state.resumeText,
        freeText: state.freeText,
        jobTitle: state.jobTitle,
        jobAdvert: state.jobAdvert,
        searchSources,
      });
      if (trimmed) {
        store.addChatMessage({
          role: 'system',
          kind: 'notice',
          content:
            'Earlier messages were trimmed to fit. I still have your resume and recent context.',
        });
      }
      store.addChatMessage({ role: 'assistant', content: reply });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Chat failed');
      store.addChatMessage({
        role: 'assistant',
        content:
          "The advisor couldn't respond. Check your provider settings and try again.",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleLookUp(query: string) {
    try {
      const results = await runChatSearch(query);
      await handleSend(query, results);

      if (results.length > 0) {
        const latestMessages = useSessionStore.getState().chatMessages;
        const lastAssistant = [...latestMessages]
          .reverse()
          .find((m) => m.role === 'assistant');
        if (lastAssistant) {
          useSessionStore
            .getState()
            .setChatSourcesForMessage(lastAssistant.id, results);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Look-up failed');
    }
  }

  async function runDistillation(guidance?: string) {
    setDistilling(true);
    try {
      const state = useSessionStore.getState();
      const { profile, trimmed } = await distillProfile({
        messages: state.chatMessages,
        resume: store.resumeText ?? undefined,
        freeText: store.freeText || undefined,
        jobTitle: store.jobTitle || undefined,
        guidance,
      });
      setReviewProfile(profile);
      setReviewTrimmed(trimmed);
      setReviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Distillation failed');
    } finally {
      setDistilling(false);
    }
  }

  async function handleOdyssey() {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    setDistilling(true);
    try {
      const state = useSessionStore.getState();
      const { profile } = await distillProfile({
        messages: state.chatMessages,
        resume: store.resumeText ?? undefined,
        freeText: store.freeText || undefined,
        jobTitle: store.jobTitle || undefined,
        guidance:
          'Produce a one-to-two sentence aspirational summary suitable as the opening seed for a "Current Path" life in an Odyssey Plan — what the student seems to be heading toward based on this conversation. Write it in first person. Put this in the "background" field.',
      });
      const seedText = profile.background || '';
      const seedLabel = (profile.goals[0] ?? 'Current path').slice(0, 60);
      store.setOdysseySeed('current', seedLabel, seedText);
      navigate('/odyssey');
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not set up Odyssey plan from this chat.'
      );
    } finally {
      setDistilling(false);
    }
  }

  async function handleBoard() {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    setDistilling(true);
    try {
      const state = useSessionStore.getState();
      const { profile } = await distillProfile({
        messages: state.chatMessages,
        resume: store.resumeText ?? undefined,
        freeText: store.freeText || undefined,
        jobTitle: store.jobTitle || undefined,
        guidance:
          'Produce a one-to-two sentence framing summary describing what the student seems to be worried about or wanting feedback on in this conversation. This will be used as the opening question for a Board of Advisors profile review. Write it in first person from the student\'s perspective (for example "I\'m worried that..."). Put this in the "background" field.',
      });
      const framing = profile.background || '';
      store.setBoardPrefill({ framing });
      navigate('/board');
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not set up board review from this chat.'
      );
    } finally {
      setDistilling(false);
    }
  }

  function handleAcceptProfile(profile: StudentProfile) {
    store.setDistilledProfile(profile);
    store.setCareers(null);
    setReviewOpen(false);
    navigate('/careers');
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar (was ChatTopBar — inlined so we can drop the next/navigation
          shim dependency and embed the focus pill / generate / start-over
          buttons in one place.) */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Link
          to="/"
          className="text-ink-quiet hover:text-ink underline text-[var(--text-sm)]"
        >
          ← Back to landing
        </Link>
        <h1 className="text-[var(--text-lg)] font-semibold text-ink">
          Career Advisor
        </h1>
        {currentFocus && (
          <span className="inline-flex items-center gap-2 border border-accent/30 bg-accent-soft text-ink text-[var(--text-sm)] px-3 py-1 rounded-full">
            Focused on: {currentFocus}
            <button
              onClick={clearFocus}
              className="text-ink-quiet hover:text-ink"
              aria-label="Clear focus"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        <div className="flex-1" />
        <Button onClick={() => runDistillation()} disabled={!canGenerate}>
          Generate careers from this chat →
        </Button>
        <Button variant="outline" onClick={startOver}>
          Start over
        </Button>
      </div>

      <ChatMessageList messages={messages} />
      <ChatComposer
        onSend={handleSend}
        onPaperclip={() => setPaperclipOpen(true)}
        onLookUp={handleLookUp}
        disabled={sending}
        onOdyssey={handleOdyssey}
        odysseyDisabled={distilling || userMessageCount < 3}
        onBoard={handleBoard}
        boardDisabled={distilling || userMessageCount < 3}
      />
      <PaperclipMenu open={paperclipOpen} onClose={() => setPaperclipOpen(false)} />
      <ProfileReviewModal
        open={reviewOpen}
        profile={reviewProfile}
        trimmed={reviewTrimmed}
        onAccept={handleAcceptProfile}
        onRedistill={(g) => runDistillation(g)}
        onCancel={() => setReviewOpen(false)}
      />
      <Toaster />
    </div>
  );
}

// =====================================================================
// PaperclipMenu — renderer-local copy of components/chat/PaperclipMenu.tsx
// =====================================================================
//
// The legacy paperclip component called fetch('/api/parsePdf') directly,
// which is a Next.js route and doesn't exist in the renderer. We replace
// that with extractTextFromFile from services/file-upload.ts, which routes
// through the IPC bridge to pdf-parse/mammoth in the main process.

type PaperclipMode = 'menu' | 'text' | 'title';

function PaperclipMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<PaperclipMode>('menu');
  const [textValue, setTextValue] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const store = useSessionStore();

  if (!open) return null;

  function close() {
    setMode('menu');
    setTextValue('');
    setTitleValue('');
    onClose();
  }

  async function handleResume() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.md,.markdown,.txt,.docx,.doc';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!isSupportedFile(file.name)) {
        toast.error('Unsupported file type.');
        return;
      }
      try {
        const { text, filename } = await extractTextFromFile(file);
        store.setResume(text, filename);
        store.addChatMessage({
          role: 'system',
          kind: 'attachment-summary',
          content: `Attached resume: ${filename} (${text.length} chars)`,
        });
        close();
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : 'Could not parse that file.'
        );
      }
    };
    input.click();
  }

  function submitText() {
    const t = textValue.trim();
    if (!t) return;
    store.addChatMessage({ role: 'user', content: t });
    store.setFreeText(t);
    close();
  }

  function submitTitle() {
    const t = titleValue.trim();
    if (!t) return;
    store.setJobTitle(t);
    store.addChatMessage({
      role: 'user',
      content: `I'm curious about becoming a ${t}.`,
    });
    close();
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-end md:items-center justify-center z-50">
      <div className="bg-paper border border-border rounded-lg p-6 w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[var(--text-lg)] font-semibold text-ink">
            Add context
          </h2>
          <button onClick={close} className="text-ink-quiet hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'menu' && (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={handleResume}
              className="justify-start"
            >
              <FileText className="w-4 h-4 mr-2" /> Attach resume file
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode('text')}
              className="justify-start"
            >
              <Type className="w-4 h-4 mr-2" /> Paste text
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode('title')}
              className="justify-start"
            >
              <Briefcase className="w-4 h-4 mr-2" /> Add job title
            </Button>
          </div>
        )}

        {mode === 'text' && (
          <div className="flex flex-col gap-3">
            <Textarea
              rows={5}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Paste anything: a description, a transcript, notes…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMode('menu')}>
                Back
              </Button>
              <Button onClick={submitText} disabled={!textValue.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}

        {mode === 'title' && (
          <div className="flex flex-col gap-3">
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder="e.g., Data Analyst"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMode('menu')}>
                Back
              </Button>
              <Button onClick={submitTitle} disabled={!titleValue.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
