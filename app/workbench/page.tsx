'use client';

import { useState, useRef, useEffect } from 'react';
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
type ChatSession = {
  id: string;
  title: string;
  history: Message[];
};

const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createSession = (title: string): ChatSession => ({
  id: generateSessionId(),
  title,
  history: [],
});
  const [copilotPhase, setCopilotPhase] = useState<'plan' | 'generate'>('plan');
  const [approvedPlan, setApprovedPlan] = useState('');
  const [apiConfig, setApiConfig] = useState<{
    provider: 'anthropic' | 'openai';
    apiKey: string;
    model?: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
const [statusMessage, setStatusMessage] = useState('Idle');
const [sessions, setSessions] = useState<ChatSession[]>([createSession('Session 1')]);
const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);
const [sessionsLoaded, setSessionsLoaded] = useState(false);
const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
const conversationHistory = activeSession?.history ?? [];

const updateActiveSessionHistory = (updater: (history: Message[]) => Message[]) => {
  setSessions((prev) =>
    prev.map((session) =>
      session.id === activeSessionId
        ? { ...session, history: updater(session.history) }
        : session
    )
  );
};

const handleNewSession = () => {
  const newSession = createSession(`Session ${sessions.length + 1}`);
  setSessions((prev) => [newSession, ...prev]);
  setActiveSessionId(newSession.id);
  setUserPrompt('');
  setResponse('');
  setGeneratedFiles([]);
  setCopilotPhase('plan');
  setApprovedPlan('');
};

const handleSelectSession = (sessionId: string) => {
  setActiveSessionId(sessionId);
  setUserPrompt('');
  setGeneratedFiles([]);
  setCopilotPhase('plan');
  setApprovedPlan('');
  setResponse('');
};

const handleRenameSession = (sessionId: string) => {
  if (typeof window === 'undefined') return;
  const current = sessions.find((session) => session.id === sessionId);
  if (!current) return;
  const nextTitle = window.prompt('Session name', current.title)?.trim();
  if (!nextTitle) return;
  setSessions((prev) =>
    prev.map((session) =>
      session.id === sessionId ? { ...session, title: nextTitle } : session
    )
  );
};

const handleDeleteSession = (sessionId: string) => {
  setSessions(prev => {
    if (prev.length <= 1) {
      updateActiveSessionHistory(() => []);
      return prev;
    }

    const filtered = prev.filter(session => session.id !== sessionId);
    if (!filtered.length) {
      return prev;
    }

    if (sessionId === activeSessionId) {
      const nextActive = filtered[0];
      setActiveSessionId(nextActive.id);
      setUserPrompt('');
      setResponse('');
      setGeneratedFiles([]);
      setCopilotPhase('plan');
      setApprovedPlan('');
    }

    return filtered;
  });
};

const abortControllerRef = useRef<AbortController | null>(null);
const ragInitRequested = useRef(false);

useEffect(() => {
  if (ragInitRequested.current) return;
  ragInitRequested.current = true;
  setStatusMessage('Syncing FTC knowledge base...');
  handleRAGInitialize().catch((error) => {
    console.error('Auto RAG init failed:', error);
    ragInitRequested.current = false;
    setStatusMessage('RAG sync failed — check console');
  }).finally(() => {
    setStatusMessage('Ready');
  });
}, []);

useEffect(() => {
  if (isStreaming) return;
  const lastAssistant = [...conversationHistory].reverse().find((msg) => msg.role === 'assistant');
  setResponse(lastAssistant?.content ?? '');
}, [activeSessionId, sessions, isStreaming, conversationHistory]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  const stored = window.localStorage.getItem('ftc-workbench-sessions');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        setSessions(parsed);
        setActiveSessionId(parsed[0].id);
      }
    } catch (error) {
      console.warn('Failed to load sessions from storage:', error);
    }
  }
  setSessionsLoaded(true);
}, []);

useEffect(() => {
  if (!sessionsLoaded || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('ftc-workbench-sessions', JSON.stringify(sessions));
  } catch (error) {
    console.warn('Failed to persist sessions:', error);
  }
}, [sessions, sessionsLoaded]);

  const handleRAGInitialize = async (openaiKey?: string) => {
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

  const handleRAGAddRepo = async (repoURL: string, openaiKey?: string) => {
    const res = await fetch('/api/rag/add-repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoURL, openaiApiKey }),
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

    const requestHistory = [...conversationHistory, { role: 'user', content: userPrompt }];

    if (conversationHistory.length === 0 && userPrompt.trim()) {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId
            ? { ...session, title: userPrompt.slice(0, 32) }
            : session
        )
      );
    }

    setIsStreaming(true);
    setResponse('');
    setGeneratedFiles([]);
    setStatusMessage('Retrieving FTC sources...');

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    updateActiveSessionHistory((history) => [...history, { role: 'user', content: userPrompt }]);

    try {
      const requestBody = {
        mode,
        robotConfig,
        userPrompt,
        conversationHistory: requestHistory,
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

      setStatusMessage('Generating answer...');

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
      updateActiveSessionHistory((history) => [...history, { role: 'assistant', content: accumulated }]);

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

      setStatusMessage('Ready');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setResponse(response + '\n\n[Cancelled by user]');
        setStatusMessage('Cancelled');
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
        setStatusMessage('Error — see console');
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

  const getDisplayHistory = () => {
    const history: Message[] = [...conversationHistory];
    if (isStreaming && response) {
      history.push({ role: 'assistant', content: response });
    }
    return history;
  };

  const handleReset = () => {
    setUserPrompt('');
    setResponse('');
    setGeneratedFiles([]);
    updateActiveSessionHistory(() => []);
    setApprovedPlan('');
    setCopilotPhase('plan');
  };

  return (
    <div className="h-screen flex bg-background gradient-mesh">
      <aside className="hidden lg:flex w-64 border-r border-border flex-col bg-black/20 backdrop-blur">
        <div className="px-4 py-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-text">Sessions</span>
          <button
            onClick={handleNewSession}
            className="px-2 py-1 text-xs bg-accent text-background rounded-md hover:bg-accentHover"
          >
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {sessions.map(session => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                onDoubleClick={() => handleRenameSession(session.id)}
                className={`rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-surface border-accent text-text'
                    : 'bg-transparent border-transparent text-textMuted hover:bg-surface/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {session.title || 'Untitled Session'}
                    </div>
                    <div className="text-xs text-textDim">{session.history.length} messages</div>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-textDim hover:text-text transition-colors"
                      title="Delete session"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12zM10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative">
        <div className="lg:hidden px-4 pt-4 flex items-center gap-2">
          <select
            value={activeSessionId}
            onChange={(e) => handleSelectSession(e.target.value)}
            className="flex-1 bg-surface border border-border text-sm text-text rounded-xl px-3 py-2"
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleNewSession}
            className="px-3 py-2 rounded-xl bg-accent text-background text-sm font-medium"
          >
            New
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pt-20 pb-48">
            {conversationHistory.length === 0 && !response ? (
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
                  <button onClick={() => setUserPrompt('Create an autonomous OpMode with AprilTag navigation')} className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left">
                    <div className="text-sm font-medium text-text">AprilTag Navigation</div>
                    <div className="text-xs text-textDim mt-1">Autonomous with vision</div>
                  </button>
                  <button onClick={() => setUserPrompt('Setup mecanum drive with field-centric control')} className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left">
                    <div className="text-sm font-medium text-text">Mecanum Drive</div>
                    <div className="text-xs text-textDim mt-1">Field-centric TeleOp</div>
                  </button>
                  <button onClick={() => setUserPrompt('Integrate Limelight for game piece detection')} className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left">
                    <div className="text-sm font-medium text-text">Limelight Vision</div>
                    <div className="text-xs text-textDim mt-1">Object detection</div>
                  </button>
                  <button onClick={() => setUserPrompt('Setup Road Runner for autonomous trajectories')} className="glass glass-border rounded-2xl p-4 hover:glass-hover transition-all text-left">
                    <div className="text-sm font-medium text-text">Road Runner</div>
                    <div className="text-xs text-textDim mt-1">Motion planning</div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                <OutputSections content={response} isStreaming={isStreaming} messages={getDisplayHistory()} />
                {generatedFiles.length > 0 && (
                  <div className="glass glass-border rounded-2xl">
                    <FileDownloadBar files={generatedFiles} enabled={!isStreaming} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 lg:left-64 p-6 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <form id="prompt-form" onSubmit={handleSubmit} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-textMuted px-1">
                <span>{statusMessage}</span>
                {mode === 'copilot' && copilotPhase === 'plan' && approvedPlan && (
                  <button
                    type="button"
                    onClick={handleCopilotGenerateCode}
                    className="text-accent underline"
                  >
                    Generate code from plan
                  </button>
                )}
              </div>
              <div className="glass glass-border rounded-3xl shadow-glass p-2 transition-all">
                <div className="flex items-end gap-3">
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const form = document.getElementById('prompt-form') as HTMLFormElement | null;
                        form?.requestSubmit();
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
                      onClick={() => setShowSettings(true)}
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
                <RAGConfig onAddRepo={handleRAGAddRepo} apiConfig={apiConfig} />
                <ModeToggle mode={mode} onChange={setMode} />
                <RobotConfigForm config={robotConfig} onChange={setRobotConfig} />

                {(conversationHistory.length > 0 || response) && (
                  <button
                    onClick={handleReset}
                    className="w-full px-5 py-3 rounded-xl glass glass-border text-textMuted hover:glass-hover transition-all text-sm font-medium"
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
