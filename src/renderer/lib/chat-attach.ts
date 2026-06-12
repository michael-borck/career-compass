// "Discuss with advisor" — attaches a feature result to the chat so the
// advisor can talk about it. The result rides into the LLM via the context
// block (attachment-summary messages are UI chrome only and never reach the
// model); the chat shows a small attachment marker so the student sees what
// the advisor knows.

import { useSessionStore } from '@/lib/session-store';
import { toMarkdown } from '@/lib/export/to-markdown';
import type { ExportDoc } from '@/lib/export/doc';

export function attachResultToChat(title: string, doc: ExportDoc): void {
  const store = useSessionStore.getState();
  const markdown = toMarkdown(doc);
  const existing = store.chatAttachedResults.find((r) => r.title === title);
  store.attachChatResult({ title, markdown });
  // Only announce in the transcript when this is new or the content changed —
  // re-clicking the button shouldn't spam attachment markers.
  if (!existing || existing.markdown !== markdown) {
    store.addChatMessage({
      role: 'system',
      kind: 'attachment-summary',
      content: `Attached ${title} to the conversation`,
    });
  }
}

// Builds the NextSteps entry used by result pages. `buildDoc` is lazy so the
// (cheap but non-trivial) ExportDoc render happens only on click.
export function discussWithAdvisorStep(title: string, buildDoc: () => ExportDoc) {
  return {
    title: 'Discuss with advisor',
    description: 'Bring this result into the chat.',
    path: '/chat',
    preNavigate: () => attachResultToChat(title, buildDoc()),
  };
}
