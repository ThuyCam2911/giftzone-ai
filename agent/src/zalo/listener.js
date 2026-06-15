/**
 * Zalo Group Message Listener
 * - Nhận realtime messages từ tất cả groups
 * - Parse @mention → emit event cho handler xử lý
 * - Log tất cả tin nhắn vào DB để tổng hợp summary
 */
import { MessageType } from 'zca-js';
import { createLogger } from '../utils/logger.js';
import { query } from '../utils/db.js';

const log = createLogger('Listener');

export class GroupListener {
  constructor(api, ownId) {
    this.api    = api;
    this.ownId  = ownId;
    this.onMention = null; // async (ctx) => void  — set từ ngoài
  }

  start() {
    const { api, ownId } = this;

    api.listener.on('connected', () => {
      log.info('WebSocket connected ✓ — đang lắng nghe group messages');
    });

    api.listener.on('message', async (message) => {
      try {
        await this._handleMessage(message);
      } catch (err) {
        log.error('handleMessage error', err.message);
      }
    });

    api.listener.on('closed', () => {
      log.error('WebSocket closed — kiểm tra Zalo Web có đang mở trên browser không');
    });

    api.listener.on('error', (err) => {
      log.error('Listener error', String(err));
    });

    api.listener.start();
    log.info('Listener started');
  }

  async _handleMessage(message) {
    // Chỉ xử lý Group messages
    if (message.type !== MessageType.GroupMessage) return;

    const data      = message.data ?? {};
    const groupId   = data.idTo ?? message.threadId;
    const senderUid = data.uidFrom ?? '';
    const senderName = data.dName ?? '';
    const content   = typeof data.content === 'string'
      ? data.content
      : JSON.stringify(data.content ?? '');
    const mentions  = data.mentions ?? [];
    const ts        = data.ts ? new Date(Number(data.ts)) : new Date();

    // Bỏ qua tin của chính Agent (selfListen=false nhưng phòng hờ)
    if (senderUid === this.ownId) return;

    log.debug(`[${groupId}] ${senderName}: ${content.slice(0, 60)}`);

    // Lưu vào DB để summary
    await this._logMessage(groupId, senderUid, senderName, content, ts);

    // Detect @mention Agent
    const isMentioned = mentions.some(
      (m) => String(m.uid ?? '') === String(this.ownId)
    );

    if (isMentioned && typeof this.onMention === 'function') {
      // Tách query: bỏ "@Tên" (pos=0, len=N) khỏi content
      const userQuery = this._extractQuery(content, mentions);
      log.info(`@mention từ ${senderName} (${senderUid}): "${userQuery}"`);

      await this.onMention({
        groupId,
        senderUid,
        senderName,
        rawContent: content,
        query: userQuery,
        ts,
      });
    }
  }

  _extractQuery(content, mentions) {
    // Xoá tất cả mention tokens (@Tên) khỏi content để lấy câu hỏi thuần
    let q = content;
    // Sort mentions by pos descending để xoá từ cuối lên đầu (tránh lệch index)
    const sorted = [...mentions].sort((a, b) => b.pos - a.pos);
    for (const m of sorted) {
      if (m.pos != null && m.len != null) {
        q = q.slice(0, m.pos) + q.slice(m.pos + m.len);
      }
    }
    return q.trim();
  }

  async _logMessage(groupId, senderUid, senderName, content, ts) {
    try {
      await query(
        `INSERT INTO messages (group_id, sender_uid, sender_name, content, msg_ts)
         VALUES ($1, $2, $3, $4, $5)`,
        [groupId, senderUid, senderName, content, ts]
      );
    } catch (err) {
      log.error('Lưu message DB lỗi', err.message);
    }
  }
}
