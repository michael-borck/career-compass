'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DefaultModels } from '@/lib/llm-providers';
import { settingsStore, secureStorage, type SettingsConfig } from '@/lib/settings-store';
import toast, { Toaster } from 'react-hot-toast';

type LLMProvider = 'ollama' | 'openai' | 'claude' | 'groq' | 'gemini' | 'openrouter' | 'custom';

interface AvailableModel {
  id: string;
  name: string;
  size?: string;
}

const ProviderInfo: Record<LLMProvider, {
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresBaseURL: boolean;
  defaultURL: string;
  website: string;
}> = {
  ollama: {
    name: 'Ollama (runs on your computer)',
    description: 'Keep everything private. No data leaves your device',
    requiresApiKey: false,
    requiresBaseURL: false,
    defaultURL: 'http://localhost:11434/v1',
    website: 'https://ollama.ai'
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT models from OpenAI',
    requiresApiKey: true,
    requiresBaseURL: false,
    defaultURL: '',
    website: 'https://openai.com'
  },
  claude: {
    name: 'Anthropic Claude',
    description: 'Claude models from Anthropic',
    requiresApiKey: true,
    requiresBaseURL: false,
    defaultURL: '',
    website: 'https://console.anthropic.com'
  },
  groq: {
    name: 'Groq',
    description: 'Fast inference with Groq hardware',
    requiresApiKey: true,
    requiresBaseURL: false,
    defaultURL: '',
    website: 'https://console.groq.com'
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Gemini models from Google',
    requiresApiKey: true,
    requiresBaseURL: false,
    defaultURL: '',
    website: 'https://ai.google.dev'
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Access many models through one key',
    requiresApiKey: true,
    requiresBaseURL: false,
    defaultURL: '',
    website: 'https://openrouter.ai'
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    description: 'Any server that speaks the OpenAI format',
    requiresApiKey: false,
    requiresBaseURL: true,
    defaultURL: '',
    website: ''
  }
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsConfig>({
    provider: 'ollama',
    apiKey: '',
    baseURL: 'http://localhost:11434/v1',
    model: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{[key: string]: {success: boolean, error?: string}}>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await settingsStore.get();
      let apiKey = await secureStorage.getApiKey(savedSettings.provider);

      if (!apiKey) {
        const envVarName = getEnvVarName(savedSettings.provider);
        if (envVarName && typeof window !== 'undefined' && (window as any).electronAPI) {
          apiKey = await (window as any).electronAPI.getEnvVar(envVarName) || '';
        }
      }

      setSettings({
        ...savedSettings,
        apiKey: apiKey || ''
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const getEnvVarName = (provider: LLMProvider): string => {
    const envVarMap: Record<LLMProvider, string> = {
      openai: 'OPENAI_API_KEY',
      claude: 'ANTHROPIC_API_KEY',
      groq: 'GROQ_API_KEY',
      gemini: 'GOOGLE_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      ollama: '',
      custom: '',
    };
    return envVarMap[provider];
  };

  const getApiKeyPlaceholder = (provider: LLMProvider): string => {
    if (provider === 'ollama') return 'Not needed for local use';
    return 'Paste your secret key here';
  };

  const getApiKeyHelpText = (provider: LLMProvider): string => {
    if (provider === 'ollama') return 'Ollama runs on your computer and does not need a secret key.';
    const envVar = getEnvVarName(provider);
    return `You can leave this blank if you have already set the ${envVar} environment variable on your computer. Otherwise, paste your secret key here.`;
  };

  const handleProviderChange = (provider: LLMProvider) => {
    const providerInfo = ProviderInfo[provider];
    setAvailableModels([]);
    setConnectionStatus({});
    setSettings(prev => ({
      ...prev,
      provider,
      baseURL: providerInfo.defaultURL,
      model: DefaultModels[provider],
      apiKey: provider === 'ollama' ? '' : prev.apiKey
    }));
  };

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      let models: { id: string; name: string; size?: string }[] = [];

      if (typeof window !== 'undefined' && (window as any).electronAPI?.models?.getProviderModels) {
        // Electron mode: use IPC
        models = await (window as any).electronAPI.models.getProviderModels(settings.provider, settings);
      } else {
        // Web mode: use API route
        const response = await fetch('/api/getModels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: settings.provider,
            apiKey: settings.apiKey,
            baseURL: settings.baseURL,
          }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to fetch models');
        }
        models = await response.json();
      }

      setAvailableModels(models);
      if (models.length > 0) {
        toast.success(`Found ${models.length} models`);
      } else {
        toast.error('No models found');
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      const message = error instanceof Error ? error.message : 'Could not fetch models';
      toast.error(message);
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const testConnection = async (provider: LLMProvider) => {
    try {
      setConnectionStatus(prev => ({ ...prev, [provider]: { success: false, error: 'Checking...' } }));

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.models.testConnection(provider, settings);
        setConnectionStatus(prev => ({ ...prev, [provider]: result }));
        if (result.success) {
          toast.success(`Connected to ${ProviderInfo[provider].name}`);
        } else {
          toast.error(`Could not connect: ${result.error}`);
        }
      } else {
        toast.error('Connection check is only available in the desktop app');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setConnectionStatus(prev => ({ ...prev, [provider]: { success: false, error: errorMsg } }));
      toast.error(`Connection check failed: ${errorMsg}`);
    }
  };

  const checkEnvVar = async (provider: LLMProvider): Promise<boolean> => {
    const envVar = getEnvVarName(provider);
    if (!envVar) return false;
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const val = await (window as any).electronAPI.getEnvVar(envVar);
      return !!val;
    }
    return false;
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (!settings.model.trim()) {
        toast.error('Please select a model first. Click "Refresh models" to see what is available.');
        setIsLoading(false);
        return;
      }

      if (ProviderInfo[settings.provider].requiresApiKey && !settings.apiKey.trim()) {
        // Check if an environment variable is set before blocking
        const hasEnvVar = await checkEnvVar(settings.provider);
        if (!hasEnvVar) {
          const envVar = getEnvVarName(settings.provider);
          toast.error(`No secret key found. Paste one above or set the ${envVar} environment variable.`);
          setIsLoading(false);
          return;
        }
      }

      const settingsToSave = { ...settings };
      delete (settingsToSave as any).apiKey;
      await settingsStore.set(settingsToSave);

      if (settings.apiKey.trim()) {
        await secureStorage.setApiKey(settings.provider, settings.apiKey);
      } else {
        // Clear stored key — env var will be used as fallback
        await secureStorage.deleteApiKey(settings.provider);
      }

      toast.success('Settings saved');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      const defaultSettings: SettingsConfig = {
        provider: 'ollama',
        apiKey: '',
        baseURL: 'http://localhost:11434/v1',
        model: ''
      };
      setSettings(defaultSettings);
      await settingsStore.clear();

      const providers: LLMProvider[] = ['ollama', 'openai', 'claude', 'groq', 'gemini', 'openrouter', 'custom'];
      await Promise.all(providers.map(provider => secureStorage.deleteApiKey(provider)));

      toast.success('Settings reset to defaults');
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset settings');
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="space-y-8">
        {/* Section marker */}
        <div>
          <div className="editorial-rule">
            <span>Preferences</span>
          </div>
          <h1 className="text-[var(--text-3xl)] font-semibold text-ink">Settings</h1>
          <p className="text-ink-muted mt-2 text-[var(--text-lg)]">
            Choose how Career Compass connects to AI
          </p>
        </div>

        <div className="bg-paper border border-border rounded-lg p-8">
          <h2 className="text-[var(--text-xl)] font-semibold mb-4 text-ink">AI provider</h2>

          <div className="space-y-6">
            <div>
              <Label htmlFor="provider" className="text-base font-medium text-ink">AI provider</Label>
              <select
                id="provider"
                value={settings.provider}
                onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                className="mt-2 w-full px-3 py-2 border border-input bg-paper text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent transition-colors duration-[250ms]"
              >
                {Object.entries(ProviderInfo).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.name}
                  </option>
                ))}
              </select>
              <p className="text-[var(--text-sm)] text-ink-muted mt-2">
                {ProviderInfo[settings.provider].description}
              </p>
            </div>

            {ProviderInfo[settings.provider].requiresApiKey && (
              <div>
                <Label htmlFor="apiKey" className="text-base font-medium text-ink">
                  Secret key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={getApiKeyPlaceholder(settings.provider)}
                  className="mt-2"
                />
                <div className="mt-2 space-y-1">
                  <p className="text-[var(--text-sm)] text-ink-muted">
                    {getApiKeyHelpText(settings.provider)}
                  </p>
                  <p className="text-[var(--text-sm)] text-ink-muted">
                    Get your secret key from{' '}
                    <a
                      href={ProviderInfo[settings.provider].website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {ProviderInfo[settings.provider].website}
                    </a>
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="model" className="text-base font-medium text-ink">
                  AI brain
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadModels}
                  disabled={loadingModels}
                  className="ml-2"
                >
                  {loadingModels ? 'Looking...' : 'Refresh models'}
                </Button>
              </div>

              {availableModels.length > 0 ? (
                <select
                  value={settings.model}
                  onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  className="mt-2 w-full px-3 py-2 border border-input bg-paper text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent transition-colors duration-[250ms]"
                >
                  {availableModels.map((model: any) => (
                    <option key={model.id || model.name} value={model.id || model.name}>
                      {model.name || model.id}{model.size ? ` (${model.size})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="model"
                  value={settings.model}
                  onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="Type a model name, or click Refresh models"
                  className="mt-2"
                />
              )}

              <div className="flex items-center justify-between mt-2">
                <p className="text-[var(--text-sm)] text-ink-muted">
                  {settings.model ? '' : 'Click "Refresh models" to see what is available'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection(settings.provider)}
                  disabled={loadingModels}
                  className="ml-2"
                >
                  Check connection
                </Button>
              </div>

              {connectionStatus[settings.provider] && (
                <div className={`mt-2 p-3 rounded-lg text-[var(--text-sm)] border ${
                  connectionStatus[settings.provider].success
                    ? 'bg-accent-soft text-accent-deep border-accent/20'
                    : 'bg-[hsl(var(--error)/0.08)] text-error border-error/20'
                }`}>
                  {connectionStatus[settings.provider].success
                    ? 'Connected successfully'
                    : connectionStatus[settings.provider].error
                  }
                </div>
              )}
            </div>

            {(settings.provider === 'ollama' || settings.provider === 'custom' || ProviderInfo[settings.provider].requiresBaseURL || settings.baseURL !== ProviderInfo[settings.provider].defaultURL) && (
              <div>
                <Label htmlFor="baseURL" className="text-base font-medium text-ink">
                  Server address
                </Label>
                <Input
                  id="baseURL"
                  value={settings.baseURL}
                  onChange={(e) => setSettings(prev => ({ ...prev, baseURL: e.target.value }))}
                  placeholder="Enter address"
                  className="mt-2"
                />
                <p className="text-[var(--text-sm)] text-ink-muted mt-2">
                  {settings.provider === 'ollama'
                    ? 'Make sure Ollama is running on your computer at this address'
                    : settings.provider === 'custom'
                    ? 'The full URL of an OpenAI-compatible server (e.g. http://localhost:8080/v1)'
                    : 'Leave empty to use the default address'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-accent-soft border border-accent/20 rounded-lg p-6">
          <h3 className="font-medium text-ink mb-2">Your privacy</h3>
          <p className="text-[var(--text-sm)] text-ink-muted leading-relaxed">
            Your secret keys are stored safely on your computer and never sent to our servers.
            For the most private experience, use Ollama to run AI models entirely on your own device.
          </p>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="px-6"
          >
            {isLoading ? 'Saving...' : 'Save settings'}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="px-6"
          >
            Reset to defaults
          </Button>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
