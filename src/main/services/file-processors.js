// @ts-check
// File parsing — Node-only because pdf-parse and mammoth both depend on
// libs that don't exist in browser environments. Lives in main process,
// called from renderer via IPC.

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { MAX_FILE_BYTES } = require('../../shared/limits');

/** @param {Buffer} buffer */
function assertWithinLimit(buffer) {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(
      `File is too large (${Math.round(buffer.length / 1024 / 1024)}MB; limit is ${MAX_FILE_BYTES / 1024 / 1024}MB)`
    );
  }
}

// Port of lib/utils.ts normalizeText. Applied inside the parsers so callers
// get the same whitespace-cleaned text the legacy /api/parsePdf route did.
// Without this, renderer pages that currently rely on normalized PDF/DOCX
// text would silently regress after Phase 3 cutover.
/** @param {string} input */
function normalize(input) {
  return input.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
}

/** @param {unknown} buffer */
async function parsePdf(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parsePdf requires a Node Buffer');
  }
  assertWithinLimit(buffer);
  const data = await pdfParse(buffer);
  return normalize(data.text);
}

/** @param {unknown} buffer */
async function parseDocx(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parseDocx requires a Node Buffer');
  }
  assertWithinLimit(buffer);
  const result = await mammoth.extractRawText({ buffer });
  return normalize(result.value);
}

module.exports = { parsePdf, parseDocx };
