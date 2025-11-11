/**
 * Add User Repository to RAG
 */

import { addUserRepository, getRAGStatus } from '@/lib/rag/query';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { repoURL, openaiApiKey } = await req.json();

    if (!repoURL) {
      return new Response(
        JSON.stringify({ error: 'Repository URL required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[API] Adding user repository: ${repoURL}`);

    await addUserRepository(repoURL, openaiApiKey);

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
    console.error('[API] Failed to add repository:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
