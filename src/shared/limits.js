// @ts-check
// Limits shared between the renderer (pre-flight checks with friendly
// errors) and the main process (the enforcing boundary — renderer checks
// can be bypassed). CommonJS so src/main can require() it; Vite handles
// the import on the renderer side, same as providers.js.

// Resumes are kilobytes; anything beyond this is a mistake or an attack,
// and pdf-parse/mammoth can hang or exhaust memory on huge inputs.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

module.exports = { MAX_FILE_BYTES };
