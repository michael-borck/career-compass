// File parsing — Node-only because pdf-parse and mammoth both depend on
// libs that don't exist in browser environments. Lives in main process,
// called from renderer via IPC.

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Port of lib/utils.ts normalizeText. Applied inside the parsers so callers
// get the same whitespace-cleaned text the legacy /api/parsePdf route did.
// Without this, renderer pages that currently rely on normalized PDF/DOCX
// text would silently regress after Phase 3 cutover.
function normalize(input) {
  return input.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
}

async function parsePdf(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parsePdf requires a Node Buffer');
  }
  const data = await pdfParse(buffer);
  return normalize(data.text);
}

async function parseDocx(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parseDocx requires a Node Buffer');
  }
  const result = await mammoth.extractRawText({ buffer });
  return normalize(result.value);
}

module.exports = { parsePdf, parseDocx };
