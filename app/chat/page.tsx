'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, type StudentProfile } from '@/lib/session-store';
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import PaperclipMenu from '@/components/chat/PaperclipMenu';
import ProfileReviewModal from '@/components/chat/ProfileReviewModal';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function ChatPage() {
  const router = useRouter();
  const store = useSessionStore();
  const messages = store.chatMessages;

  const [sending, setSending] = useState(false);
  const [paperclipOpen, setPaperclipOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProfile, setReviewProfile] = useState<StudentProfile | null>(null);
  const [reviewTrimmed, setReviewTrimmed] = useState(false);
  const [distilling, setDistilling] = useState(false);

  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 3 && !distilling;

  async function handleSend(text: string) {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    store.addChatMessage({ role: 'user', content: text });
    setSending(true);
    try {
      const llmConfig = await loadLLMConfig();
      const currentMessages = useSessionStore.getState().chatMessages;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          currentFocus: useSessionStore.getState().currentFocus,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Chat failed');
      }
      const { reply, trimmed } = (await res.json()) as {
        reply: string;
        trimmed: boolean;
      };
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

  async function runDistillation(guidance?: string) {
    setDistilling(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/distillProfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: useSessionStore.getState().chatMessages,
          resume: store.resumeText ?? undefined,
          freeText: store.freeText || undefined,
          jobTitle: store.jobTitle || undefined,
          guidance,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Distillation failed');
      }
      const { profile, trimmed } = (await res.json()) as {
        profile: StudentProfile;
        trimmed: boolean;
      };
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

  function handleAcceptProfile(profile: StudentProfile) {
    store.setDistilledProfile(profile);
    store.setCareers(null);
    setReviewOpen(false);
    router.push('/careers');
  }

  // On mount, if the landing page staged a pending message, send it once.
  const pendingHandledRef = useRef(false);
  useEffect(() => {
    if (pendingHandledRef.current) return;
    const pending = useSessionStore.getState().pendingChatMessage;
    if (!pending) return;
    pendingHandledRef.current = true;
    useSessionStore.getState().setPendingChatMessage(null);
    handleSend(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col'>
      <ChatTopBar
        onGenerateCareers={() => runDistillation()}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <ChatComposer
        onSend={handleSend}
        onPaperclip={() => setPaperclipOpen(true)}
        disabled={sending}
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
