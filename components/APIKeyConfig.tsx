'use client';

import { useState, useEffect } from 'react';
import { AIProvider } from '@/lib/types';

interface APIKeyConfigProps {
  onConfigChange: (config: { provider: AIProvider; apiKey: string; model?: string }) => void;
}

export function APIKeyConfig({ onConfigChange }: APIKeyConfigProps) {
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ftc-ai-config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setProvider(config.provider || 'anthropic');
        setApiKey(config.apiKey || '');
        setModel(config.model || '');
        setIsConfigured(!!config.apiKey);

        if (config.apiKey) {
          onConfigChange(config);
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    const config = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || getDefaultModel(provider),
    };

    localStorage.setItem('ftc-ai-config', JSON.stringify(config));
    setIsConfigured(true);
    onConfigChange(config);
  };

  const handleClear = () => {
    localStorage.removeItem('ftc-ai-config');
    setApiKey('');
    setModel('');
    setIsConfigured(false);
  };

  const getDefaultModel = (p: AIProvider): string => {
    return p === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o-mini';
  };

  return (
    <div className="glass glass-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text">API Configuration</h3>
        {isConfigured && (
          <span className="text-xs text-accent flex items-center gap-1.5">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            Ready
          </span>
        )}
      </div>

      {!isConfigured && (
        <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-xl">
          <p className="text-xs text-accent">
            ⚠️ Enter your API key to start generating code
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs text-textMuted">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AIProvider)}
            className="w-full mt-1 px-3 py-2 bg-black/30 glass-border rounded-xl text-sm text-text focus:outline-none focus:border-accent/50"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-textMuted">
            API Key {provider === 'anthropic' ? '(sk-ant-...)' : '(sk-...)'}
          </label>
          <div className="relative mt-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key here"
              className="w-full px-3 py-2 pr-16 bg-black/30 glass-border rounded-xl text-sm text-text focus:outline-none focus:border-accent/50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-textMuted hover:text-text px-2 py-1 rounded hover:bg-white/10"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-textMuted">
            Model (optional)
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={getDefaultModel(provider)}
            className="w-full mt-1 px-3 py-2 bg-black/30 glass-border rounded-xl text-sm text-text focus:outline-none focus:border-accent/50"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl hover:bg-accentHover font-medium text-sm shadow-glow"
          >
            Save Configuration
          </button>
          {isConfigured && (
            <button
              onClick={handleClear}
              className="px-4 py-2.5 glass glass-border text-textMuted rounded-xl hover:glass-hover text-sm"
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-textDim">
          Your API key is stored locally and sent only to {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}.
        </p>
      </div>
    </div>
  );
}
