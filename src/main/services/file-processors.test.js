import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePdf, parseDocx } from './file-processors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '__fixtures__');

describe('parsePdf', () => {
  it('rejects non-Buffer input', async () => {
    await expect(parsePdf('not a buffer')).rejects.toThrow(TypeError);
    await expect(parsePdf(new Uint8Array([1, 2, 3]))).rejects.toThrow(TypeError);
  });

  const pdfFixture = resolve(FIXTURES, 'sample.pdf');
  if (existsSync(pdfFixture)) {
    it('extracts text from a real PDF', async () => {
      const buf = readFileSync(pdfFixture);
      const text = await parsePdf(buf);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });
  } else {
    it.skip('extracts text from a real PDF (fixture missing)', () => {});
  }
});

describe('parseDocx', () => {
  it('rejects non-Buffer input', async () => {
    await expect(parseDocx('not a buffer')).rejects.toThrow(TypeError);
    await expect(parseDocx(new Uint8Array([1, 2, 3]))).rejects.toThrow(TypeError);
  });

  it('normalizes whitespace in extracted text', async () => {
    const docxFixture = resolve(FIXTURES, 'sample.docx');
    if (!existsSync(docxFixture)) return;
    const text = await parseDocx(readFileSync(docxFixture));
    // normalize() collapses runs of whitespace to single spaces and trims
    expect(text).not.toMatch(/  /);
    expect(text).toBe(text.trim());
  });

  const docxFixture = resolve(FIXTURES, 'sample.docx');
  if (existsSync(docxFixture)) {
    it('extracts text from a real DOCX', async () => {
      const buf = readFileSync(docxFixture);
      const text = await parseDocx(buf);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });
  } else {
    it.skip('extracts text from a real DOCX (fixture missing)', () => {});
  }
});
