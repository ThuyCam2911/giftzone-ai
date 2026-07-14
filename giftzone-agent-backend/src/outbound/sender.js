/**
 * Outbound Sender — poll bảng outbound_messages (ghi từ zEnterprise Inbox trên Dashboard)
 * và gửi tin nhắn Zalo thật qua session đang chạy trong process này.
 * Dashboard (Next.js) không giữ session Zalo — chỉ INSERT vào bảng này, backend
 * là nơi duy nhất có `api` để gửi (theo đúng pattern polling đã dùng cho
 * deal/analyzer.js, alert/daily.js, rag/indexer.js auto-sync).
 */
import { MessageType } from 'zca-js';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('OutboundSender');
const POLL_MS = 5000;

export function startOutboundSender(api) {
  async function tick() {
    let rows;
    try {
      const result = await query(
        `SELECT id, thread_id, is_direct, text FROM outbound_messages
         WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10`
      );
      rows = result.rows;
    } catch (err) {
      log.error('Poll outbound_messages lỗi', err.message);
      return;
    }

    for (const row of rows) {
      const text = (row.text ?? '').trim();
      if (!text || !row.thread_id) {
        await query(
          `UPDATE outbound_messages SET status = 'failed', error = 'Thiếu thread_id hoặc nội dung' WHERE id = $1`,
          [row.id]
        );
        continue;
      }
      try {
        const type = row.is_direct ? MessageType.DirectMessage : MessageType.GroupMessage;
        await api.sendMessage({ msg: text }, row.thread_id, type);
        await query(
          `UPDATE outbound_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [row.id]
        );
        await query(
          `INSERT INTO messages (group_id, sender_uid, sender_name, content, msg_ts, is_gz_member, msg_type, responder_type, question_type)
           VALUES ($1, 'human_agent', 'Nhân viên', $2, NOW(), true, 'text', 'human', NULL)`,
          [row.thread_id, text]
        );
        log.info(`Đã gửi tin nhắn thủ công tới ${row.thread_id}`);
      } catch (err) {
        log.error(`Gửi outbound message #${row.id} thất bại`, err.message);
        await query(
          `UPDATE outbound_messages SET status = 'failed', error = $2 WHERE id = $1`,
          [row.id, err.message]
        );
      }
    }
  }

  const timer = setInterval(() => { tick().catch(err => log.error('tick lỗi', err.message)); }, POLL_MS);
  log.info(`Outbound Sender khởi động — poll mỗi ${POLL_MS / 1000}s`);
  return () => clearInterval(timer);
}
