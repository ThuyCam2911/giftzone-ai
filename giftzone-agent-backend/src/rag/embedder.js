/**
 * Embedding module — dùng Gemini gemini-embedding-001
 * Miễn phí, cùng GEMINI_API_KEY
 * outputDimensionality=1536 để tương thích HNSW index (max 2000 dims)
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Embedder');

const EMBEDDING_DIM = 1536;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

async function embedWithRetry(text, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await embModel.embedContent({
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: EMBEDDING_DIM,
      });
      return result.embedding.values;
    } catch (err) {
      const is429 = err.message?.includes('429') || err.status === 429;
      if (is429 && attempt < retries - 1) {
        const wait = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s, 16s...
        log.warn(`Rate limit — đợi ${wait / 1000}s rồi thử lại (lần ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

export async function embed(text) {
  if (!process.env.GEMINI_API_KEY) {
    log.warn('GEMINI_API_KEY chưa set — dùng random vector');
    return Array.from({ length: EMBEDDING_DIM }, () => Math.random() * 2 - 1);
  }
  return embedWithRetry(text);
}

// Sequential với delay 600ms/chunk để tránh rate limit free tier
export async function embedBatch(texts) {
  const results = [];
  for (const text of texts) {
    results.push(await embed(text));
    await new Promise(r => setTimeout(r, 600));
  }
  return results;
}

export { EMBEDDING_DIM };
