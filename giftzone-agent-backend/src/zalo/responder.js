/**
 * Responder — xử lý @mention và gửi reply vào group
 */
import { MessageType } from 'zca-js';
import { answer } from '../rag/retriever.js';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Responder');

export class MentionResponder {
  constructor(api) {
    this.api = api;
  }

  async handle(ctx) {
    const { groupId, senderUid, senderName, query: userQuery, ts, isDirect } = ctx;

    // Bỏ qua query rỗng
    if (!userQuery || userQuery.trim().length < 2) {
      await this._send(groupId, `Bạn cần hỏi gì không? 😊`, isDirect);
      return;
    }

    try {
      const result = await answer(userQuery);

      const reply = result.answer;
      await this._send(groupId, reply, isDirect);

      // Log vào DB
      await this._logInteraction({
        groupId,
        senderUid,
        query: userQuery,
        answer: result.answer,
        sources: result.sources,
        latency_ms: result.latency_ms,
        is_answered: result.is_answered,
        top_score: result.top_score,
      });

    } catch (err) {
      log.error('RAG pipeline lỗi', err.message);
      await this._send(groupId, '❌ Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại sau.', isDirect);
    }
  }

  async _send(threadId, text, isDirect = false) {
    try {
      const type = isDirect ? MessageType.DirectMessage : MessageType.GroupMessage;
      await this.api.sendMessage({ msg: text }, threadId, type);
    } catch (err) {
      log.error('Gửi tin thất bại', err.message);
    }
  }

  async _logInteraction({ groupId, senderUid, query: q, answer: a, sources, latency_ms, is_answered = true, top_score = null }) {
    try {
      await query(
        `INSERT INTO ai_logs (group_id, sender_uid, query, answer, sources, latency_ms, is_answered, top_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [groupId, senderUid, q, a, JSON.stringify(sources), latency_ms, is_answered, top_score]
      );
    } catch (err) {
      log.error('Log DB lỗi', err.message);
    }
  }
}
