// Renders an ExportDoc to a Markdown string. One of the two ExportDoc
// adapters (see to-docx.ts for the other).

import type { ExportDoc, Block, Inline } from './doc';

function renderInline(run: Inline): string {
  if (typeof run === 'string') return run;
  let s = run.text;
  if (run.bold) s = `**${s}**`;
  if (run.italic) s = `*${s}*`;
  return s;
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}`;
    case 'paragraph':
      return block.runs.map(renderInline).join('');
    case 'bullets':
      return block.items
        .map((item) => `- ${typeof item === 'string' ? item : item.map(renderInline).join('')}`)
        .join('\n');
    case 'note':
      return `*${block.text}*`;
    case 'sources':
      return block.items
        .map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.domain}`)
        .join('\n');
    case 'disclaimer':
      return `---\n\n*${block.text}*`;
  }
}

export function toMarkdown(doc: ExportDoc): string {
  const parts = [`# ${doc.title}`, ...doc.blocks.map(renderBlock)];
  return parts.join('\n\n') + '\n';
}
