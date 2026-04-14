'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, type StudentProfile, type SourceRef } from '@/lib/session-store';
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
  const canGenerate = userMessageCount >= 1 && !distilling;

  async function handleSend(text: string, searchSources?: SourceRef[]) {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    store.addChatMessage({ role: 'user', content: text });
    setSending(true);
    try {
      const llmConfig = await loadLLMConfig();
      const currentMessages = useSessionStore.getState().chatMessages;
      const stateNow = useSessionStore.getState();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          currentFocus: stateNow.currentFocus,
          resumeText: stateNow.resumeText,
          freeText: stateNow.freeText,
          jobTitle: stateNow.jobTitle,
          jobAdvert: stateNow.jobAdvert,
          searchSources,
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

  async function handleLookUp(query: string) {
    try {
      const res = await fetch('/api/chatSearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error('Look-up failed');
      const { results } = (await res.json()) as { results: SourceRef[] };

      await handleSend(query, results);

      if (results.length > 0) {
        const latestMessages = useSessionStore.getState().chatMessages;
        const lastAssistant = [...latestMessages]
          .reverse()
          .find((m) => m.role === 'assistant');
        if (lastAssistant) {
          useSessionStore.getState().setChatSourcesForMessage(lastAssistant.id, results);
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

  async function handleOdyssey() {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
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
          guidance:
            'Produce a one-to-two sentence aspirational summary suitable as the opening seed for a "Current Path" life in an Odyssey Plan — what the student seems to be heading toward based on this conversation. Write it in first person. Put this in the "background" field.',
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not distil the chat');
      }
      const { profile } = (await res.json()) as { profile: StudentProfile };
      const seedText = profile.background || '';
      const seedLabel = (profile.goals[0] ?? 'Current path').slice(0, 60);
      store.setOdysseySeed('current', seedLabel, seedText);
      router.push('/odyssey');
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : 'Could not set up Odyssey plan from this chat.'
      );
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

  return (
    <div className='h-full flex flex-col'>
      <ChatTopBar
        onGenerateCareers={() => runDistillation()}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <ChatComposer
        onSend={handleSend}
        onPaperclip={() => setPaperclipOpen(true)}
        onLookUp={handleLookUp}
        disabled={sending}
        onOdyssey={handleOdyssey}
        odysseyDisabled={distilling || userMessageCount < 3}
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
