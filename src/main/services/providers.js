// Main-process provider operations: model listing + connection testing per
// LLM provider. Extracted verbatim from the ipcMain handlers in index.js so
// the 7-provider HTTP logic becomes a testable seam.
//
// Test seam: every function takes `fetchImpl = fetch` as its last argument.
// Production passes nothing (global fetch in the Electron main / Node 18+
// runtime); providers.test.js passes a fake fetch so no live network is hit.
//
// Distinct from the renderer's chat() client (src/renderer/services/llm.ts):
// this runs in the main process and only lists models / tests connections —
// it never sends chat turns. The two still encode overlapping provider facts
// (base URLs, auth header style); unifying them is a follow-up (would require
// sharing a module across the CJS-main / ESM-renderer seam).

// Env-var fallback for API keys, used when config.apiKey is absent. Collapsed
// from two identical inline copies that lived in the get-provider-models and
// test-connection handlers.
//
// Kept in sync with llm.ts's ENV_VAR_MAP so the main process (model listing,
// connection tests) and the renderer (chat) resolve the same keys. openrouter
// was previously missing here — that drift meant OPENROUTER_API_KEY worked for
// chat but failed in the Settings model dropdown / test-connection.
const ENV_VAR = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

function resolveApiKey(provider, config) {
  if (config && config.apiKey) return config.apiKey;
  const envName = ENV_VAR[provider];
  return envName ? process.env[envName] : undefined;
}

// Fetch installed models from a local Ollama server (legacy get-ollama-models).
async function getOllamaModels(baseURL, fetchImpl = fetch) {
  try {
    const url = baseURL || 'http://localhost:11434';
    const response = await fetchImpl(`${url}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error);
    throw error;
  }
}

// List available models for any provider (legacy get-provider-models).
// Returns Array<{ id, name, size? }>. Throws on unreachable/unauthorized.
async function listModels(provider, config, fetchImpl = fetch) {
  try {
    const apiKey = resolveApiKey(provider, config);

    switch (provider) {
      case 'ollama': {
        const url = (config.baseURL || 'http://localhost:11434').replace(/\/v1\/?$/, '');
        const response = await fetchImpl(`${url}/api/tags`);
        if (!response.ok) throw new Error(`Ollama not reachable`);
        const data = await response.json();
        return (data.models || []).map((m) => ({ id: m.name, name: m.name, size: m.size }));
      }

      case 'openai': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetchImpl('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
        const data = await response.json();
        const models = (data.data || []).sort((a, b) => a.id.localeCompare(b.id));
        return models.map((m) => ({ id: m.id, name: m.id }));
      }

      case 'claude': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetchImpl('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
        if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
        const data = await response.json();
        const models = (data.data || []).sort((a, b) => a.id.localeCompare(b.id));
        return models.map((m) => ({ id: m.id, name: m.id }));
      }

      case 'groq': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetchImpl('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`Groq error: ${response.status}`);
        const data = await response.json();
        const models = (data.data || []).sort((a, b) => a.id.localeCompare(b.id));
        return models.map((m) => ({ id: m.id, name: m.id }));
      }

      case 'gemini': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
        const data = await response.json();
        const models = (data.models || []).sort((a, b) => a.name.localeCompare(b.name));
        return models.map((m) => ({
          id: m.name.replace('models/', ''),
          name: m.name.replace('models/', ''),
        }));
      }

      case 'openrouter': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetchImpl('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);
        const data = await response.json();
        const models = (data.data || []).sort((a, b) => a.id.localeCompare(b.id));
        return models.map((m) => ({ id: m.id, name: m.id }));
      }

      case 'custom': {
        const baseURL = config.baseURL;
        if (!baseURL) throw new Error('Server address required');
        const headers = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const response = await fetchImpl(`${baseURL}/models`, { headers });
        if (!response.ok) throw new Error(`Custom server error: ${response.status}`);
        const data = await response.json();
        const models = (data.data || data.models || []).sort((a, b) =>
          (a.id || a.name || '').localeCompare(b.id || b.name || '')
        );
        return models.map((m) => ({ id: m.id || m.name, name: m.id || m.name }));
      }

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Failed to fetch models for ${provider}:`, error);
    throw error;
  }
}

// Test connectivity + credentials for any provider (legacy test-connection).
// Returns { success: boolean, error: string | null } — never throws.
async function testConnection(provider, config, fetchImpl = fetch) {
  try {
    const apiKey = resolveApiKey(provider, config);

    switch (provider) {
      case 'ollama': {
        const ollamaUrl = config.baseURL || 'http://localhost:11434';
        const ollamaResponse = await fetchImpl(`${ollamaUrl}/api/tags`);
        return {
          success: ollamaResponse.ok,
          error: ollamaResponse.ok ? null : `Ollama not reachable at ${ollamaUrl}`,
        };
      }

      case 'openai': {
        if (!apiKey) {
          return { success: false, error: 'API key required (set OPENAI_API_KEY or enter in settings)' };
        }
        const openaiResponse = await fetchImpl('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          return { success: false, error: `OpenAI API error: ${openaiResponse.status} ${errorText}` };
        }
        return { success: true, error: null };
      }

      case 'claude': {
        if (!apiKey) {
          return { success: false, error: 'API key required (set ANTHROPIC_API_KEY or enter in settings)' };
        }
        // Anthropic has no simple health endpoint; test with a minimal request.
        const claudeResponse = await fetchImpl('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        });
        if (!claudeResponse.ok) {
          return { success: false, error: `Claude API error: ${claudeResponse.status}` };
        }
        return { success: true, error: null };
      }

      case 'groq': {
        if (!apiKey) {
          return { success: false, error: 'API key required (set GROQ_API_KEY or enter in settings)' };
        }
        const groqResponse = await fetchImpl('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!groqResponse.ok) {
          return { success: false, error: `Groq API error: ${groqResponse.status}` };
        }
        return { success: true, error: null };
      }

      case 'gemini': {
        if (!apiKey) {
          return { success: false, error: 'Secret key required (set GOOGLE_API_KEY or enter in settings)' };
        }
        const geminiResponse = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (!geminiResponse.ok) {
          return { success: false, error: `Gemini API error: ${geminiResponse.status}` };
        }
        return { success: true, error: null };
      }

      case 'openrouter': {
        if (!apiKey) {
          return { success: false, error: 'Secret key required (set OPENROUTER_API_KEY or enter in settings)' };
        }
        const orResponse = await fetchImpl('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!orResponse.ok) {
          return { success: false, error: `OpenRouter API error: ${orResponse.status}` };
        }
        return { success: true, error: null };
      }

      case 'custom': {
        const customURL = config.baseURL;
        if (!customURL) {
          return { success: false, error: 'Server address is required' };
        }
        try {
          const customHeaders = {};
          if (apiKey) customHeaders['Authorization'] = `Bearer ${apiKey}`;
          const customResponse = await fetchImpl(`${customURL}/models`, { headers: customHeaders });
          return {
            success: customResponse.ok,
            error: customResponse.ok ? null : `Server returned ${customResponse.status}`,
          };
        } catch (e) {
          return { success: false, error: `Cannot reach ${customURL}: ${e.message}` };
        }
      }

      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { getOllamaModels, listModels, testConnection, resolveApiKey, ENV_VAR };
