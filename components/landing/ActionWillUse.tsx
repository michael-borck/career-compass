'use client';

import { useSessionStore } from '@/lib/session-store';

export type ActionId = 'careers' | 'chat' | 'gaps' | 'learn' | 'interview' | 'odyssey' | 'board';

type Props = {
  actionId: ActionId;
};

export default function ActionWillUse({ actionId }: Props) {
  const store = useSessionStore();
  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasJobTitle = !!store.jobTitle.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();
  const hasDistilled = !!store.distilledProfile;
  const hasProfile = hasResume || hasFreeText || hasDistilled;

  function line(): string {
    const filled: string[] = [];
    if (hasResume) filled.push('resume');
    if (hasFreeText) filled.push('about you');
    if (hasJobTitle) filled.push('job title');
    if (hasJobAdvert) filled.push('job advert');
    const hasTarget = hasJobTitle || hasJobAdvert;

    switch (actionId) {
      case 'careers': {
        if (filled.length === 0 && !hasDistilled) return 'Needs any material above.';
        if (filled.length === 0) return 'Will use your distilled profile.';
        return `Will use: ${filled.join(', ')}.`;
      }
      case 'chat': {
        if (filled.length === 0) return 'Starts open. Attach material any time during the chat.';
        return `Will start with: ${filled.join(', ')}. Attach more during the chat.`;
      }
      case 'gaps': {
        if (!hasTarget && !hasProfile) {
          return 'Needs a target (job title or job advert) and a profile (resume or about you).';
        }
        if (!hasTarget) return 'Needs a target (job title or job advert).';
        if (!hasProfile) return 'Needs a profile (resume or about you).';
        return `Will use: ${filled.join(', ')}.`;
      }
      case 'learn':
      case 'interview': {
        if (!hasTarget) return 'Needs a target (job title or job advert).';
        return `Will use: ${filled.join(', ')}.`;
      }
      case 'odyssey': {
        if (filled.length === 0 && !hasDistilled) {
          return 'Optional. Brainstorm three lives unaided, or add material above for richer suggestions.';
        }
        if (filled.length === 0) return 'Will use your distilled profile for suggestions.';
        return `Will use: ${filled.join(', ')} for suggestions.`;
      }
      case 'board': {
        if (!hasProfile) return 'Needs a profile (resume or about you).';
        return `Will use: ${filled.join(', ')}.`;
      }
    }
  }

  return (
    <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-2 leading-snug'>
      {line()}
    </p>
  );
}
