'use client';

import { useState, useEffect } from 'react';

interface RAGConfigProps {
  onInitialize: (openaiKey?: string) => Promise<void>;
  onAddRepo: (repoURL: string) => Promise<void>;
  apiConfig: {
    provider: 'anthropic' | 'openai';
    apiKey: string;
  } | null;
}

export function RAGConfig({ onInitialize, onAddRepo, apiConfig }: RAGConfigProps) {
  const [ragStatus, setRagStatus] = useState<{
    initialized: boolean;
    documentCount: number;
    chunkCount: number;
    embeddedChunks: number;
  } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [userRepo, setUserRepo] = useState('');
  const [isAddingRepo, setIsAddingRepo] = useState(false);

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

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      const openaiKey = apiConfig?.provider === 'openai' ? apiConfig.apiKey : undefined;
      await onInitialize(openaiKey);
      await checkRAGStatus();
    } catch (error) {
      console.error('RAG initialization failed:', error);
      alert('Failed to initialize RAG system. Check console for details.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAddRepo = async () => {
    if (!userRepo.trim()) {
      alert('Please enter your GitHub repository URL');
      return;
    }
    setIsAddingRepo(true);
    try {
      await onAddRepo(userRepo.trim());
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
        <h3 className="text-sm font-medium text-text">RAG System</h3>
        {ragStatus?.initialized && (
          <span className="text-xs text-accent flex items-center gap-1.5">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            Active
          </span>
        )}
      </div>
      {ragStatus && ragStatus.initialized ? (
        <div className="space-y-2">
          <div className="text-xs text-textMuted">
            <div>Documents: {ragStatus.documentCount}</div>
            <div>Chunks: {ragStatus.chunkCount}</div>
            <div>Search: {ragStatus.embeddedChunks > 0 ? 'Semantic (OpenAI)' : 'BM25 (Text)'}</div>
          </div>
          <div className="pt-2 border-t border-white/10">
            <label className="text-xs text-textMuted">Add Your Team Repository</label>
            <input type="text" value={userRepo} onChange={(e) => setUserRepo(e.target.value)} placeholder="https://github.com/your-team/FtcRobotController" className="w-full mt-1 px-3 py-2 bg-black/30 glass-border rounded-xl text-sm text-text focus:outline-none focus:border-accent/50" />
            <button onClick={handleAddRepo} disabled={isAddingRepo} className="w-full mt-2 px-4 py-2 bg-accent/20 text-accent rounded-xl hover:bg-accent/30 font-medium text-sm glass-border disabled:opacity-50">{isAddingRepo ? 'Adding Repository...' : 'Add Repository'}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 bg-accent/10 border border-accent/30 rounded-xl">
            <p className="text-xs text-accent">{apiConfig.provider === 'openai' ? '✓ Will use OpenAI embeddings for semantic search' : '✓ Will use BM25 text matching (works with Claude)'}</p>
          </div>
          <button onClick={handleInitialize} disabled={isInitializing} className="w-full px-4 py-2.5 bg-accent text-white rounded-xl hover:bg-accentHover font-medium text-sm shadow-glow disabled:opacity-50">{isInitializing ? 'Initializing RAG...' : 'Initialize RAG System'}</button>
          <p className="text-xs text-textDim">Fetches DECODE manual, SDK, Road Runner, Pedro Pathing, FTCLib, EasyOpenCV, GM0, and world champion team code (~5-10 min)</p>
        </div>
      )}
    </div>
  );
}
