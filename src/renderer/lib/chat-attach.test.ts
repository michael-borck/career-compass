// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { attachResultToChat, discussWithAdvisorStep } from './chat-attach';
import { useSessionStore } from './session-store';
import type { ExportDoc } from './export/doc';

const doc = (text: string): ExportDoc => ({
  title: 'Gap Analysis',
  blocks: [{ kind: 'paragraph', runs: [text] }],
});

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe('attachResultToChat', () => {
  it('stores the markdown and announces the attachment once', () => {
    attachResultToChat('your gap analysis', doc('SQL is critical.'));
    const s = useSessionStore.getState();
    expect(s.chatAttachedResults).toHaveLength(1);
    expect(s.chatAttachedResults[0].markdown).toContain('SQL is critical.');
    expect(s.chatMessages.filter((m) => m.kind === 'attachment-summary')).toHaveLength(1);

    // Re-attaching identical content does not spam the transcript.
    attachResultToChat('your gap analysis', doc('SQL is critical.'));
    expect(useSessionStore.getState().chatMessages).toHaveLength(1);
    expect(useSessionStore.getState().chatAttachedResults).toHaveLength(1);
  });

  it('replaces the entry and re-announces when the result changed', () => {
    attachResultToChat('your gap analysis', doc('Version one.'));
    attachResultToChat('your gap analysis', doc('Version two.'));
    const s = useSessionStore.getState();
    expect(s.chatAttachedResults).toHaveLength(1);
    expect(s.chatAttachedResults[0].markdown).toContain('Version two.');
    expect(s.chatMessages).toHaveLength(2);
  });

  it('keeps different results side by side', () => {
    attachResultToChat('your gap analysis', doc('Gaps.'));
    attachResultToChat('your learning path', doc('Path.'));
    expect(useSessionStore.getState().chatAttachedResults).toHaveLength(2);
  });
});

describe('discussWithAdvisorStep', () => {
  it('produces a /chat step whose preNavigate attaches the result', () => {
    const step = discussWithAdvisorStep('your values compass', () => doc('Autonomy.'));
    expect(step.path).toBe('/chat');
    step.preNavigate();
    expect(useSessionStore.getState().chatAttachedResults[0].title).toBe('your values compass');
  });
});
