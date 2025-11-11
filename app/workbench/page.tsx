'use client';

import { useState, useRef } from 'react';
import { ModeToggle } from '@/components/ModeToggle';
import { RobotConfigForm } from '@/components/RobotConfigForm';
import { OutputSections } from '@/components/OutputSections';
import { FileDownloadBar } from '@/components/FileDownloadBar';
import { APIKeyConfig } from '@/components/APIKeyConfig';
import { RAGConfig } from '@/components/RAGConfig';
import { Mode, RobotConfig, DEFAULT_ROBOT_CONFIG, GeneratedFile, Message } from '@/lib/types';
import { extractFiles } from '@/lib/modes/full-generation';

export default function WorkbenchPage() {
  const [mode, setMode] = useState<Mode>('full-generation');
  const [robotConfig, setRobotConfig] = useState<RobotConfig>(DEFAULT_ROBOT_CONFIG);
  const [userPrompt, setUserPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [copilotPhase, setCopilotPhase] = useState<'plan' | 'generate'>('plan');
  const [approvedPlan, setApprovedPlan] = useState('');
  const [apiConfig, setApiConfig] = useState<{
    provider: 'anthropic' | 'openai';
    apiKey: string;
    model?: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRAGInitialize = async (openaiKey: string) => {
    const res = await fetch('/api/rag/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openaiApiKey: openaiKey }),
    });

    if (!res.ok) {
      throw new Error('RAG initialization failed');
    }

    const result = await res.json();
    console.log('[RAG] Initialized:', result.status);
  };

  const handleRAGAddRepo = async (repoURL: string) => {
    const openaiKey = localStorage.getItem('ftc-openai-key');
    if (!openaiKey) {
      throw new Error('OpenAI API key not found');
    }

    const res = await fetch('/api/rag/add-repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoURL, openaiApiKey: openaiKey }),
    });

    if (!res.ok) {
      throw new Error('Failed to add repository');
    }

    const result = await res.json();
    console.log('[RAG] Repository added:', result.status);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userPrompt.trim() || isStreaming) return;

    if (!apiConfig || !apiConfig.apiKey) {
      alert('Please configure your API key first');
      return;
    }

    setIsStreaming(true);
    setResponse('');
    setGeneratedFiles([]);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const requestBody = {
        mode,
        robotConfig,
        userPrompt,
        conversationHistory,
        copilotPhase: mode === 'copilot' ? copilotPhase : undefined,
        approvedPlan: mode === 'copilot' && copilotPhase === 'generate' ? approvedPlan : undefined,
        apiKey: apiConfig.apiKey,
        provider: apiConfig.provider,
        model: apiConfig.model,
      };

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setResponse(accumulated);
        }
      }

      // Update conversation history
      setConversationHistory([
        ...conversationHistory,
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: accumulated },
      ]);

      // Extract files if in full-generation mode or copilot generate phase
      if (mode === 'full-generation' || (mode === 'copilot' && copilotPhase === 'generate')) {
        const files = extractFiles(accumulated);
        setGeneratedFiles(files);
      }

      // For copilot mode, check if we got a plan
      if (mode === 'copilot' && copilotPhase === 'plan') {
        setApprovedPlan(accumulated);
        // Don't auto-advance - wait for user to click "Generate Code"
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setResponse(response + '\n\n[Cancelled by user]');
      } else {
        console.error('Stream error:', error);

        let errorMessage = 'An error occurred';

        if (error.message) {
          errorMessage = error.message;
        }

        if (error.message?.includes('API error: 500')) {
          errorMessage = '❌ Server Error: Check the browser console for details.\n\nPossible issues:\n• Invalid API key format\n• Network connection problem\n• API endpoint error\n\nOpen DevTools (F12) → Console tab to see full error.';
        } else if (error.message?.includes('401')) {
          errorMessage = '❌ Authentication Error: Your API key is invalid or expired.\n\nPlease:\n1. Click the settings gear icon ⚙️\n2. Clear your current API key\n3. Get a new key from console.anthropic.com or platform.openai.com\n4. Save the new key';
        } else if (error.message?.includes('429')) {
          errorMessage = '❌ Rate Limit: Too many requests.\n\nPlease wait a moment and try again.';
        } else if (error.message?.includes('Failed to fetch')) {
          errorMessage = '❌ Network Error: Cannot connect to API.\n\nCheck your internet connection.';
        }

        setResponse(errorMessage);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopilotGenerateCode = () => {
    if (mode === 'copilot' && copilotPhase === 'plan') {
      setCopilotPhase('generate');
      // Trigger submit with generate phase
      setTimeout(() => {
        const form = document.getElementById('prompt-form') as HTMLFormElement;
        form?.requestSubmit();
      }, 100);
    }
  };

  const handleReset = () => {
    setUserPrompt('');
    setResponse('');
    setGeneratedFiles([]);
    setConversationHistory([]);
    setApprovedPlan('');
    setCopilotPhase('plan');
  };

  return (
    <div className="flex flex-col h-screen bg-background gradient-mesh">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages/Output Area */}
        <div className="flex-1 overflow-y-auto px-4 pt-20 pb-48">
          {!response ? (
            <div className="max-w-3xl mx-auto flex flex-col items-center justify-center h-full space-y-8 animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div className="text-center space-y-3">
                <h1 className="text-4xl font-semibold text-text tracking-tight">FTC Workbench</h1>
                <p className="text-textMuted text-lg">DECODE 2025-26 Season</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setUserPrompt('Create an autonomous OpMode with AprilTag navigation')}
                  className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left"
                >
                  <div className="text-sm font-medium text-text">AprilTag Navigation</div>
                  <div className="text-xs text-textDim mt-1">Autonomous with vision</div>
                </button>
                <button
                  onClick={() => setUserPrompt('Setup mecanum drive with field-centric control')}
                  className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left"
                >
                  <div className="text-sm font-medium text-text">Mecanum Drive</div>
                  <div className="text-xs text-textDim mt-1">Field-centric TeleOp</div>
                </button>
                <button
                  onClick={() => setUserPrompt('Integrate Limelight for game piece detection')}
                  className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left"
                >
                  <div className="text-sm font-medium text-text">Limelight Vision</div>
                  <div className="text-xs text-textDim mt-1">Object detection</div>
                </button>
                <button
                  onClick={() => setUserPrompt('Setup Road Runner for autonomous trajectories')}
                  className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left"
                >
                  <div className="text-sm font-medium text-text">Road Runner</div>
                  <div className="text-xs text-textDim mt-1">Motion planning</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              <OutputSections content={response} isStreaming={isStreaming} />
              {generatedFiles.length > 0 && (
                <div className="glass glass-border rounded-2xl">
                  <FileDownloadBar files={generatedFiles} enabled={!isStreaming} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom Input */}
        <div className="fixed bottom-0 left-0 right-0 p-6 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="glass glass-border rounded-3xl shadow-glass p-2 transition-all">
                <div className="flex items-end gap-3">
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Ask anything about FTC programming..."
                    rows={1}
                    className="flex-1 bg-transparent px-4 py-4 text-text placeholder-textDim focus:outline-none resize-none max-h-32"
                    disabled={isStreaming}
                  />
                  <div className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-3 rounded-xl glass glass-border hover:glass-hover transition-all"
                      title="Settings"
                    >
                      <svg className="w-5 h-5 text-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      type="submit"
                      disabled={!userPrompt.trim() || isStreaming || !apiConfig}
                      className={`p-3 rounded-xl transition-all ${
                        userPrompt.trim() && !isStreaming && apiConfig
                          ? 'bg-accent text-white hover:bg-accentHover shadow-glow'
                          : 'glass glass-border text-textDim cursor-not-allowed'
                      }`}
                      title="Send"
                    >
                      {isStreaming ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Settings Sidebar */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" onClick={() => setShowSettings(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-96 glass glass-border p-6 overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text">Settings</h2>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <APIKeyConfig onConfigChange={setApiConfig} />
                <RAGConfig onInitialize={handleRAGInitialize} onAddRepo={handleRAGAddRepo} apiConfig={apiConfig} />
                <ModeToggle mode={mode} onChange={setMode} />
                <RobotConfigForm config={robotConfig} onChange={setRobotConfig} />

                {response && (
                  <button
                    onClick={handleReset}
                    className="w-full px-5 py-3 rounded-xl glass glass-border text-textMuted hover:glass-hover transition-all"
                  >
                    Clear Conversation
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
