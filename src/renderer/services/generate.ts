// Structured generation — the shared core that turns a typed input into a
// typed result via the chat() client. See CONTEXT.md ("structured
// generation", "trim ladder").
//
// Two tiers:
//   callStructured(spec)     One attempt: build messages -> chat() -> parse.
//                            Used directly by single-shot callers that never
//                            trim (e.g. suggestCareers, suggestLife).
//   generate(spec, ladder)   callStructured wrapped in a trim ladder that
//                            retries on token-limit errors and reports whether
//                            the input was trimmed.
//
// This replaces the per-feature callOnce wrapper + hand-written nested
// try/catch retry that every feature service used to carry.

import { chat, type ChatMessage, type ResponseFormat } from './llm';
import { isTokenLimitError } from '@/lib/token-limit';

export type GenSpec<I, T> = {
  // The feature input. The trim ladder shrinks this between attempts; messages
  // and the parser are both derived from the current (possibly trimmed) value.
  input: I;
  buildMessages: (input: I) => ChatMessage[];
  // Receives the current input so parsers that need it (e.g. compare, which
  // shapes its result from the trimmed targets) can read it.
  parse: (raw: string, input: I) => T;
  // Defaults to { type: 'json_object' }. Pass { type: 'text' } for free-text
  // features (portfolio HTML, conversational turns) — see callStructured for
  // how 'text' maps onto the wire.
  responseFormat?: ResponseFormat;
  temperature?: number;
};

/** One attempt: build messages, call the model, parse the reply. No retry. */
export async function callStructured<I, T>(spec: GenSpec<I, T>): Promise<T> {
  // Default to JSON mode. 'text' means "no JSON mode": omit response_format
  // entirely, matching the legacy features (portfolio, chat turns) that never
  // set it. chat() only forwards response_format when present, so omitting is
  // 1:1 with the old behaviour — sending { type: 'text' } would not be.
  const responseFormat = spec.responseFormat ?? { type: 'json_object' };
  const result = await chat({
    messages: spec.buildMessages(spec.input),
    ...(responseFormat.type === 'json_object'
      ? { response_format: responseFormat }
      : {}),
    ...(spec.temperature !== undefined ? { temperature: spec.temperature } : {}),
  });
  return spec.parse(result.content, spec.input);
}

export type TrimLadder<I> = {
  // Applied cumulatively: each step receives the output of the previous one.
  // Order is the trim order — cheapest/least-lossy trims first.
  steps: Array<(input: I) => I>;
  // Thrown when every step has been tried and the model still reports a
  // token-limit error. Omit to rethrow the underlying LLM error instead
  // (conversational callers prefer the raw error).
  tooLongMessage?: string;
};

export type GenerateResult<T> = { result: T; trimmed: boolean };

/**
 * callStructured wrapped in a trim ladder.
 *
 * Tries the input as-is; on a token-limit error it applies the next trim step
 * and retries, walking the ladder until a step succeeds or the steps run out.
 * Non-token-limit errors propagate immediately. When the ladder is exhausted,
 * throws `tooLongMessage` if set, otherwise rethrows the last LLM error.
 *
 * `trimmed` is true once any step has been applied — surface it to tell the
 * user their input was shortened to fit.
 */
export async function generate<I, T>(
  spec: GenSpec<I, T>,
  ladder: TrimLadder<I>
): Promise<GenerateResult<T>> {
  let current = spec.input;
  let trimmed = false;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= ladder.steps.length; attempt++) {
    try {
      const result = await callStructured({ ...spec, input: current });
      return { result, trimmed };
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      lastErr = err;
      if (attempt === ladder.steps.length) break; // ladder exhausted
      current = ladder.steps[attempt](current);
      trimmed = true;
    }
  }

  if (ladder.tooLongMessage) throw new Error(ladder.tooLongMessage);
  throw lastErr;
}
