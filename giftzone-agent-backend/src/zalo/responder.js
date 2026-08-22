/**
 * Responder — xử lý @mention và gửi reply vào group
 * - Nhóm internal: router Ops Assistant (hỏi tình trạng nhóm/issue/KPI, tóm tắt chat)
 *   → LUÔN bật trên mọi account, tự giới hạn theo group_type='internal' nên an toàn
 * - Còn lại: RAG docs — có thể tắt qua enableRagDocs (vd account deal-monitor
 *   không nên trả lời tài liệu công ty cho khách, nhưng vẫn cần trả lời Ops
 *   nếu account đó cũng là thành viên 1 nhóm internal nào đó)
 */
import fs from 'fs';
import { MessageType } from 'zca-js';
import { answer } from '../rag/retriever.js';
import { handleInternalQuery } from '../ops/assistant.js';
import { isFormalQuoteIntent, startNegotiation } from '../quote/negotiation.js';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';
import { classifyQuestionType } from '../utils/classify.js';

const log = createLogger('Responder');

const COOLDOWN_MS = 3000;          // chặn spam @mention từ cùng 1 user
const INTERNAL_CACHE_MS = 5 * 60 * 1000;
// Ngắn hơn nhiều so với INTERNAL_CACHE_MS — demo_customer_uids thường được
// chỉnh trực tiếp trên Dashboard ngay trước lúc test/quay demo, KHÔNG đọc
// qua utils/config.js vì cache của module đó chỉ load 1 lần lúc backend
// khởi động (không tự refresh khi Dashboard cập nhật DB) — dùng lại giá trị
// cũ sẽ khiến demo_customer_uids mới lưu không có tác dụng cho tới khi
// restart lại backend.
const DEMO_CUSTOMER_CACHE_MS = 30 * 1000;

// Câu chào chung chung (không phải câu hỏi thật) — trả lời nhanh, không chạy RAG
// (tránh RAG chọn đại 1 tài liệu có độ liên quan thấp làm câu trả lời lạc đề)
const GREETING_RE = /^(hi+|hey+|hello+|alo+|chào|xin\s*chào|chao)[\s!.,?]*$/i;

export class MentionResponder {
  constructor(api, { enableRagDocs = true, internalOnly = false } = {}) {
    this.api = api;
    this.enableRagDocs = enableRagDocs;
    this.internalOnly = internalOnly; // true: chỉ phản hồi nhân viên GiftZone (gz_members), im lặng với người khác
    this._lastAsk = new Map();       // senderUid → timestamp lần hỏi cuối
    this._internalGroups = new Set();
    this._internalLoadedAt = 0;
    this._demoCustomerUids = new Set();
    this._demoCustomerLoadedAt = 0;
  }

  async _isAiPaused(threadId) {
    try {
      const { rows } = await query(
        `SELECT ai_paused FROM conversation_state WHERE thread_id = $1`,
        [threadId]
      );
      return rows[0]?.ai_paused === true;
    } catch {
      return false; // bảng chưa có / lỗi DB → AI vẫn hoạt động bình thường (fail-open)
    }
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
    const { groupId, senderUid, senderName, query: userQuery, ts, isDirect, isGzMember } = ctx;

    // Cooldown per user — tránh 1 người spam gọi Gemini liên tục
    const now = Date.now();
    if (now - (this._lastAsk.get(senderUid) ?? 0) < COOLDOWN_MS) return;
    this._lastAsk.set(senderUid, now);

    // internalOnly: chỉ phản hồi nhân viên GiftZone (gz_members) — người khác bị bỏ qua hoàn toàn, không có phản hồi gì
    if (this.internalOnly && !isGzMember) return;

    // zEnterprise Inbox: nhân viên đang trả lời tay trên Dashboard cho hội thoại 1:1 này
    // → AI im lặng hoàn toàn, không nhắc lại "bạn cần hỏi gì"
    if (isDirect && await this._isAiPaused(groupId)) return;

    // Bỏ qua query rỗng
    if (!userQuery || userQuery.trim().length < 2) {
      await this._send(groupId, `Bạn cần hỏi gì không? 😊`, isDirect);
      return;
    }

    // Câu chào chung chung — trả lời nhanh, không chạy RAG (tránh trả lời lạc đề dựa vào tài liệu không liên quan)
    if (GREETING_RE.test(userQuery.trim())) {
      await this._send(groupId, `Chào bạn 👋 Bạn cần hỏi gì, mình sẵn sàng hỗ trợ!`, isDirect);
      return;
    }

    // Demo showoff (nhánh ai-for-demo): UID này CŨNG nằm trong gz_members (chỉ
    // để qua được internalOnly ở trên), nhưng route như khách hàng bên ngoài —
    // BẮT BUỘC kiểm tra trước nhánh Ops/Sales-quote bên dưới, nếu không
    // opsEligible sẽ đúng (isDirect && isGzMember) và handleInternalQuery sẽ
    // xử lý "báo giá" của khách y như Sales tự hỏi giá cho bản thân.
    if (isDirect && await this._isDemoCustomer(senderUid)) {
      return this._handleCustomerFlow({ groupId, senderUid, senderName, isDirect }, userQuery, now);
    }

    try {
      // Ops Assistant — trong nhóm internal, HOẶC 1:1 với nhân viên GiftZone (vd hỏi tóm tắt 1 đoạn chat)
      // (dữ liệu vận hành không cho khách thấy — cả 2 điều kiện đều đảm bảo người hỏi là nội bộ)
      await this._loadInternalGroups();
      const inInternalGroup = !isDirect && this._internalGroups.has(groupId);
      const opsEligible = inInternalGroup || (isDirect && isGzMember);
      // Nhóm khách (vd giftzone-deal-monitor): nhân viên GZ @mention hỏi "tóm tắt"/"báo giá"
      // vẫn được trả lời (đã xác định người hỏi là nội bộ qua gz_members), nhưng KHÔNG
      // cho intent "ops" (issues/KPI) vì có thể lộ dữ liệu nhạy cảm vào nhóm có khách hàng.
      // ⚠️ Báo giá vẫn gửi file thẳng vào group này nếu hỏi ở đây — dùng DM với bot nếu
      // không muốn khách trong group thấy được file báo giá.
      const summaryOnlyEligible = !isDirect && !inInternalGroup && isGzMember;
      if (opsEligible || summaryOnlyEligible) {
        const ops = await handleInternalQuery(userQuery, {
          currentGroupId: groupId,
          summaryOnly: summaryOnlyEligible,
          senderUid,
          senderName,
        });
        if (ops.handled) {
          await this._send(groupId, ops.answer, isDirect);
          if (ops.filePath) await this._sendFile(groupId, ops.filePath, isDirect);
          await this._logInteraction({
            groupId, senderUid,
            query: userQuery,
            answer: ops.answer,
            sources: [`ops:${ops.intent}`],
            latency_ms: Date.now() - now,
            is_answered: true,
            top_score: null,
          });
          await this._logAiReply(groupId, ops.answer, userQuery);
          return;
        }
        // intent = docs → rơi xuống RAG bên dưới (nếu account này bật RAG docs)
      }

      // Account tắt RAG docs (vd deal-monitor): không trả lời tài liệu công ty,
      // chỉ Ops Assistant ở trên mới được phép trả lời
      if (!this.enableRagDocs) return;

      // Bối cảnh hội thoại: bản tóm tắt do chính AI tự sinh ở lượt trước (không phải lịch sử thô)
      // — áp dụng cho cả 1:1 lẫn @mention trong group, theo đúng người hỏi (sender_uid)
      const contextSummary = await this._fetchContextSummary(senderUid);

      const result = await answer(userQuery, contextSummary);
      await this._send(groupId, result.answer, isDirect);
      await this._saveContextSummary(senderUid, result.context_summary);

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
      await this._logAiReply(groupId, result.answer, userQuery);

    } catch (err) {
      log.error('Pipeline lỗi', err.message);
      await this._send(groupId, '❌ Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại sau.', isDirect);
    }
  }

  // Demo showoff (nhánh ai-for-demo) — xem CLAUDE.md/plan: UID cấu hình qua
  // Settings ("demo_customer_uids", cách nhau bởi dấu phẩy). Đọc thẳng từ
  // bảng settings (KHÔNG qua utils/config.js) vì cache của module đó chỉ
  // load 1 lần lúc backend khởi động — Dashboard cập nhật xong sẽ không có
  // tác dụng cho tới khi restart. Cache 30s ở đây để không query DB mỗi tin nhắn.
  async _loadDemoCustomerUids() {
    const now = Date.now();
    if (now - this._demoCustomerLoadedAt < DEMO_CUSTOMER_CACHE_MS) return;
    this._demoCustomerLoadedAt = now; // set trước để tránh stampede khi DB lỗi
    try {
      const { rows } = await query(`SELECT value FROM settings WHERE key = 'demo_customer_uids'`);
      const raw = rows[0]?.value ?? '';
      this._demoCustomerUids = new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
    } catch { /* lỗi DB tạm thời — giữ nguyên danh sách cũ, thử lại sau 30s */ }
  }

  async _isDemoCustomer(senderUid) {
    await this._loadDemoCustomerUids();
    return this._demoCustomerUids.has(senderUid);
  }

  // Khách hàng demo hỏi báo giá chính thức → AI báo "đợi chút" rồi đưa đề xuất
  // cho Sales duyệt TRÊN DASHBOARD (không qua Zalo, xem quote/negotiation.js).
  // Câu hỏi thông tin sản phẩm bình thường → RAG với persona khách hàng.
  async _handleCustomerFlow({ groupId, senderUid, senderName, isDirect }, userQuery, startedAt) {
    try {
      if (isFormalQuoteIntent(userQuery)) {
        const contextSummary = await this._fetchContextSummary(senderUid);
        await startNegotiation({ customerUid: senderUid, customerName: senderName, rawQuery: userQuery, contextSummary });
        const waitMsg = 'Dạ để em xin giá chính xác từ bên mình rồi gửi lại anh/chị liền nha, đợi em chút xíu ạ 🙏';
        await this._send(groupId, waitMsg, isDirect);
        await this._logAiReply(groupId, waitMsg, userQuery);
        return;
      }

      const contextSummary = await this._fetchContextSummary(senderUid);
      const result = await answer(userQuery, contextSummary, { audience: 'customer' });
      await this._send(groupId, result.answer, isDirect);
      await this._saveContextSummary(senderUid, result.context_summary);

      await this._logInteraction({
        groupId, senderUid,
        query: userQuery,
        answer: result.answer,
        sources: result.sources,
        latency_ms: Date.now() - startedAt,
        is_answered: result.is_answered,
        top_score: result.top_score,
      });
      await this._logAiReply(groupId, result.answer, userQuery);
    } catch (err) {
      log.error('Customer flow lỗi', err.message);
      await this._send(groupId, '❌ Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại sau.', isDirect);
    }
  }

  // Đọc bản tóm tắt bối cảnh — hết hạn sau 2 giờ không hỏi tiếp (coi như hội thoại mới)
  async _fetchContextSummary(senderUid) {
    try {
      const { rows } = await query(
        `SELECT summary FROM conversation_context
         WHERE sender_uid = $1 AND updated_at >= NOW() - INTERVAL '2 hours'`,
        [senderUid]
      );
      return rows[0]?.summary ?? '';
    } catch {
      return '';
    }
  }

  async _saveContextSummary(senderUid, summary) {
    try {
      await query(
        `INSERT INTO conversation_context (sender_uid, summary, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (sender_uid) DO UPDATE SET summary = $2, updated_at = NOW()`,
        [senderUid, summary ?? '']
      );
    } catch (err) {
      log.error('Lưu context summary lỗi', err.message);
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

  // Gửi file đính kèm (vd file báo giá .docx) — file tạm ở os.tmpdir(), xoá ngay
  // sau khi gửi xong (thành công hay lỗi đều xoá, tránh rác tích luỹ trên container)
  async _sendFile(threadId, filePath, isDirect = false) {
    try {
      const type = isDirect ? MessageType.DirectMessage : MessageType.GroupMessage;
      await this.api.sendMessage({ msg: '', attachments: [filePath] }, threadId, type);
    } catch (err) {
      log.error('Gửi file thất bại', err.message);
    } finally {
      fs.unlink(filePath, () => {});
    }
  }

  // Ghi tin nhắn AI trả lời vào bảng messages (bên cạnh ai_logs) — để zEnterprise
  // Dashboard đếm được "AI đã trả lời bao nhiêu tin" tách biệt với tin nhắn khách/nhân viên
  async _logAiReply(groupId, answerText, userQuery) {
    try {
      await query(
        `INSERT INTO messages (group_id, sender_uid, sender_name, content, msg_ts, is_gz_member, msg_type, responder_type, question_type)
         VALUES ($1, 'ai_agent', $2, $3, NOW(), true, 'text', 'ai', $4)`,
        [groupId, process.env.AGENT_NAME ?? 'GiftZone AI', answerText, classifyQuestionType(userQuery)]
      );
    } catch (err) {
      log.error('Log AI reply vào messages lỗi', err.message);
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
