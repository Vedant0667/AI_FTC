/**
 * RAG Query and Retrieval Logic
 * Hybrid search: embeddings (if available) + BM25 text matching
 */

import { FTCDocument, RAGQuery, RAGResult } from '../types';
import { documentToChunks, ingestAllSources, fetchUserRepo } from './ingest';
import { DEFAULT_TOP_K, RELEVANCE_THRESHOLD, DocumentChunk, SOURCE_WEIGHT, SourcePriority } from './types';
import { OpenAIEmbeddings, cosineSimilarity } from './embeddings';

// In-memory stores
let documentStore: FTCDocument[] = [];
let chunkStore: DocumentChunk[] = [];
let isInitialized = false;
let initPromise: Promise<void> | null = null;
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
async function runInitialization(openaiApiKey?: string, options: { force?: boolean } = {}) {
  console.log('[RAG] Initializing RAG system...');

  if (openaiApiKey) {
    try {
      embeddings = new OpenAIEmbeddings(openaiApiKey);
      useEmbeddings = true;
      console.log('[RAG] Using OpenAI embeddings for semantic search');
    } catch (error) {
      console.warn('[RAG] Failed to initialize embeddings, falling back to BM25:', error);
      embeddings = null;
      useEmbeddings = false;
    }
  } else {
    embeddings = null;
    useEmbeddings = false;
    console.log('[RAG] Using BM25 text matching (no embeddings)');
  }

  console.log('[RAG] Ingesting documents...');
  const docs = await ingestAllSources({ force: options.force });
  documentStore = docs;

  console.log('[RAG] Creating chunks...');
  chunkStore = [];
  for (const doc of docs) {
    const chunks = documentToChunks(doc);
    chunkStore.push(...chunks);
  }

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

export async function initializeRAG(openaiApiKey?: string, options: { force?: boolean } = {}): Promise<void> {
  if (isInitialized && !options.force) {
    return;
  }

  if (!initPromise || options.force) {
    if (options.force) {
      isInitialized = false;
      documentStore = [];
      chunkStore = [];
    }

    initPromise = runInitialization(openaiApiKey, options)
      .catch(error => {
        console.error('[RAG] Initialization failed:', error);
        isInitialized = false;
        throw error;
      })
      .finally(() => {
        initPromise = null;
      });
  }

  await initPromise;
}

export function ensureRAGInitialized(): Promise<void> {
  if (isInitialized) {
    return Promise.resolve();
  }

  if (!initPromise) {
    initPromise = runInitialization()
      .catch(error => {
        console.error('[RAG] Auto-initialization failed:', error);
        isInitialized = false;
        throw error;
      })
      .finally(() => {
        initPromise = null;
      });
  }

  return initPromise;
}

// Auto-start initialization on module load (BM25 mode)
ensureRAGInitialized().catch(error => {
  console.error('[RAG] Background initialization failed:', error);
});

/**
 * Add user repository to RAG
 */
export async function addUserRepository(repoURL: string, openaiApiKey?: string): Promise<void> {
  if (openaiApiKey && (!embeddings || !useEmbeddings)) {
    embeddings = new OpenAIEmbeddings(openaiApiKey);
    useEmbeddings = true;
  }

  console.log('[RAG] Adding user repository...');
  const userDocs = await fetchUserRepo(repoURL);
  documentStore.push(...userDocs);

  // Convert to chunks and embed
  for (const doc of userDocs) {
    const chunks = documentToChunks(doc);

    if (useEmbeddings && embeddings) {
      const texts = chunks.map(c => c.content);
      const chunkEmbeddings = await embeddings.embedTexts(texts);

      for (let i = 0; i < chunks.length; i++) {
        chunks[i].embedding = chunkEmbeddings[i];
      }
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
  const weight = SOURCE_WEIGHT[priority as keyof typeof SOURCE_WEIGHT] ?? 1;
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

  const vendorHint = /limelight/i.test(query.query)
    ? SourcePriority.LIMELIGHT
    : /road ?runner/i.test(query.query)
    ? SourcePriority.ROADRUNNER
    : /ftc ?lib/i.test(query.query)
    ? SourcePriority.FTCLIB
    : null;

  let chunkPool = chunkStore;
  if (vendorHint) {
    const vendorChunks = chunkStore.filter(
      chunk => chunk.metadata.sourcePriority === vendorHint
    );
    if (vendorChunks.length > 0) {
      chunkPool = vendorChunks;
    }
  }

  const tokens = query.query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2);

  const vendorKeywords: Record<number, string[]> = {
    [SourcePriority.LIMELIGHT]: ['limelight', 'llresult', 'limelight3a', 'detectorresult'],
    [SourcePriority.ROADRUNNER]: ['roadrunner', 'trajectory', 'driveconstants'],
    [SourcePriority.FTCLIB]: ['ftclib', 'commandscheduler', 'subsystem'],
  };

  const keywordWeights = new Map<string, number>();
  tokens.forEach(token => {
    keywordWeights.set(token, (keywordWeights.get(token) || 0) + 1);
  });

  function keywordScore(text: string, priority: number): number {
    let score = 0;
    const lower = text.toLowerCase();

    keywordWeights.forEach((weight, token) => {
      if (token.length < 3) return;
      const occurrences = lower.split(token).length - 1;
      if (occurrences > 0) {
        score += occurrences * (weight + 1);
      }
    });

    if (vendorKeywords[priority]) {
      for (const kw of vendorKeywords[priority]) {
        if (lower.includes(kw)) {
          score += 10;
        }
      }
    }

    return score;
  }

  let scoredChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

  if (useEmbeddings && embeddings) {
    // Semantic search with embeddings
    const queryEmbedding = await embeddings.embedQuery(query.query);

    scoredChunks = chunkPool
      .filter(chunk => chunk.embedding)
      .map(chunk => {
        let score = cosineSimilarity(queryEmbedding, chunk.embedding!);
        score = applyPriorityWeighting(score, chunk.metadata.sourcePriority);
        return { chunk, score };
      });
  } else {
    // BM25 text matching
    const avgDocLength = chunkPool.reduce((sum, c) => sum + c.content.split(/\s+/).length, 0) / chunkPool.length;

    scoredChunks = chunkPool.map(chunk => {
      let score = keywordScore(chunk.content, chunk.metadata.sourcePriority);
      if (score === 0) {
        score = bm25Score(query.query, chunk.content, avgDocLength);
      }
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

  let results = Array.from(docMap.values());
  results.sort((a, b) => b.score - a.score);

  if (vendorHint) {
    results = results.filter(r => r.doc.sourcePriority === vendorHint);
    if (results.length === 0) {
      const vendorDocs = chunkStore
        .filter(chunk => chunk.metadata.sourcePriority === vendorHint)
        .map(chunk => ({
          doc: documentStore.find(d => d.id === chunk.documentId)!,
          score: 1,
        }))
        .filter(r => r.doc)
        .slice(0, topK);
      results = vendorDocs;
    }
  }

  if (results.length > 0) {
    console.log('[RAG] Top documents:', results.slice(0, 5).map(r => ({
      title: r.doc.title,
      source: r.doc.sourceURL,
      priority: r.doc.sourcePriority,
      score: r.score.toFixed(3),
    })));
  } else {
    console.warn('[RAG] No documents matched query:', query.query.slice(0, 120));
  }

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

  const MAX_TOTAL_CHARS = 8000;
  const MAX_PER_DOC = 1500;
  let used = 0;
  let context = `# Retrieved FTC Source Code and Documentation

IMPORTANT: Use only these sources. If the needed API/class isn’t here, state that explicitly.

`;

  for (let i = 0; i < result.documents.length; i++) {
    if (used >= MAX_TOTAL_CHARS) break;
    const doc = result.documents[i];
    const snippet = doc.content.slice(0, MAX_PER_DOC);
    const block = `## Source [${i + 1}] - ${doc.title}
URL: ${doc.sourceURL}
Priority: ${doc.sourcePriority}

\n\n${snippet}\n\n---\n\n`;

    context += block;
    used += block.length;
  }

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
  const vendorTerms: string[] = [];
  const classNames: string[] = [];

  // Extract technical keywords from prompt
  const promptLower = userPrompt.toLowerCase();

  if (promptLower.includes('limelight')) {
    configTerms.push('Limelight3A LLResult DetectorResult getLatestResult');
    classNames.push('com.qualcomm.hardware.limelightvision');
    vendorTerms.push('limelight limelightvision limelight3a sensorlimelight3a');
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
    vendorTerms.push('limelight3a limelightvision llresult');
  }

  if (/limelight/i.test(userPrompt)) {
    vendorTerms.push('limelight limelightvision limelight3a limelightresult sensorlimelight3a');
  }

  if (/road ?runner/i.test(userPrompt)) {
    vendorTerms.push('road runner DriveConstants SampleMecanumDrive');
  }

  if (/ftc ?lib/i.test(userPrompt)) {
    vendorTerms.push('FTCLib CommandScheduler SubsystemBase');
  }

  const enhancedQuery = `${userPrompt} ${configTerms.join(' ')} ${classNames.join(' ')} ${vendorTerms.join(' ')}`;

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
    initializing: !!initPromise,
    searchMode: useEmbeddings ? 'semantic' : 'bm25',
    documentCount: documentStore.length,
    chunkCount: chunkStore.length,
    embeddedChunks: chunkStore.filter(c => c.embedding).length,
  };
}
