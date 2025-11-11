'use client';

import { useState, useEffect } from 'react';

interface RAGConfigProps {
  onAddRepo: (repoURL: string, openaiKey?: string) => Promise<void>;
  triggering?: 'auto';
  apiConfig: {
    provider: 'anthropic' | 'openai';
    apiKey: string;
  } | null;
}

export function RAGConfig({ onAddRepo, apiConfig }: RAGConfigProps) {
  const [ragStatus, setRagStatus] = useState<{
    initialized: boolean;
    initializing: boolean;
    searchMode: 'semantic' | 'bm25';
    documentCount: number;
    chunkCount: number;
    embeddedChunks: number;
  } | null>(null);
  const [userRepo, setUserRepo] = useState('');
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [openaiOverride, setOpenaiOverride] = useState('');

  const showOpenAIField = apiConfig?.provider !== 'openai';

  useEffect(() => {
    checkRAGStatus();
  }, []);

  const checkRAGStatus = async () => {
    try {
      const res = await fetch('/api/rag/init');
      const status = await res.json();
      setRagStatus(status);
    } catch (error) {
      console.error('Failed to check RAG status:', error);
    }
  };

  const handleAddRepo = async () => {
    if (!userRepo.trim()) {
      alert('Please enter your GitHub repository URL');
      return;
    }
    setIsAddingRepo(true);
    try {
      const openaiKey = apiConfig?.provider === 'openai'
        ? apiConfig.apiKey
        : openaiOverride.trim() || undefined;
      await onAddRepo(userRepo.trim(), openaiKey);
      await checkRAGStatus();
      setUserRepo('');
    } catch (error) {
      console.error('Failed to add repository:', error);
      alert('Failed to add repository. Check console for details.');
    } finally {
      setIsAddingRepo(false);
    }
  };

  if (!apiConfig) {
    return (
      <div className="glass glass-border rounded-2xl p-5">
        <div className="text-xs text-textMuted">Configure your API key first to enable RAG</div>
      </div>
    );
  }

  return (
    <div className="glass glass-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">RAG System</h3>
          <p className="text-xs text-textDim mt-0.5">Auto-loads DECODE sources at startup</p>
        </div>
        <span className="text-xs text-accent flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              ragStatus?.initializing
                ? 'bg-amber-400 animate-pulse'
                : ragStatus?.initialized
                ? 'bg-accent animate-pulse'
                : 'bg-textDim'
            }`}
          />
          {ragStatus?.initializing ? 'Syncing...' : ragStatus?.initialized ? 'Ready' : 'Idle'}
        </span>
      </div>
      {ragStatus && ragStatus.initialized ? (
        <div className="space-y-2">
          <div className="text-xs text-textMuted space-y-1">
            <div>Documents: {ragStatus.documentCount}</div>
            <div>Chunks: {ragStatus.chunkCount}</div>
            <div>
              Search Mode:{' '}
              {ragStatus.searchMode === 'semantic'
                ? 'Semantic (OpenAI embeddings)'
                : 'BM25 text (Claude compatible)'}
            </div>
          </div>
          {showOpenAIField && (
            <div className="space-y-1">
              <label className="text-xs text-textMuted">OpenAI API key (optional for embeddings/repo ingest)</label>
              <input
                type="password"
                value={openaiOverride}
                onChange={(e) => setOpenaiOverride(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-black/30 glass-border rounded-xl text-sm text-text focus:outline-none focus:border-accent/50 font-mono"
              />
            </div>
          )}
          <div className="pt-2 border-t border-white/10">
            <label className="text-xs text-textMuted">Add Your Team Repository</label>
            <input type="text" value={userRepo} onChange={(e) => setUserRepo(e.target.value)} placeholder="https://github.com/your-team/FtcRobotController" className="w-full mt-1 px-3 py-2 bg-black/30 glass-border rounded-xl text-sm text-text focus:outline-none focus:border-accent/50" />
            <button onClick={handleAddRepo} disabled={isAddingRepo} className="w-full mt-2 px-4 py-2 bg-accent/20 text-accent rounded-xl hover:bg-accent/30 font-medium text-sm glass-border disabled:opacity-50">{isAddingRepo ? 'Adding Repository...' : 'Add Repository'}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 bg-accent/10 border border-accent/30 rounded-xl">
            <p className="text-xs text-accent">Syncing FTC sources… this runs automatically whenever the server starts.</p>
          </div>
          {showOpenAIField && (
            <div>
              <label className="text-xs text-textMuted">Optional OpenAI API key (improves search accuracy)</label>
              <input
                type="password"
                value={openaiOverride}
                onChange={(e) => setOpenaiOverride(e.target.value)}
                placeholder="sk-..."
                className="w-full mt-1 px-3 py-2 bg-black/30 glass-border rounded-xl text-sm text-text focus:outline-none focus:border-accent/50 font-mono"
              />
            </div>
          )}
          <p className="text-xs text-textDim">Documents load automatically (no action needed). Add your team repo below once ready.</p>
        </div>
      )}
    </div>
  );
}
