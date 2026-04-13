'use client';

import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import InterviewSetupCard from '@/components/interview/InterviewSetupCard';
import InterviewChat from '@/components/interview/InterviewChat';
import InterviewFeedbackView from '@/components/interview/InterviewFeedbackView';

export default function InterviewPage() {
  const store = useSessionStore();
  const messages = store.interviewMessages;
  const feedback = store.interviewFeedback;

  // State precedence: feedback > chat > setup card
  const showFeedback = !!feedback;
  const showChat = !showFeedback && messages.length > 0;
  const showSetupCard = !showFeedback && !showChat;

  // Pre-fill target for the setup card from existing inputs.
  // Job advert wins (if present, take its first non-empty line).
  // Otherwise fall back to jobTitle, then any prior interviewTarget.
  function deriveInitialTarget(): string {
    if (store.jobAdvert && store.jobAdvert.trim()) {
      const firstLine = store.jobAdvert.trim().split('\n').find((l) => l.trim());
      if (firstLine) return firstLine.slice(0, 100);
    }
    if (store.jobTitle && store.jobTitle.trim()) return store.jobTitle.trim();
    if (store.interviewTarget) return store.interviewTarget;
    return '';
  }

  return (
    <div className='h-full overflow-y-auto'>
      {showSetupCard && <InterviewSetupCard initialTarget={deriveInitialTarget()} />}
      {showChat && <InterviewChat onFeedbackReady={() => { /* no-op; store change re-renders */ }} />}
      {showFeedback && feedback && <InterviewFeedbackView feedback={feedback} />}
      <Toaster />
    </div>
  );
}
