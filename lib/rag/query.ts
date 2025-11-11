/**
 * RAG Query and Retrieval Logic
 * Hybrid search: embeddings (if available) + BM25 text matching
 */

import { FTCDocument, RAGQuery, RAGResult } from '../types';
import { documentToChunks, ingestAllSources, fetchUserRepo } from './ingest';
import { DEFAULT_TOP_K, RELEVANCE_THRESHOLD, DocumentChunk } from './types';
import { OpenAIEmbeddings, cosineSimilarity } from './embeddings';

// In-memory stores
let documentStore: FTCDocument[] = [];
let chunkStore: DocumentChunk[] = [];
let isInitialized = false;
let embeddings: OpenAIEmbeddings | null = null;
let useEmbeddings = false;

/**
 * BM25 scoring for text relevance
 */
function bm25Score(query: string, document: string, avgDocLength: number): number {
  const k1 = 1.5;
  const b = 0.75;

  const queryTerms = query.toLowerCase().split(/\s+/);
  const docTerms = document.toLowerCase().split(/\s+/);
  const docLength = docTerms.length;

  let score = 0;

  for (const term of queryTerms) {
    const termFreq = docTerms.filter(t => t.includes(term) || term.includes(t)).length;
    if (termFreq === 0) continue;

    // IDF approximation (simplified)
    const idf = Math.log(1 + 1 / (termFreq + 1));

    // BM25 formula
    const numerator = termFreq * (k1 + 1);
    const denominator = termFreq + k1 * (1 - b + b * (docLength / avgDocLength));

    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * Initialize RAG system with optional embeddings
 */
export async function initializeRAG(openaiApiKey?: string): Promise<void> {
  if (isInitialized) {
    console.log('[RAG] Already initialized');
    return;
  }

  console.log('[RAG] Initializing RAG system...');

  // Try to use embeddings if OpenAI key provided
  if (openaiApiKey) {
    try {
      embeddings = new OpenAIEmbeddings(openaiApiKey);
      useEmbeddings = true;
      console.log('[RAG] Using OpenAI embeddings for semantic search');
    } catch (error) {
      console.warn('[RAG] Failed to initialize embeddings, falling back to BM25:', error);
      useEmbeddings = false;
    }
  } else {
    console.log('[RAG] Using BM25 text matching (no embeddings)');
    useEmbeddings = false;
  }

  // Ingest all sources
  console.log('[RAG] Ingesting documents...');
  const docs = await ingestAllSources();
  documentStore = docs;

  // Convert to chunks
  console.log('[RAG] Creating chunks...');
  chunkStore = [];
  for (const doc of docs) {
    const chunks = documentToChunks(doc);
    chunkStore.push(...chunks);
  }

  // Generate embeddings if enabled
  if (useEmbeddings && embeddings) {
    console.log(`[RAG] Generating embeddings for ${chunkStore.length} chunks...`);
    const texts = chunkStore.map(c => c.content);

    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await embeddings.embedTexts(batch);

      for (let j = 0; j < batch.length; j++) {
        chunkStore[i + j].embedding = batchEmbeddings[j];
      }

      console.log(`[RAG] Progress: ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks embedded`);

      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  isInitialized = true;
  console.log('[RAG] Initialization complete!');
}

/**
 * Add user repository to RAG
 */
export async function addUserRepository(repoURL: string, openaiApiKey: string): Promise<void> {
  if (!embeddings) {
    embeddings = new OpenAIEmbeddings(openaiApiKey);
  }

  console.log('[RAG] Adding user repository...');
  const userDocs = await fetchUserRepo(repoURL);
  documentStore.push(...userDocs);

  // Convert to chunks and embed
  for (const doc of userDocs) {
    const chunks = documentToChunks(doc);

    const texts = chunks.map(c => c.content);
    const chunkEmbeddings = await embeddings.embedTexts(texts);

    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = chunkEmbeddings[i];
    }

    chunkStore.push(...chunks);
  }

  console.log(`[RAG] Added ${userDocs.length} files from user repository`);
}

/**
 * Apply priority weighting to scores
 * Lower priority number = higher weight
 */
function applyPriorityWeighting(score: number, priority: number): number {
  // SDK (1) gets 2.0x, Top Teams (2) gets 1.8x, etc.
  const weight = Math.max(2.2 - (priority - 1) * 0.2, 0.5);
  return score * weight;
}

/**
 * Query using hybrid search (embeddings or BM25)
 */
export async function queryRAG(query: RAGQuery): Promise<RAGResult> {
  if (!isInitialized) {
    console.warn('[RAG] System not initialized, returning empty results');
    return { documents: [], scores: [] };
  }

  const topK = query.topK || DEFAULT_TOP_K;

  let scoredChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

  if (useEmbeddings && embeddings) {
    // Semantic search with embeddings
    const queryEmbedding = await embeddings.embedQuery(query.query);

    scoredChunks = chunkStore
      .filter(chunk => chunk.embedding)
      .map(chunk => {
        let score = cosineSimilarity(queryEmbedding, chunk.embedding!);
        score = applyPriorityWeighting(score, chunk.metadata.sourcePriority);
        return { chunk, score };
      });
  } else {
    // BM25 text matching
    const avgDocLength = chunkStore.reduce((sum, c) => sum + c.content.split(/\s+/).length, 0) / chunkStore.length;

    scoredChunks = chunkStore.map(chunk => {
      let score = bm25Score(query.query, chunk.content, avgDocLength);
      score = applyPriorityWeighting(score, chunk.metadata.sourcePriority);
      return { chunk, score };
    });
  }

  // Sort by score and take top K
  scoredChunks.sort((a, b) => b.score - a.score);
  const topChunks = scoredChunks
    .filter(item => item.score > 0) // Any positive score
    .slice(0, topK);

  // Group chunks back to documents
  const docMap = new Map<string, { doc: FTCDocument; score: number }>();

  for (const item of topChunks) {
    const docId = item.chunk.documentId;
    const doc = documentStore.find(d => d.id === docId);

    if (doc) {
      const existing = docMap.get(docId);
      if (!existing || item.score > existing.score) {
        docMap.set(docId, { doc, score: item.score });
      }
    }
  }

  const results = Array.from(docMap.values());
  results.sort((a, b) => b.score - a.score);

  return {
    documents: results.map(r => r.doc),
    scores: results.map(r => r.score),
  };
}

/**
 * Format retrieved documents into context string for AI prompt
 */
export function formatContextForPrompt(result: RAGResult): string {
  if (result.documents.length === 0) {
    return `# NO RELEVANT DOCUMENTATION FOUND

CRITICAL: You do not have any retrieved documentation for this query.
You MUST tell the user that you don't have the specific information and cannot generate code without proper documentation.`;
  }

  let context = `# Retrieved FTC Source Code and Documentation

IMPORTANT: The following are the ONLY sources you can use. Do not use any knowledge outside of these retrieved documents.
If the user asks for something not covered here, say you don't have that information.

`;

  result.documents.forEach((doc, index) => {
    const relevancePercent = (result.scores[index] * 100).toFixed(1);
    context += `## Source [${index + 1}] - Relevance: ${relevancePercent}%\n`;
    context += `File: ${doc.title}\n`;
    context += `URL: ${doc.sourceURL}\n`;
    context += `Priority: ${doc.sourcePriority} (1=SDK, 2=TopTeams, 3=RoadRunner, 4=FTCLib, 5=Limelight)\n\n`;
    context += '```\n';
    context += doc.content.slice(0, 4000); // Increased to 4000 chars per doc
    context += '\n```\n\n';
    context += '---\n\n';
  });

  return context;
}

/**
 * Enhanced query that considers robot configuration
 */
export async function queryWithRobotContext(
  userPrompt: string,
  robotConfig: any,
  topK: number = DEFAULT_TOP_K
): Promise<RAGResult> {
  // Build enhanced query with specific technical terms
  const configTerms: string[] = [];
  const classNames: string[] = [];

  // Extract technical keywords from prompt
  const promptLower = userPrompt.toLowerCase();

  if (promptLower.includes('limelight')) {
    configTerms.push('Limelight3A LLResult DetectorResult getLatestResult');
    classNames.push('com.qualcomm.hardware.limelightvision');
  }

  if (promptLower.includes('road runner') || promptLower.includes('roadrunner')) {
    configTerms.push('Trajectory MecanumDrive DriveConstants followTrajectory');
    classNames.push('com.acmerobotics.roadrunner');
  }

  if (promptLower.includes('ftclib')) {
    configTerms.push('CommandOpMode Subsystem Command');
    classNames.push('com.arcrobotics.ftclib');
  }

  if (promptLower.includes('apriltag') || promptLower.includes('vision')) {
    configTerms.push('VisionPortal AprilTagProcessor AprilTagDetection');
  }

  if (robotConfig.driveType) {
    configTerms.push(robotConfig.driveType);
  }

  if (robotConfig.frameworkToggles?.roadrunner) {
    configTerms.push('trajectory pose follower');
  }

  if (robotConfig.frameworkToggles?.ftclib) {
    configTerms.push('command subsystem scheduler');
  }

  if (robotConfig.frameworkToggles?.externalVision) {
    configTerms.push('limelight detector neural network');
  }

  const enhancedQuery = `${userPrompt} ${configTerms.join(' ')} ${classNames.join(' ')}`;

  return queryRAG({
    query: enhancedQuery,
    topK,
  });
}

/**
 * Get RAG system status
 */
export function getRAGStatus() {
  return {
    initialized: isInitialized,
    documentCount: documentStore.length,
    chunkCount: chunkStore.length,
    embeddedChunks: chunkStore.filter(c => c.embedding).length,
  };
}
