'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DefaultModels } from '@/lib/llm-providers';
import toast, { Toaster } from 'react-hot-toast';

type LLMProvider = 'ollama' | 'openai' | 'claude' | 'groq' | 'gemini';

interface SettingsConfig {
  provider: LLMProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

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

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('career-compass-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
    }
  }, []);

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

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Validate settings
      if (ProviderInfo[settings.provider].requiresApiKey && !settings.apiKey.trim()) {
        toast.error('API key is required for this provider');
        setIsLoading(false);
        return;
      }

      // Save to localStorage
      localStorage.setItem('career-compass-settings', JSON.stringify(settings));
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    const defaultSettings: SettingsConfig = {
      provider: 'ollama',
      apiKey: '',
      baseURL: 'http://localhost:11434/v1',
      model: DefaultModels.ollama
    };
    setSettings(defaultSettings);
    localStorage.removeItem('career-compass-settings');
    toast.success('Settings reset to defaults');
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
                  placeholder={`Enter your ${ProviderInfo[settings.provider].name} API key`}
                  className="mt-2"
                />
                <p className="text-sm text-gray-600 mt-2">
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
            )}

            <div>
              <Label htmlFor="model" className="text-base font-medium">
                Model
              </Label>
              <Input
                id="model"
                value={settings.model}
                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                placeholder="Enter model name"
                className="mt-2"
              />
              <p className="text-sm text-gray-600 mt-2">
                Default: {DefaultModels[settings.provider]}
              </p>
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