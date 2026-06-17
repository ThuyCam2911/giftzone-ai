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
    this._knownGroups = new Set(); // tránh gọi getGroupInfo lặp lại
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
    const data      = message.data ?? {};
    const senderUid = data.uidFrom ?? '';
    const senderName = data.dName ?? '';
    const content   = typeof data.content === 'string'
      ? data.content
      : JSON.stringify(data.content ?? '');
    const ts        = data.ts ? new Date(Number(data.ts)) : new Date();

    // Bỏ qua tin của chính Agent
    if (senderUid === this.ownId) return;

    // --- Chat 1:1 (DirectMessage) ---
    if (message.type === MessageType.DirectMessage) {
      const userId = senderUid;
      log.info(`[1:1] ${senderName} (${userId}): "${content.slice(0, 80)}"`);

      // Ghi vào DB để Deal Intelligence phân tích (dùng userId làm group_id)
      await this._logMessage(userId, senderUid, senderName, content, ts);

      if (typeof this.onMention === 'function' && content.trim().length >= 2) {
        await this.onMention({
          groupId:   userId,
          senderUid,
          senderName,
          rawContent: content,
          query:     content.trim(),
          ts,
          isDirect:  true,
        });
      }
      return;
    }

    // --- Group message ---
    if (message.type !== MessageType.GroupMessage) return;

    const groupId  = data.idTo ?? message.threadId;
    const mentions = data.mentions ?? [];

    log.debug(`[${groupId}] ${senderName}: ${content.slice(0, 60)}`);

    // Lưu vào DB để summary
    await this._logMessage(groupId, senderUid, senderName, content, ts);

    // Lazy-fetch tên nhóm nếu chưa biết
    this._cacheGroupName(groupId);

    // Detect @mention Agent
    const isMentioned = mentions.some(
      (m) => String(m.uid ?? '') === String(this.ownId)
    );

    if (isMentioned && typeof this.onMention === 'function') {
      const userQuery = this._extractQuery(content, mentions);
      log.info(`@mention từ ${senderName} (${senderUid}): "${userQuery}"`);

      await this.onMention({
        groupId,
        senderUid,
        senderName,
        rawContent: content,
        query:     userQuery,
        ts,
        isDirect:  false,
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

  // Fire-and-forget: gọi getGroupInfo 1 lần rồi cache vào DB
  _cacheGroupName(groupId) {
    if (this._knownGroups.has(groupId)) return;
    this._knownGroups.add(groupId);
    this.api.getGroupInfo(groupId)
      .then(res => {
        const info = res?.gridInfoMap?.[groupId];
        const name = info?.name;
        if (!name) return;
        return query(
          `INSERT INTO group_names (group_id, name, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (group_id) DO UPDATE SET name = $2, updated_at = NOW()`,
          [groupId, name]
        );
      })
      .catch(err => log.warn(`Không lấy được tên nhóm ${groupId}:`, err.message));
  }

  async _logMessage(groupId, senderUid, senderName, content, ts) {
    try {
      await query(
        `INSERT INTO messages (group_id, sender_uid, sender_name, content, msg_ts)
         VALUES ($1, $2, $3, $4, $5)`,
        [groupId, senderUid, senderName, content, ts]
      );
      log.debug(`Logged message from ${senderName} in ${groupId}`);
    } catch (err) {
      log.error('Lưu message DB lỗi:', err.message, '| group:', groupId, '| user:', senderUid);
    }
  }
}
