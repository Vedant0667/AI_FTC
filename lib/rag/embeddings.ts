/**
 * Embeddings using OpenAI API
 * Converts text into semantic vectors for similarity search
 */

import OpenAI from 'openai';

export class OpenAIEmbeddings {
  private client: OpenAI;
  private model = 'text-embedding-3-small';

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('[Embeddings] Failed to generate embeddings:', error);
      throw error;
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedTexts([text]);
    return embeddings[0];
  }
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
