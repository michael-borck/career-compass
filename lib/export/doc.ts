// ExportDoc — a format-neutral representation of a feature's exportable
// content. Each feature builds one ExportDoc (see lib/export/features/*); the
// renderers turn it into a .docx Blob (to-docx.ts) or a Markdown string
// (to-markdown.ts). This is the single seam that replaces the per-feature
// components/**/*-docx.ts builders and the parallel functions in
// markdown-export.ts, so a feature's export content is defined once and both
// formats follow.
//
// See CONTEXT.md ("ExportDoc").

export type Inline = string | { text: string; bold?: boolean; italic?: boolean };

export type Block =
  | { kind: 'heading'; level: 2 | 3; text: string } // level 1 is the doc title
  | { kind: 'paragraph'; runs: Inline[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'note'; text: string } // italic aside
  | { kind: 'disclaimer'; text: string }; // grey footer, set off by a rule

export type ExportDoc = {
  title: string; // rendered as the H1 / docx Heading 1
  blocks: Block[];
};

// --- construction helpers (keep the feature converters terse) ---

export const b = (text: string): Inline => ({ text, bold: true });
export const it = (text: string): Inline => ({ text, italic: true });

export const h2 = (text: string): Block => ({ kind: 'heading', level: 2, text });
export const h3 = (text: string): Block => ({ kind: 'heading', level: 3, text });
export const p = (...runs: Inline[]): Block => ({ kind: 'paragraph', runs });
export const bullets = (items: string[]): Block => ({ kind: 'bullets', items });
export const note = (text: string): Block => ({ kind: 'note', text });
export const disclaimer = (text: string): Block => ({ kind: 'disclaimer', text });
