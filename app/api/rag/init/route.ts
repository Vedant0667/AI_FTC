/**
 * RAG Initialization API
 * Initializes the RAG system with embeddings
 */

import { initializeRAG, getRAGStatus } from '@/lib/rag/query';

export const runtime = 'nodejs'; // Need Node runtime for file system operations

export async function POST(req: Request) {
  try {
    const { openaiApiKey } = await req.json();

    console.log('[API] Initializing RAG system...');

    // Reinitialize (forces refresh + optional embeddings)
    await initializeRAG(openaiApiKey, { force: true });

    const status = getRAGStatus();

    return new Response(
      JSON.stringify({
        success: true,
        status,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[API] RAG initialization failed:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(req: Request) {
  const status = getRAGStatus();

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
