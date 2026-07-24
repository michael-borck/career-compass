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
import { createSSEParser, openAIDelta, anthropicDelta, geminiDelta } from './sse';

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
};

const DEFAULT_SETTINGS: Settings = {
  provider: 'ollama',
  baseURL: '',
  model: '',
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
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
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
}): Promise<ChatResult> {
  const { provider, baseURL, apiKey, model, options } = args;
  const url = `${stripTrailingSlash(baseURL)}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Ollama/custom servers only get a key when one is configured (e.g. behind
  // an auth proxy); other providers must have a key (enforced upstream).
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const body = JSON.stringify(buildOpenAIBody(model, options));
  let resp;
  try {
    resp = await window.electronAPI.apiFetch({
      url,
      method: 'POST',
      headers,
      body,
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
  if (!resp.ok) {
    throw new LLMError(
      `${PROVIDERS[provider].label} request failed: ${resp.status} ${resp.statusText || ''}`.trim(),
      resp.status,
      resp.body
    );
  }
  return parseOpenAIResponse(provider, resp);
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
}): Promise<ChatResult> {
  const { apiKey, model, options } = args;
  const body = buildAnthropicBody(model, options);

  let resp;
  try {
    resp = await window.electronAPI.apiFetch({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: ANTHROPIC_HEADERS(apiKey),
      body: JSON.stringify(body),
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
}): Promise<ChatResult> {
  const { apiKey, model, options } = args;
  const body = buildGeminiBody(options);
  const url = geminiUrl(model, apiKey, false);
  let resp;
  try {
    resp = await window.electronAPI.apiFetch({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

  switch (provider) {
    case 'ollama': {
      // Key is optional: local Ollama needs none, but a shared/remote server
      // behind an auth proxy may require a bearer token.
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey,
        model,
        options,
      });
    }
    case 'openai': {
      const key = requireApiKey(provider, apiKey);
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey: key,
        model,
        options,
      });
    }
    case 'groq': {
      const key = requireApiKey(provider, apiKey);
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey: key,
        model,
        options,
      });
    }
    case 'openrouter': {
      const key = requireApiKey(provider, apiKey);
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey: key,
        model,
        options,
      });
    }
    case 'claude': {
      const key = requireApiKey(provider, apiKey);
      return callAnthropic({ apiKey: key, model, options });
    }
    case 'gemini': {
      const key = requireApiKey(provider, apiKey);
      return callGemini({ apiKey: key, model, options });
    }
    case 'custom': {
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey,
        model,
        options,
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
}): Promise<ChatResult> {
  let content = '';
  const push = createSSEParser((payload) => {
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

// Streaming chat. Same provider dispatch and request shapes as chat(), with
// the provider's stream flag set; onToken receives the cumulative content
// after every delta. Resolves with the final ChatResult (no usage stats —
// not all providers report them on streams).
export async function chatStream(options: ChatOptions, onToken: TokenHandler): Promise<ChatResult> {
  const settings = await loadSettings();
  const provider = settings.provider;
  const model = settings.model;
  const apiKey = await loadApiKey(provider);

  switch (provider) {
    case 'ollama':
    case 'openai':
    case 'groq':
    case 'openrouter':
    case 'custom': {
      // Ollama and custom servers only need a key when behind an auth proxy;
      // the other providers always require one.
      const key =
        provider === 'ollama' || provider === 'custom' ? apiKey : requireApiKey(provider, apiKey);
      const baseURL = resolveBaseURL(provider, settings.baseURL);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = `Bearer ${key}`;
      return streamRequest({
        provider,
        url: `${stripTrailingSlash(baseURL)}/chat/completions`,
        headers,
        body: { ...buildOpenAIBody(model, options), stream: true },
        extract: openAIDelta,
        onToken,
      });
    }
    case 'claude': {
      const key = requireApiKey(provider, apiKey);
      return streamRequest({
        provider,
        url: 'https://api.anthropic.com/v1/messages',
        headers: ANTHROPIC_HEADERS(key),
        body: { ...buildAnthropicBody(model, options), stream: true },
        extract: anthropicDelta,
        onToken,
      });
    }
    case 'gemini': {
      const key = requireApiKey(provider, apiKey);
      return streamRequest({
        provider,
        url: geminiUrl(model, key, true),
        headers: { 'Content-Type': 'application/json' },
        body: buildGeminiBody(options),
        extract: geminiDelta,
        onToken,
      });
    }
    default: {
      const exhaustive: never = provider;
      throw new LLMError(`Unknown provider: ${String(exhaustive)}`, 0, '');
    }
  }
}
