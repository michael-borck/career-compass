// File parsing — Node-only because pdf-parse and mammoth both depend on
// libs that don't exist in browser environments. Lives in main process,
// called from renderer via IPC.

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function parsePdf(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parsePdf requires a Node Buffer');
  }
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parseDocx requires a Node Buffer');
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

module.exports = { parsePdf, parseDocx };
