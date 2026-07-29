// Provider-agnostic chat client for the renderer process. All network IO
// goes through window.electronAPI.apiFetch (Electron's net module in main),
// which sidesteps the browser's CORS preflight machinery.
//
// API key sourcing matches app/settings/page.tsx + lib/settings-store.ts:
//   secureStorage.getPassword('career-compass-llm-<provider>')
//   legacy fallback: 'career-compass-<provider>'   (older installs)
//   env var fallback: OPENAI_API_KEY / ANTHROPIC_API_KEY / GROQ_API_KEY /
//                     GOOGLE_API_KEY / OPENROUTER_API_KEY
//
// Settings shape comes from electron-store key 'settings', initialized in
// src/main/index.js (mirrored from electron/main.js) with defaults
// { provider: 'ollama', baseURL: 'http://localhost:11434/v1', model: '' }.
//
// Provider request/response shapes mirror lib/llm-providers.ts (legacy),
// with the addition of native Gemini support per Phase 3 spec.

import { PROVIDERS } from '../../shared/providers';
import {
  createSSEParser,
  createNDJSONParser,
  openAIDelta,
  anthropicDelta,
  geminiDelta,
  ollamaNativeDelta,
} from './sse';

export type Provider = 'ollama' | 'openai' | 'claude' | 'groq' | 'gemini' | 'openrouter' | 'custom';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ResponseFormat = { type: 'json_object' } | { type: 'text' };

export type ChatOptions = {
  messages: ChatMessage[];
  temperature?: number;
  response_format?: ResponseFormat;
  maxTokens?: number;
};

export type ChatResult = {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
};

export class LLMError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.body = body;
  }
}

// Gating check used by every LLM page before invoking chat(). Returns true if
// settings have a non-empty model selected. Pages should call this from inside
// runGeneration and route to /settings if false.
export async function isConfigured(): Promise<boolean> {
  try {
    const raw = await window.electronAPI.store.get<Partial<Settings>>('settings', DEFAULT_SETTINGS);
    const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
    return !!(merged.model && merged.model.trim());
  } catch {
    return false;
  }
}

type Settings = {
  provider: Provider;
  baseURL: string;
  model: string;
  // Allow thinking models to run their reasoning phase before answering.
  allowThinking: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  provider: 'ollama',
  baseURL: '',
  model: '',
  allowThinking: false,
};

// Default base URLs for the OpenAI-compatible dispatch live in the shared
// provider registry. Only consulted when settings.baseURL is empty — explicit
// user values win. claude/gemini use bespoke URLs in their own dispatch
// branches (their registry defaultBaseURL is null).
function resolveBaseURL(provider: Provider, settingsBaseURL: string): string {
  const fromSettings = settingsBaseURL.trim();
  const fromDefault = PROVIDERS[provider].defaultBaseURL;

  if (provider === 'custom') {
    if (!fromSettings) {
      throw new LLMError('Custom provider requires a server address in Settings', 0, '');
    }
    return fromSettings;
  }
  if (fromSettings) return fromSettings;
  if (fromDefault) return fromDefault;
  throw new LLMError(`${PROVIDERS[provider].label} has no baseURL configured`, 0, '');
}

const DEFAULT_MAX_TOKENS = 4096;

async function loadSettings(): Promise<Settings> {
  const raw = await window.electronAPI.store.get<Partial<Settings>>('settings', DEFAULT_SETTINGS);
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  // Carry forward the pre-0.6.3 name for this setting, as lib/settings-store
  // does — otherwise a stored `ollamaThink: true` would be honoured by the
  // Settings page but ignored here.
  const legacyThink = (raw as { ollamaThink?: unknown } | null)?.ollamaThink;
  if ((raw as { allowThinking?: unknown } | null)?.allowThinking === undefined) {
    if (typeof legacyThink === 'boolean') merged.allowThinking = legacyThink;
  }
  return merged;
}

async function loadApiKey(provider: Provider): Promise<string | null> {
  // Primary key, as written by lib/settings-store.ts ElectronSecureStorage.
  const primary = await window.electronAPI.secureStorage.getPassword(
    `career-compass-llm-${provider}`
  );
  if (primary) return primary;

  // Migration fallback: older installs stored LLM keys without the namespace.
  const legacy = await window.electronAPI.secureStorage.getPassword(`career-compass-${provider}`);
  if (legacy) return legacy;

  // Env var fallback (matches electron/main.js test-connection handler).
  const envVar = PROVIDERS[provider].envVar;
  if (envVar) {
    const fromEnv = await window.electronAPI.getEnvVar(envVar);
    if (fromEnv) return fromEnv;
  }

  return null;
}

function requireApiKey(provider: Provider, key: string | null): string {
  if (!key) {
    throw new LLMError(`${PROVIDERS[provider].label} API key not configured in Settings`, 0, '');
  }
  return key;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

// Build the OpenAI-compatible chat/completions request body.
function buildOpenAIBody(model: string, options: ChatOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (options.response_format) body.response_format = options.response_format;
  return body;
}

// ---------------------------------------------------------------------------
// Thinking suppression
//
// Every provider that fronts a reasoning model spells "answer directly, don't
// reason first" differently, so the "Allow model thinking" setting can't be one
// parameter. Each entry pairs the body mutation with the pattern identifying a
// server that rejects it — the call paths below apply it, and on a 4xx naming
// the param, undo it and retry once. Suppression is always best-effort: some
// models can't turn reasoning off at all, and some servers accept the param and
// ignore it.
//
// Ollama is absent because its native /api/chat takes a plain `think` boolean
// that buildOllamaNativeBody always sets (see callOllamaNative).
type ThinkingSuppressor = {
  apply: (body: Record<string, unknown>) => void;
  undo: (body: Record<string, unknown>) => void;
  // Matches the provider's error text when it won't accept the param.
  rejection: RegExp;
};

// OpenAI-standard reasoning_effort. Ollama's /v1 shim maps "none" to
// think:false; Groq accepts it only on models that can skip reasoning (the
// gpt-oss family rejects it, which the retry handles).
const REASONING_EFFORT_NONE: ThinkingSuppressor = {
  apply: (body) => {
    body.reasoning_effort = 'none';
  },
  undo: (body) => {
    delete body.reasoning_effort;
  },
  rejection: /reasoning_effort/i,
};

const THINKING_SUPPRESSORS: Partial<Record<Provider, ThinkingSuppressor>> = {
  openai: REASONING_EFFORT_NONE,
  groq: REASONING_EFFORT_NONE,
  custom: REASONING_EFFORT_NONE,
  // OpenRouter wraps the same idea in its own object.
  openrouter: {
    apply: (body) => {
      body.reasoning = { effort: 'none' };
    },
    undo: (body) => {
      delete body.reasoning;
    },
    rejection: /reasoning/i,
  },
  // Anthropic: thinking is opt-in on Claude 4.x but ON BY DEFAULT on the
  // Claude 5 family, so omitting the field is not the same as off. Rejected
  // outright on models where thinking can't be disabled.
  claude: {
    apply: (body) => {
      body.thinking = { type: 'disabled' };
    },
    undo: (body) => {
      delete body.thinking;
    },
    rejection: /thinking/i,
  },
  // Gemini nests it, and "minimal" is the floor — there is no true off, and
  // the Pro models won't go below "low" (they 4xx, and we retry without).
  gemini: {
    apply: (body) => {
      const generationConfig = (body.generationConfig ?? {}) as Record<string, unknown>;
      generationConfig.thinkingConfig = { thinkingLevel: 'minimal' };
      body.generationConfig = generationConfig;
    },
    undo: (body) => {
      const generationConfig = body.generationConfig as Record<string, unknown> | undefined;
      if (generationConfig) delete generationConfig.thinkingConfig;
    },
    rejection: /thinking/i,
  },
};

// The suppressor to apply for this request, or null when thinking is allowed
// (or the provider has no way to express it).
function thinkingSuppressor(provider: Provider, allowThinking: boolean): ThinkingSuppressor | null {
  return allowThinking ? null : (THINKING_SUPPRESSORS[provider] ?? null);
}

function parseJsonOrThrow(provider: Provider, resp: { status: number; body: string }): unknown {
  try {
    return JSON.parse(resp.body);
  } catch {
    throw new LLMError(
      `${PROVIDERS[provider].label} returned malformed JSON`,
      resp.status,
      resp.body
    );
  }
}

function parseOpenAIResponse(
  provider: Provider,
  resp: { status: number; body: string }
): ChatResult {
  const data = parseJsonOrThrow(provider, resp) as any;
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      }
    : undefined;
  return { content, usage };
}

async function callOpenAICompatible(args: {
  provider: Provider;
  baseURL: string;
  apiKey: string | null;
  model: string;
  options: ChatOptions;
  // Applied when the "Allow model thinking" setting is off; see
  // THINKING_SUPPRESSORS. Servers that reject it get one retry without.
  suppress?: ThinkingSuppressor | null;
}): Promise<ChatResult> {
  const { provider, baseURL, apiKey, model, options, suppress } = args;
  const url = `${stripTrailingSlash(baseURL)}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Ollama/custom servers only get a key when one is configured (e.g. behind
  // an auth proxy); other providers must have a key (enforced upstream).
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const bodyObj = buildOpenAIBody(model, options);
  suppress?.apply(bodyObj);

  const attempt = async (payload: Record<string, unknown>) => {
    try {
      return await window.electronAPI.apiFetch({
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        // LLM requests legitimately run 30-60s; this bounds the worst case.
        timeoutMs: 60000,
      });
    } catch (err) {
      throw new LLMError(
        `Network error contacting ${PROVIDERS[provider].label}: ${err instanceof Error ? err.message : String(err)}`,
        0,
        ''
      );
    }
  };

  let resp = await attempt(bodyObj);
  if (!resp.ok && suppress && isParamRejection(resp.status, resp.body, suppress.rejection)) {
    suppress.undo(bodyObj);
    resp = await attempt(bodyObj);
  }
  if (!resp.ok) {
    throw new LLMError(
      `${PROVIDERS[provider].label} request failed: ${resp.status} ${resp.statusText || ''}`.trim(),
      resp.status,
      resp.body
    );
  }
  return parseOpenAIResponse(provider, resp);
}

// ---------------------------------------------------------------------------
// Ollama native /api/chat
//
// Ollama chat goes through the native endpoint rather than the OpenAI-compat
// /v1 shim. Both can stop "thinking" models (qwen3.5, gemma4, …) from
// reasoning before answering — natively via `think: false`, on /v1 via the
// OpenAI-standard `reasoning_effort: "none"` (which the shim maps to the
// same switch; the custom provider path uses that form). Native is used here
// for its extras: exact token counts, format:"json" enforcement, and
// per-call keep_alive if we ever pin models. Model listing and connection
// tests already use native endpoints (/api/tags).

// Settings store the baseURL in OpenAI form (…/v1); the native API lives at
// the server root.
function ollamaRootURL(baseURL: string): string {
  return stripTrailingSlash(baseURL).replace(/\/v1$/, '');
}

function buildOllamaNativeBody(
  model: string,
  options: ChatOptions,
  think: boolean,
  stream: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    stream,
    think,
  };
  const modelOptions: Record<string, unknown> = {};
  if (options.temperature !== undefined) modelOptions.temperature = options.temperature;
  if (options.maxTokens !== undefined) modelOptions.num_predict = options.maxTokens;
  if (Object.keys(modelOptions).length > 0) body.options = modelOptions;
  if (options.response_format?.type === 'json_object') body.format = 'json';
  return body;
}

function ollamaHeaders(apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Optional: only shared/remote servers behind an auth proxy need a key.
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

// Thinking-suppression params (`think` on the native API, `reasoning_effort`
// on OpenAI-compatible servers) are best-effort: some server versions or
// models reject them. On that specific rejection, retry once without.
function isParamRejection(status: number, body: string, param: RegExp): boolean {
  return status >= 400 && status < 500 && param.test(body);
}

async function callOllamaNative(args: {
  baseURL: string;
  apiKey: string | null;
  model: string;
  options: ChatOptions;
  think: boolean;
}): Promise<ChatResult> {
  const { baseURL, apiKey, model, options, think } = args;
  const url = `${ollamaRootURL(baseURL)}/api/chat`;

  const attempt = async (body: Record<string, unknown>) => {
    try {
      return await window.electronAPI.apiFetch({
        url,
        method: 'POST',
        headers: ollamaHeaders(apiKey),
        body: JSON.stringify(body),
        // LLM requests legitimately run 30-60s; this bounds the worst case.
        timeoutMs: 60000,
      });
    } catch (err) {
      throw new LLMError(
        `Network error contacting ${PROVIDERS.ollama.label}: ${err instanceof Error ? err.message : String(err)}`,
        0,
        ''
      );
    }
  };

  let resp = await attempt(buildOllamaNativeBody(model, options, think, false));
  if (!resp.ok && isParamRejection(resp.status, resp.body, /think/i)) {
    const withoutThink = buildOllamaNativeBody(model, options, think, false);
    delete withoutThink.think;
    resp = await attempt(withoutThink);
  }
  if (!resp.ok) {
    throw new LLMError(
      `${PROVIDERS.ollama.label} request failed: ${resp.status} ${resp.statusText || ''}`.trim(),
      resp.status,
      resp.body
    );
  }

  const data = parseJsonOrThrow('ollama', resp) as any;
  const content: string = data?.message?.content ?? '';
  const usage =
    data?.prompt_eval_count !== undefined || data?.eval_count !== undefined
      ? {
          promptTokens: data?.prompt_eval_count ?? 0,
          completionTokens: data?.eval_count ?? 0,
        }
      : undefined;
  return { content, usage };
}

// Anthropic puts the system prompt in a separate top-level `system` field,
// not in the messages array. Concatenate any system messages.
function buildAnthropicBody(model: string, options: ChatOptions): Record<string, unknown> {
  const systemMessages = options.messages.filter((m) => m.role === 'system');
  const nonSystem = options.messages.filter((m) => m.role !== 'system');
  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: nonSystem,
  };
  if (systemMessages.length > 0) {
    body.system = systemMessages.map((m) => m.content).join('\n\n');
  }
  if (options.temperature !== undefined) body.temperature = options.temperature;
  // Anthropic has no equivalent of response_format; omit silently.
  return body;
}

const ANTHROPIC_HEADERS = (apiKey: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
});

async function callAnthropic(args: {
  apiKey: string;
  model: string;
  options: ChatOptions;
  suppress?: ThinkingSuppressor | null;
}): Promise<ChatResult> {
  const { apiKey, model, options, suppress } = args;
  const body = buildAnthropicBody(model, options);
  suppress?.apply(body);

  const attempt = async (payload: Record<string, unknown>) => {
    try {
      return await window.electronAPI.apiFetch({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: ANTHROPIC_HEADERS(apiKey),
        body: JSON.stringify(payload),
        // LLM requests legitimately run 30-60s; this bounds the worst case.
        timeoutMs: 60000,
      });
    } catch (err) {
      throw new LLMError(
        `Network error contacting ${PROVIDERS.claude.label}: ${err instanceof Error ? err.message : String(err)}`,
        0,
        ''
      );
    }
  };

  let resp = await attempt(body);
  if (!resp.ok && suppress && isParamRejection(resp.status, resp.body, suppress.rejection)) {
    suppress.undo(body);
    resp = await attempt(body);
  }
  if (!resp.ok) {
    throw new LLMError(
      `Anthropic request failed: ${resp.status} ${resp.statusText || ''}`.trim(),
      resp.status,
      resp.body
    );
  }

  const data = parseJsonOrThrow('claude', resp) as any;
  const textBlock = Array.isArray(data?.content)
    ? data.content.find((b: { type?: string }) => b?.type === 'text')
    : null;
  const content: string = textBlock?.text ?? '';
  const usage = data?.usage
    ? {
        promptTokens: data.usage.input_tokens ?? 0,
        completionTokens: data.usage.output_tokens ?? 0,
      }
    : undefined;
  return { content, usage };
}

// Gemini native generateContent expects:
//   - role 'user' or 'model' (not 'assistant')
//   - parts: [{ text }]
//   - systemInstruction split out from contents
function buildGeminiBody(options: ChatOptions): Record<string, unknown> {
  const systemMessages = options.messages.filter((m) => m.role === 'system');
  const nonSystem = options.messages.filter((m) => m.role !== 'system');
  const contents = nonSystem.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = { contents };
  if (systemMessages.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemMessages.map((m) => m.content).join('\n\n') }],
    };
  }
  const generationConfig: Record<string, unknown> = {};
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
  if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
  if (options.response_format?.type === 'json_object') {
    generationConfig.responseMimeType = 'application/json';
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }
  return body;
}

function geminiUrl(model: string, apiKey: string, stream: boolean): string {
  const verb = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:${verb}key=${encodeURIComponent(apiKey)}`;
}

async function callGemini(args: {
  apiKey: string;
  model: string;
  options: ChatOptions;
  suppress?: ThinkingSuppressor | null;
}): Promise<ChatResult> {
  const { apiKey, model, options, suppress } = args;
  const body = buildGeminiBody(options);
  suppress?.apply(body);
  const url = geminiUrl(model, apiKey, false);

  const attempt = async (payload: Record<string, unknown>) => {
    try {
      return await window.electronAPI.apiFetch({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // LLM requests legitimately run 30-60s; this bounds the worst case.
        timeoutMs: 60000,
      });
    } catch (err) {
      throw new LLMError(
        `Network error contacting ${PROVIDERS.gemini.label}: ${err instanceof Error ? err.message : String(err)}`,
        0,
        ''
      );
    }
  };

  let resp = await attempt(body);
  if (!resp.ok && suppress && isParamRejection(resp.status, resp.body, suppress.rejection)) {
    suppress.undo(body);
    resp = await attempt(body);
  }
  if (!resp.ok) {
    throw new LLMError(
      `Gemini request failed: ${resp.status} ${resp.statusText || ''}`.trim(),
      resp.status,
      resp.body
    );
  }

  const data = parseJsonOrThrow('gemini', resp) as any;
  const parts: Array<{ text?: string }> = data?.candidates?.[0]?.content?.parts ?? [];
  const content = parts.map((p) => p?.text ?? '').join('');
  const usage = data?.usageMetadata
    ? {
        promptTokens: data.usageMetadata.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      }
    : undefined;
  return { content, usage };
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  const settings = await loadSettings();
  const provider = settings.provider;
  const model = settings.model;
  const apiKey = await loadApiKey(provider);
  const suppress = thinkingSuppressor(provider, settings.allowThinking);

  switch (provider) {
    case 'ollama': {
      return callOllamaNative({
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey,
        model,
        options,
        think: settings.allowThinking,
      });
    }
    case 'openai':
    case 'groq':
    case 'openrouter': {
      const key = requireApiKey(provider, apiKey);
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey: key,
        model,
        options,
        suppress,
      });
    }
    case 'claude': {
      const key = requireApiKey(provider, apiKey);
      return callAnthropic({ apiKey: key, model, options, suppress });
    }
    case 'gemini': {
      const key = requireApiKey(provider, apiKey);
      return callGemini({ apiKey: key, model, options, suppress });
    }
    case 'custom': {
      // A custom server may front a thinking model (e.g. an Ollama /v1 shim
      // or vLLM); it only needs a key when behind an auth proxy.
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey,
        model,
        options,
        suppress,
      });
    }
    default: {
      const exhaustive: never = provider;
      throw new LLMError(`Unknown provider: ${String(exhaustive)}`, 0, '');
    }
  }
}

// ---------------------------------------------------------------------------
// Streaming

export type TokenHandler = (contentSoFar: string) => void;

// Streaming requests get a longer wall-clock bound than one-shot calls: the
// timeout in api-fetch is a hard cap, not an inactivity timer, and long
// generations stream well past 60s on local models.
const STREAM_TIMEOUT_MS = 300000;

async function streamRequest(args: {
  provider: Provider;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  extract: (data: any) => string;
  onToken: TokenHandler;
  // Ollama's native API streams newline-delimited JSON, not SSE.
  wire?: 'sse' | 'ndjson';
}): Promise<ChatResult> {
  let content = '';
  const createParser = args.wire === 'ndjson' ? createNDJSONParser : createSSEParser;
  const push = createParser((payload) => {
    let data: unknown;
    try {
      data = JSON.parse(payload);
    } catch {
      return; // tolerate non-JSON keepalives
    }
    const delta = args.extract(data);
    if (delta) {
      content += delta;
      args.onToken(content);
    }
  });

  let resp;
  try {
    resp = await window.electronAPI.apiFetchStream(
      {
        url: args.url,
        method: 'POST',
        headers: args.headers,
        body: JSON.stringify(args.body),
        timeoutMs: STREAM_TIMEOUT_MS,
      },
      push
    );
  } catch (err) {
    throw new LLMError(
      `Network error contacting ${PROVIDERS[args.provider].label}: ${err instanceof Error ? err.message : String(err)}`,
      0,
      ''
    );
  }
  if (!resp.ok) {
    throw new LLMError(
      `${PROVIDERS[args.provider].label} request failed: ${resp.status} ${resp.statusText || ''}`.trim(),
      resp.status,
      resp.body
    );
  }
  return { content };
}

// streamRequest plus the best-effort thinking-suppression retry: if the server
// rejects the suppression param, undo it and stream again. The caller applies
// the suppressor before calling (bodies differ per provider); this owns undo.
async function streamWithSuppression(
  args: Parameters<typeof streamRequest>[0] & { suppress?: ThinkingSuppressor | null }
): Promise<ChatResult> {
  const { suppress, ...rest } = args;
  try {
    return await streamRequest(rest);
  } catch (err) {
    if (
      suppress &&
      err instanceof LLMError &&
      isParamRejection(err.status, err.body, suppress.rejection)
    ) {
      const body = { ...rest.body };
      suppress.undo(body);
      return streamRequest({ ...rest, body });
    }
    throw err;
  }
}

// Streaming chat. Same provider dispatch and request shapes as chat(), with
// the provider's stream flag set; onToken receives the cumulative content
// after every delta. Resolves with the final ChatResult (no usage stats —
// not all providers report them on streams).
export async function chatStream(options: ChatOptions, onToken: TokenHandler): Promise<ChatResult> {
  const settings = await loadSettings();
  const provider = settings.provider;
  const model = settings.model;
  const apiKey = await loadApiKey(provider);
  const suppress = thinkingSuppressor(provider, settings.allowThinking);

  switch (provider) {
    case 'ollama': {
      // Native endpoint (see callOllamaNative) so `think: false` is honored.
      const url = `${ollamaRootURL(resolveBaseURL(provider, settings.baseURL))}/api/chat`;
      const headers = ollamaHeaders(apiKey);
      const body = buildOllamaNativeBody(model, options, settings.allowThinking, true);
      try {
        return await streamRequest({
          provider,
          url,
          headers,
          body,
          extract: ollamaNativeDelta,
          onToken,
          wire: 'ndjson',
        });
      } catch (err) {
        // Best-effort `think`: retry without it if this server rejects it.
        if (err instanceof LLMError && isParamRejection(err.status, err.body, /think/i)) {
          const withoutThink = { ...body };
          delete withoutThink.think;
          return streamRequest({
            provider,
            url,
            headers,
            body: withoutThink,
            extract: ollamaNativeDelta,
            onToken,
            wire: 'ndjson',
          });
        }
        throw err;
      }
    }
    case 'openai':
    case 'groq':
    case 'openrouter':
    case 'custom': {
      // Custom servers only need a key when behind an auth proxy; the other
      // providers always require one.
      const key = provider === 'custom' ? apiKey : requireApiKey(provider, apiKey);
      const baseURL = resolveBaseURL(provider, settings.baseURL);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = `Bearer ${key}`;
      const body: Record<string, unknown> = { ...buildOpenAIBody(model, options), stream: true };
      suppress?.apply(body);
      return streamWithSuppression({
        provider,
        url: `${stripTrailingSlash(baseURL)}/chat/completions`,
        headers,
        body,
        extract: openAIDelta,
        onToken,
        suppress,
      });
    }
    case 'claude': {
      const key = requireApiKey(provider, apiKey);
      const body: Record<string, unknown> = { ...buildAnthropicBody(model, options), stream: true };
      suppress?.apply(body);
      return streamWithSuppression({
        provider,
        url: 'https://api.anthropic.com/v1/messages',
        headers: ANTHROPIC_HEADERS(key),
        body,
        extract: anthropicDelta,
        onToken,
        suppress,
      });
    }
    case 'gemini': {
      const key = requireApiKey(provider, apiKey);
      const body = buildGeminiBody(options);
      suppress?.apply(body);
      return streamWithSuppression({
        provider,
        url: geminiUrl(model, key, true),
        headers: { 'Content-Type': 'application/json' },
        body,
        extract: geminiDelta,
        onToken,
        suppress,
      });
    }
    default: {
      const exhaustive: never = provider;
      throw new LLMError(`Unknown provider: ${String(exhaustive)}`, 0, '');
    }
  }
}
