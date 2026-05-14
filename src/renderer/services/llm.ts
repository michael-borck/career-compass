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

export type Provider =
  | 'ollama'
  | 'openai'
  | 'claude'
  | 'groq'
  | 'gemini'
  | 'openrouter'
  | 'custom';

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
    const raw = await window.electronAPI.store.get<Partial<Settings>>(
      'settings',
      DEFAULT_SETTINGS
    );
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

// Per-provider default base URLs for the OpenAI-compatible dispatch.
// Only consulted when settings.baseURL is empty — explicit user values win.
// claude/gemini use hardcoded URLs in their own dispatch branches and don't
// go through resolveBaseURL; their entries here are unused placeholders.
const PROVIDER_DEFAULT_BASE_URL: Record<Provider, string | null> = {
  ollama: 'http://localhost:11434/v1',
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  claude: null,
  gemini: null,
  custom: null,
};

function resolveBaseURL(provider: Provider, settingsBaseURL: string): string {
  const fromSettings = settingsBaseURL.trim();
  const fromDefault = PROVIDER_DEFAULT_BASE_URL[provider];

  if (provider === 'custom') {
    if (!fromSettings) {
      throw new LLMError(
        'Custom provider requires a server address in Settings',
        0,
        ''
      );
    }
    return fromSettings;
  }
  if (fromSettings) return fromSettings;
  if (fromDefault) return fromDefault;
  throw new LLMError(
    `${PROVIDER_LABEL[provider]} has no baseURL configured`,
    0,
    ''
  );
}

const ENV_VAR_MAP: Record<Provider, string> = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  ollama: '',
  custom: '',
};

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: 'OpenAI',
  claude: 'Anthropic',
  groq: 'Groq',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  custom: 'Custom',
};

const DEFAULT_MAX_TOKENS = 4096;

async function loadSettings(): Promise<Settings> {
  const raw = await window.electronAPI.store.get<Partial<Settings>>(
    'settings',
    DEFAULT_SETTINGS
  );
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
}

async function loadApiKey(provider: Provider): Promise<string | null> {
  // Primary key, as written by lib/settings-store.ts ElectronSecureStorage.
  const primary = await window.electronAPI.secureStorage.getPassword(
    `career-compass-llm-${provider}`
  );
  if (primary) return primary;

  // Migration fallback: older installs stored LLM keys without the namespace.
  const legacy = await window.electronAPI.secureStorage.getPassword(
    `career-compass-${provider}`
  );
  if (legacy) return legacy;

  // Env var fallback (matches electron/main.js test-connection handler).
  const envVar = ENV_VAR_MAP[provider];
  if (envVar) {
    const fromEnv = await window.electronAPI.getEnvVar(envVar);
    if (fromEnv) return fromEnv;
  }

  return null;
}

function requireApiKey(provider: Provider, key: string | null): string {
  if (!key) {
    throw new LLMError(
      `${PROVIDER_LABEL[provider]} API key not configured in Settings`,
      0,
      ''
    );
  }
  return key;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

// Build the OpenAI-compatible chat/completions request body.
function buildOpenAIBody(
  model: string,
  options: ChatOptions
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (options.response_format) body.response_format = options.response_format;
  return body;
}

function parseJsonOrThrow(
  provider: Provider,
  resp: { status: number; body: string }
): unknown {
  try {
    return JSON.parse(resp.body);
  } catch {
    throw new LLMError(
      `${PROVIDER_LABEL[provider]} returned malformed JSON`,
      resp.status,
      resp.body
    );
  }
}

function parseOpenAIResponse(
  provider: Provider,
  resp: { status: number; body: string }
): ChatResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // Ollama doesn't need a real key but the OpenAI client sends one; keep the
  // header optional. Other providers must have a key (enforced upstream).
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
      `Network error contacting ${PROVIDER_LABEL[provider]}: ${err instanceof Error ? err.message : String(err)}`,
      0,
      ''
    );
  }
  if (!resp.ok) {
    throw new LLMError(
      `${PROVIDER_LABEL[provider]} request failed: ${resp.status} ${resp.statusText || ''}`.trim(),
      resp.status,
      resp.body
    );
  }
  return parseOpenAIResponse(provider, resp);
}

async function callAnthropic(args: {
  apiKey: string;
  model: string;
  options: ChatOptions;
}): Promise<ChatResult> {
  const { apiKey, model, options } = args;
  // Anthropic puts the system prompt in a separate top-level `system` field,
  // not in the messages array. Concatenate any system messages.
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

  let resp;
  try {
    resp = await window.electronAPI.apiFetch({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      // LLM requests legitimately run 30-60s; this bounds the worst case.
      timeoutMs: 60000,
    });
  } catch (err) {
    throw new LLMError(
      `Network error contacting ${PROVIDER_LABEL.claude}: ${err instanceof Error ? err.message : String(err)}`,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

async function callGemini(args: {
  apiKey: string;
  model: string;
  options: ChatOptions;
}): Promise<ChatResult> {
  const { apiKey, model, options } = args;
  // Gemini native generateContent expects:
  //   - role 'user' or 'model' (not 'assistant')
  //   - parts: [{ text }]
  //   - systemInstruction split out from contents
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
  if (options.temperature !== undefined)
    generationConfig.temperature = options.temperature;
  if (options.maxTokens !== undefined)
    generationConfig.maxOutputTokens = options.maxTokens;
  if (options.response_format?.type === 'json_object') {
    generationConfig.responseMimeType = 'application/json';
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
      `Network error contacting ${PROVIDER_LABEL.gemini}: ${err instanceof Error ? err.message : String(err)}`,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = parseJsonOrThrow('gemini', resp) as any;
  const parts: Array<{ text?: string }> =
    data?.candidates?.[0]?.content?.parts ?? [];
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
      return callOpenAICompatible({
        provider,
        baseURL: resolveBaseURL(provider, settings.baseURL),
        apiKey: null,
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
