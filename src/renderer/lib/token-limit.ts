/**
 * Heuristic match for token-limit errors across LLM providers. Used to trigger
 * trim-and-retry fallbacks. Inspect the error's message for known fragments.
 */
export function isTokenLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (
    msg.includes('context length') ||
    msg.includes('context_length') ||
    msg.includes('maximum context') ||
    msg.includes('too many tokens') ||
    msg.includes('token limit') ||
    msg.includes('reduce the length')
  );
}
