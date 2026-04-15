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
    switch (actionId) {
      case 'careers':
        return 'Uses any material you provide above.';
      case 'chat':
        return 'Starts open. You can attach material during the chat.';
      case 'gaps':
        return 'Needs a target (job title or job advert) and a profile (resume or about you).';
      case 'learn':
        return 'Needs a target (job title or job advert). Uses profile for context.';
      case 'interview':
        return 'Needs a target (job title or job advert). Uses profile for context.';
      case 'odyssey':
        return 'Optional. You can brainstorm three lives with or without a profile.';
      case 'board':
        return 'Needs a profile (resume, about you, or distilled profile).';
    }
  }

  return (
    <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-2 leading-snug'>
      {line()}
    </p>
  );
}
