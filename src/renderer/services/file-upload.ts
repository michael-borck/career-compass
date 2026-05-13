// File → text extraction for renderer code. PDF and DOCX cross the IPC bridge
// to the main process (pdf-parse / mammoth are Node-only). Markdown and plain
// text are decoded in-browser via TextDecoder, then run through normalizeText
// so callers see the same whitespace shape as the IPC path.
//
// Supported extensions mirror lib/file-processors.ts plus .markdown and .txt.

import { normalizeText } from './text';

export type FileUploadResult = { text: string; filename: string };

const SUPPORTED_EXTS = ['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt'];

function extOf(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

export function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTS.includes(extOf(filename));
}

export function getSupportedExtensions(): readonly string[] {
  return SUPPORTED_EXTS;
}

export async function extractTextFromFile(file: File): Promise<FileUploadResult> {
  const ext = extOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (ext === '.pdf') {
    const text = await window.electronAPI.parsePdf(bytes);
    return { text, filename: file.name };
  }
  if (ext === '.docx' || ext === '.doc') {
    const text = await window.electronAPI.parseDocx(bytes);
    return { text, filename: file.name };
  }
  if (ext === '.md' || ext === '.markdown' || ext === '.txt') {
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return { text: normalizeText(decoded), filename: file.name };
  }
  throw new Error(`Unsupported file type: ${ext || '(no extension)'}`);
}
