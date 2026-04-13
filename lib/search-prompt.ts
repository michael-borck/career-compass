import type { SourceRef } from './session-store';

export function formatSourcesForFootnote(sources: SourceRef[]): string {
  if (sources.length === 0) return '';
  const lines = sources.map(
    (s, i) => `[${i + 1}] ${s.title} (${s.domain}) — ${s.url}`
  );
  return `<sources>
The following current web sources were retrieved for this task. You may draw on them to make your answer more accurate and up-to-date. You do not need to cite them inline; they will be shown to the student as a separate list at the end.

${lines.join('\n')}
</sources>`;
}

export function formatSourcesForInlineCite(sources: SourceRef[]): string {
  if (sources.length === 0) return '';
  const lines = sources.map(
    (s, i) => `[${i + 1}] ${s.title} (${s.domain}) — ${s.url}`
  );
  return `<sources>
The following current web sources were retrieved for this task. When you state a specific factual claim that came from one of these sources (salary numbers, timelines, specific requirements), add the source number as an inline marker like [1] or [2] at the end of the claim. Only cite when the source actually supports the claim — never fabricate a citation. If a claim is general knowledge, do not add a marker.

${lines.join('\n')}
</sources>`;
}
