// Incremental Server-Sent-Events parsing for streamed LLM responses. IPC
// chunks arrive at arbitrary boundaries — possibly mid-line — so the parser
// buffers until newline and emits each complete `data:` payload.

export type SSEDataHandler = (payload: string) => void;

// Returns a push function; feed it raw text chunks. `data:` payloads are
// delivered to onData; the OpenAI-style "[DONE]" sentinel is swallowed.
export function createSSEParser(onData: SSEDataHandler): (chunk: string) => void {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload && payload !== '[DONE]') onData(payload);
      }
      newline = buffer.indexOf('\n');
    }
  };
}

// Ollama's native /api/chat streams newline-delimited JSON objects (no
// `data:` prefix, no [DONE] sentinel — the last object carries done:true).
// Same buffering contract as the SSE parser: feed raw chunks, complete
// lines are delivered as payloads.
export function createNDJSONParser(onData: SSEDataHandler): (chunk: string) => void {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, '').trim();
      buffer = buffer.slice(newline + 1);
      if (line) onData(line);
      newline = buffer.indexOf('\n');
    }
  };
}

// Per-provider-family token extractors. Each takes one parsed SSE JSON
// payload and returns the text delta it carries ('' when the event is
// bookkeeping, e.g. anthropic message_start / openai role priming).

export function openAIDelta(data: any): string {
  return data?.choices?.[0]?.delta?.content ?? '';
}

export function anthropicDelta(data: any): string {
  if (data?.type === 'content_block_delta') return data?.delta?.text ?? '';
  return '';
}

export function geminiDelta(data: any): string {
  const parts: Array<{ text?: string }> = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p?.text ?? '').join('');
}

// Ollama native /api/chat delta. Thinking tokens arrive separately in
// message.thinking and are deliberately not surfaced — only the answer.
export function ollamaNativeDelta(data: any): string {
  return data?.message?.content ?? '';
}
