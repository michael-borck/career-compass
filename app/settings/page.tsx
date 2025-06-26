'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DefaultModels } from '@/lib/llm-providers';
import { settingsStore, secureStorage, type SettingsConfig, type ModelInfo } from '@/lib/settings-store';
import toast, { Toaster } from 'react-hot-toast';

type LLMProvider = 'ollama' | 'openai' | 'claude' | 'groq' | 'gemini';

const ProviderInfo = {
  ollama: {
    name: 'Ollama (Local)',
    description: 'Run models locally on your machine',
    requiresApiKey: false,
    defaultURL: 'http://localhost:11434/v1',
    website: 'https://ollama.ai'
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT models from OpenAI',
    requiresApiKey: true,
    defaultURL: '',
    website: 'https://openai.com'
  },
  claude: {
    name: 'Anthropic Claude',
    description: 'Claude models from Anthropic',
    requiresApiKey: true,
    defaultURL: '',
    website: 'https://claude.ai'
  },
  groq: {
    name: 'Groq',
    description: 'Fast inference with Groq',
    requiresApiKey: true,
    defaultURL: '',
    website: 'https://groq.com'
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Gemini models from Google',
    requiresApiKey: true,
    defaultURL: '',
    website: 'https://ai.google.dev'
  }
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsConfig>({
    provider: 'ollama',
    apiKey: '',
    baseURL: 'http://localhost:11434/v1',
    model: DefaultModels.ollama
  });

  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{[key: string]: {success: boolean, error?: string}}>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load basic settings
      const savedSettings = settingsStore.get();
      
      // Load API key from secure storage first, then try environment variables
      let apiKey = await secureStorage.getApiKey(savedSettings.provider);
      
      // If no saved API key, check environment variables
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
    const envVarMap = {
      openai: 'OPENAI_API_KEY',
      claude: 'ANTHROPIC_API_KEY',
      groq: 'GROQ_API_KEY',
      gemini: 'GOOGLE_API_KEY',
      ollama: ''
    };
    return envVarMap[provider];
  };

  const getApiKeyPlaceholder = (provider: LLMProvider): string => {
    if (provider === 'ollama') return 'Not required for local Ollama';
    
    const envVar = getEnvVarName(provider);
    return `Enter API key or set ${envVar} environment variable`;
  };

  const getApiKeyHelpText = (provider: LLMProvider): string => {
    if (provider === 'ollama') return 'Ollama runs locally and does not require an API key.';
    
    const envVar = getEnvVarName(provider);
    return `Leave blank to use ${envVar} environment variable, or enter your API key to save it securely.`;
  };

  const handleProviderChange = (provider: LLMProvider) => {
    const providerInfo = ProviderInfo[provider];
    setSettings(prev => ({
      ...prev,
      provider,
      baseURL: providerInfo.defaultURL,
      model: DefaultModels[provider],
      apiKey: provider === 'ollama' ? '' : prev.apiKey
    }));
  };

  const loadOllamaModels = async () => {
    setLoadingModels(true);
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const models = await (window as any).electronAPI.models.getOllamaModels(settings.baseURL.replace('/v1', ''));
        setAvailableModels(models);
        toast.success(`Loaded ${models.length} models from Ollama`);
      } else {
        // Fallback for web environment
        const response = await fetch(`${settings.baseURL.replace('/v1', '')}/api/tags`);
        const data = await response.json();
        setAvailableModels(data.models || []);
        toast.success(`Loaded ${data.models?.length || 0} models from Ollama`);
      }
    } catch (error) {
      console.error('Failed to load Ollama models:', error);
      toast.error('Failed to load models. Make sure Ollama is running.');
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const testConnection = async (provider: LLMProvider) => {
    try {
      setConnectionStatus(prev => ({ ...prev, [provider]: { success: false, error: 'Testing...' } }));
      
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.models.testConnection(provider, settings);
        setConnectionStatus(prev => ({ ...prev, [provider]: result }));
        if (result.success) {
          toast.success(`${ProviderInfo[provider].name} connection successful`);
        } else {
          toast.error(`${ProviderInfo[provider].name} connection failed: ${result.error}`);
        }
      } else {
        toast.error('Connection testing only available in desktop app');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setConnectionStatus(prev => ({ ...prev, [provider]: { success: false, error: errorMsg } }));
      toast.error(`Connection test failed: ${errorMsg}`);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Validate settings
      if (ProviderInfo[settings.provider].requiresApiKey && !settings.apiKey.trim()) {
        toast.error('API key is required for this provider');
        setIsLoading(false);
        return;
      }

      // Save basic settings (without API key)
      const settingsToSave = { ...settings };
      delete (settingsToSave as any).apiKey;
      settingsStore.set(settingsToSave);

      // Save API key securely if provided, otherwise clear stored key to use env vars
      if (settings.apiKey.trim()) {
        await secureStorage.setApiKey(settings.provider, settings.apiKey);
      } else {
        // Clear stored API key so environment variable can be used
        await secureStorage.deleteApiKey(settings.provider);
      }

      toast.success('Settings saved successfully!');
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
        model: DefaultModels.ollama
      };
      setSettings(defaultSettings);
      settingsStore.clear();
      
      // Clear all API keys
      const providers: LLMProvider[] = ['ollama', 'openai', 'claude', 'groq', 'gemini'];
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure your AI provider and API settings for Career Compass
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">AI Provider Configuration</h2>
          
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">AI Provider</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                {Object.entries(ProviderInfo).map(([key, info]) => (
                  <div key={key} className="relative">
                    <input
                      type="radio"
                      id={key}
                      name="provider"
                      value={key}
                      checked={settings.provider === key}
                      onChange={() => handleProviderChange(key as LLMProvider)}
                      className="sr-only"
                    />
                    <label
                      htmlFor={key}
                      className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        settings.provider === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{info.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{info.description}</div>
                      {key === 'ollama' && (
                        <div className="text-xs text-green-600 mt-2 font-medium">✓ Privacy-first</div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {ProviderInfo[settings.provider].requiresApiKey && (
              <div>
                <Label htmlFor="apiKey" className="text-base font-medium">
                  API Key
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
                  <p className="text-sm text-gray-600">
                    {getApiKeyHelpText(settings.provider)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Get your API key from {' '}
                    <a 
                      href={ProviderInfo[settings.provider].website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {ProviderInfo[settings.provider].website}
                    </a>
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="model" className="text-base font-medium">
                  Model
                </Label>
                {settings.provider === 'ollama' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadOllamaModels}
                    disabled={loadingModels}
                    className="ml-2"
                  >
                    {loadingModels ? 'Loading...' : 'Load Models'}
                  </Button>
                )}
              </div>
              
              {settings.provider === 'ollama' && availableModels.length > 0 ? (
                <select
                  value={settings.model}
                  onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({model.size})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="model"
                  value={settings.model}
                  onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="Enter model name"
                  className="mt-2"
                />
              )}
              
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-600">
                  Default: {DefaultModels[settings.provider]}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection(settings.provider)}
                  disabled={loadingModels}
                  className="ml-2"
                >
                  Test Connection
                </Button>
              </div>
              
              {connectionStatus[settings.provider] && (
                <div className={`mt-2 p-2 rounded text-sm ${
                  connectionStatus[settings.provider].success 
                    ? 'bg-green-50 text-green-800 border border-green-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {connectionStatus[settings.provider].success 
                    ? '✓ Connection successful' 
                    : `✗ ${connectionStatus[settings.provider].error}`
                  }
                </div>
              )}
            </div>

            {(settings.provider === 'ollama' || settings.baseURL !== ProviderInfo[settings.provider].defaultURL) && (
              <div>
                <Label htmlFor="baseURL" className="text-base font-medium">
                  Base URL {settings.provider === 'ollama' ? '(Local Server)' : '(Optional)'}
                </Label>
                <Input
                  id="baseURL"
                  value={settings.baseURL}
                  onChange={(e) => setSettings(prev => ({ ...prev, baseURL: e.target.value }))}
                  placeholder="Enter custom base URL"
                  className="mt-2"
                />
                <p className="text-sm text-gray-600 mt-2">
                  {settings.provider === 'ollama' 
                    ? 'Make sure Ollama is running locally on this URL'
                    : 'Leave empty to use the default endpoint'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Privacy Notice</h3>
          <p className="text-sm text-blue-800">
            Your API keys are stored locally in your browser and never sent to our servers. 
            For maximum privacy, we recommend using Ollama to run models locally on your device.
          </p>
        </div>

        <div className="flex gap-4">
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            className="px-6"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button 
            onClick={handleReset} 
            variant="outline"
            className="px-6"
          >
            Reset to Defaults
          </Button>
        </div>
      </div>
      <Toaster />
    </div>
  );
}