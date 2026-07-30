/**
 * Claude API helper — dùng chung cho RAG chat, Summary, Ops Assistant, Deal Analyzer
 * Thay thế Gemini (quota free-tier chỉ 20 request/ngày, dùng chung cho cả 4 module
 * gây hết quota giữa chừng) — xem CLAUDE.md Critical Decisions Log.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from './logger.js';

const log = createLogger('Claude');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

export async function generateText(prompt, { system, temperature = 0.3, maxTokens = 600, retries = 3 } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      });
      return result.content[0]?.text ?? '';
    } catch (err) {
      const status = err.status;
      const isRetryable = status === 429 || status === 529 || status === 503;
      if (isRetryable && attempt < retries - 1) {
        const wait = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        log.warn(`Claude ${status} — đợi ${wait / 1000}s rồi thử lại (lần ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}
