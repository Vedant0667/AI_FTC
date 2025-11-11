/**
 * Claude/GPT Streaming API Route
 * Edge runtime for low-latency streaming responses
 * BYOK: API key provided by client
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '@/lib/prompt/system';
import { queryWithRobotContext, formatContextForPrompt, ensureRAGInitialized, getRAGStatus } from '@/lib/rag/query';
import { buildFullGenerationPrompt } from '@/lib/modes/full-generation';
import { buildAssistPrompt } from '@/lib/modes/assist';
import { buildCopilotPlanPrompt, buildCopilotGeneratePrompt } from '@/lib/modes/copilot';

export const runtime = 'nodejs';

interface RequestBody {
  mode: 'full-generation' | 'assist' | 'copilot';
  robotConfig: any;
  userPrompt: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  copilotPhase?: 'plan' | 'generate';
  approvedPlan?: string;
  apiKey: string;
  provider: 'anthropic' | 'openai';
  model?: string;
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const {
      mode,
      robotConfig,
      userPrompt,
      conversationHistory = [],
      copilotPhase,
      approvedPlan,
      apiKey,
      provider = 'anthropic',
      model,
    } = body;

    if (!apiKey) {
      return new Response('API key required', { status: 400 });
    }

    console.log('[API] Received request - Provider:', provider, 'Model:', model);
    console.log('[API] API Key received:', apiKey ? `${apiKey.substring(0, 10)}... (length: ${apiKey.length})` : 'MISSING');

    await ensureRAGInitialized();
    const ragStatus = getRAGStatus();
    if (!ragStatus.initialized || ragStatus.documentCount === 0) {
      return new Response(
        JSON.stringify({ error: 'RAG sources not ready yet. Please wait for initialization to finish.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // RAG: Retrieve relevant documentation
    const ragResult = await queryWithRobotContext(userPrompt, robotConfig, 5);
    const retrievedContext = formatContextForPrompt(ragResult);

    // Build mode-specific prompt
    let userMessage = '';

    if (mode === 'full-generation') {
      userMessage = buildFullGenerationPrompt(userPrompt, robotConfig, retrievedContext);
    } else if (mode === 'assist') {
      userMessage = buildAssistPrompt(userPrompt, robotConfig, retrievedContext);
    } else if (mode === 'copilot') {
      if (copilotPhase === 'plan') {
        userMessage = buildCopilotPlanPrompt(userPrompt, robotConfig, retrievedContext);
      } else {
        userMessage = buildCopilotGeneratePrompt(
          userPrompt,
          robotConfig,
          retrievedContext,
          approvedPlan || ''
        );
      }
    }

    // Call AI provider
    if (provider === 'anthropic') {
      return await streamClaude(apiKey, model, userMessage, conversationHistory);
    } else {
      return await streamOpenAI(apiKey, model, userMessage, conversationHistory);
    }
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function streamClaude(
  apiKey: string,
  model: string | undefined,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  try {
    console.log('[Anthropic] API Key prefix:', apiKey.substring(0, 10) + '...');
    console.log('[Anthropic] API Key length:', apiKey.length);

    const anthropic = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true
    });

    const messages = [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    console.log('[Anthropic] Sending request with model:', model || 'claude-sonnet-4-5-20250929');

    const stream = await anthropic.messages.stream({
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          console.log('[Anthropic] Stream completed successfully');
          controller.close();
        } catch (error) {
          console.error('[Anthropic] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Anthropic] Request failed:', error);
    throw error;
  }
}

async function streamOpenAI(
  apiKey: string,
  model: string | undefined,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  try {
    const openai = new OpenAI({ apiKey });

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    console.log('[OpenAI] Sending request with model:', model || 'gpt-4o-mini');

    const stream = await openai.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages,
      stream: true,
      max_tokens: 4096,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          console.log('[OpenAI] Stream completed successfully');
          controller.close();
        } catch (error) {
          console.error('[OpenAI] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[OpenAI] Request failed:', error);
    throw error;
  }
}
