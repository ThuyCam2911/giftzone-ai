/**
 * Responder — xử lý @mention và gửi reply vào group
 * - Nhóm internal: router Ops Assistant (hỏi tình trạng nhóm/issue/KPI, tóm tắt chat)
 *   → LUÔN bật trên mọi account, tự giới hạn theo group_type='internal' nên an toàn
 * - Còn lại: RAG docs — có thể tắt qua enableRagDocs (vd account deal-monitor
 *   không nên trả lời tài liệu công ty cho khách, nhưng vẫn cần trả lời Ops
 *   nếu account đó cũng là thành viên 1 nhóm internal nào đó)
 */
import { MessageType } from 'zca-js';
import { answer } from '../rag/retriever.js';
import { handleInternalQuery } from '../ops/assistant.js';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Responder');

const COOLDOWN_MS = 3000;          // chặn spam @mention từ cùng 1 user
const INTERNAL_CACHE_MS = 5 * 60 * 1000;

export class MentionResponder {
  constructor(api, { enableRagDocs = true } = {}) {
    this.api = api;
    this.enableRagDocs = enableRagDocs;
    this._lastAsk = new Map();       // senderUid → timestamp lần hỏi cuối
    this._internalGroups = new Set();
    this._internalLoadedAt = 0;
  }

  async _loadInternalGroups() {
    const now = Date.now();
    if (now - this._internalLoadedAt < INTERNAL_CACHE_MS) return;
    this._internalLoadedAt = now; // set trước để tránh stampede khi DB lỗi
    try {
      const { rows } = await query(
        `SELECT group_id FROM group_names WHERE group_type = 'internal'`
      );
      this._internalGroups = new Set(rows.map(r => r.group_id));
    } catch { /* bảng chưa có lúc startup thì bỏ qua */ }
  }

  async handle(ctx) {
    const { groupId, senderUid, senderName, query: userQuery, ts, isDirect } = ctx;

    // Cooldown per user — tránh 1 người spam gọi Gemini liên tục
    const now = Date.now();
    if (now - (this._lastAsk.get(senderUid) ?? 0) < COOLDOWN_MS) return;
    this._lastAsk.set(senderUid, now);

    // Bỏ qua query rỗng
    if (!userQuery || userQuery.trim().length < 2) {
      await this._send(groupId, `Bạn cần hỏi gì không? 😊`, isDirect);
      return;
    }

    try {
      // Ops Assistant — CHỈ trong nhóm internal (dữ liệu vận hành không cho khách thấy)
      await this._loadInternalGroups();
      if (!isDirect && this._internalGroups.has(groupId)) {
        const ops = await handleInternalQuery(userQuery);
        if (ops.handled) {
          await this._send(groupId, ops.answer, isDirect);
          await this._logInteraction({
            groupId, senderUid,
            query: userQuery,
            answer: ops.answer,
            sources: [`ops:${ops.intent}`],
            latency_ms: Date.now() - now,
            is_answered: true,
            top_score: null,
          });
          return;
        }
        // intent = docs → rơi xuống RAG bên dưới (nếu account này bật RAG docs)
      }

      // Account tắt RAG docs (vd deal-monitor): không trả lời tài liệu công ty,
      // chỉ Ops Assistant ở trên mới được phép trả lời
      if (!this.enableRagDocs) return;

      // 1:1 chat: kèm 3 lượt hỏi-đáp gần nhất để hỏi nối được
      const history = isDirect ? await this._fetchHistory(senderUid) : [];

      const result = await answer(userQuery, history);
      await this._send(groupId, result.answer, isDirect);

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
      log.error('Pipeline lỗi', err.message);
      await this._send(groupId, '❌ Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại sau.', isDirect);
    }
  }

  // 3 lượt hỏi-đáp gần nhất trong 1 giờ của user (cho follow-up 1:1)
  async _fetchHistory(senderUid) {
    try {
      const { rows } = await query(
        `SELECT query, answer FROM ai_logs
         WHERE sender_uid = $1 AND created_at >= NOW() - INTERVAL '1 hour'
         ORDER BY created_at DESC LIMIT 3`,
        [senderUid]
      );
      return rows.reverse(); // cũ → mới
    } catch {
      return [];
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
