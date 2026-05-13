import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractTextFromFile,
  isSupportedFile,
  getSupportedExtensions,
} from './file-upload';

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    electronAPI: {
      parsePdf: vi.fn(async () => 'pdf text'),
      parseDocx: vi.fn(async () => 'docx text'),
    },
  };
});

function fakeFile(name: string, content = 'hello world'): File {
  return new File([content], name, { type: 'application/octet-stream' });
}

describe('isSupportedFile', () => {
  it('accepts pdf/docx/doc/md/markdown/txt', () => {
    expect(isSupportedFile('a.pdf')).toBe(true);
    expect(isSupportedFile('a.docx')).toBe(true);
    expect(isSupportedFile('a.doc')).toBe(true);
    expect(isSupportedFile('a.md')).toBe(true);
    expect(isSupportedFile('a.markdown')).toBe(true);
    expect(isSupportedFile('a.txt')).toBe(true);
  });

  it('rejects unsupported and missing extensions', () => {
    expect(isSupportedFile('a.zip')).toBe(false);
    expect(isSupportedFile('a.png')).toBe(false);
    expect(isSupportedFile('noext')).toBe(false);
    expect(isSupportedFile('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSupportedFile('A.PDF')).toBe(true);
    expect(isSupportedFile('Resume.DOCX')).toBe(true);
    expect(isSupportedFile('Notes.MD')).toBe(true);
  });
});

describe('getSupportedExtensions', () => {
  it('exposes the canonical extension list', () => {
    expect(getSupportedExtensions()).toEqual([
      '.pdf',
      '.docx',
      '.doc',
      '.md',
      '.markdown',
      '.txt',
    ]);
  });
});

describe('extractTextFromFile', () => {
  it('dispatches .pdf to parsePdf IPC and returns the result', async () => {
    const result = await extractTextFromFile(fakeFile('resume.pdf'));
    expect(result.text).toBe('pdf text');
    expect(result.filename).toBe('resume.pdf');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).electronAPI;
    expect(api.parsePdf).toHaveBeenCalledTimes(1);
    // arg should be a Uint8Array
    expect(api.parsePdf.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
  });

  it('dispatches .docx and .doc to parseDocx IPC', async () => {
    const r1 = await extractTextFromFile(fakeFile('resume.docx'));
    const r2 = await extractTextFromFile(fakeFile('resume.doc'));
    expect(r1.text).toBe('docx text');
    expect(r2.text).toBe('docx text');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).electronAPI.parseDocx).toHaveBeenCalledTimes(2);
  });

  it('decodes .md locally without crossing IPC and normalizes whitespace', async () => {
    // normalizeText collapses any run of whitespace (including newlines) to a
    // single space, then trims. Matches the behavior of the main-process
    // file-processors helper.
    const result = await extractTextFromFile(
      fakeFile('notes.md', '  hello\n\n\nworld  ')
    );
    expect(result.text).toBe('hello world');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).electronAPI;
    expect(api.parsePdf).not.toHaveBeenCalled();
    expect(api.parseDocx).not.toHaveBeenCalled();
  });

  it('decodes .markdown locally', async () => {
    const result = await extractTextFromFile(fakeFile('notes.markdown', 'plain text'));
    expect(result.text).toBe('plain text');
  });

  it('decodes .txt locally', async () => {
    const result = await extractTextFromFile(fakeFile('notes.txt', 'plain text'));
    expect(result.text).toBe('plain text');
  });

  it('is case-insensitive for the dispatch logic', async () => {
    const result = await extractTextFromFile(fakeFile('Resume.PDF'));
    expect(result.text).toBe('pdf text');
  });

  it('throws on unsupported extension', async () => {
    await expect(extractTextFromFile(fakeFile('a.zip'))).rejects.toThrow(
      /Unsupported file type/
    );
  });

  it('throws on missing extension', async () => {
    await expect(extractTextFromFile(fakeFile('noext'))).rejects.toThrow(
      /Unsupported file type/
    );
  });
});
