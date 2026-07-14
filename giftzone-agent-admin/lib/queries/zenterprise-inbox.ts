import { query } from '@/lib/db';

export interface InboxThread {
  thread_id: string;
  name: string;
  last_message: string | null;
  last_msg_ts: string | null;
  ai_paused: boolean;
  unread_customer_count: number;
}

export interface InboxMessage {
  id: number;
  responder_type: 'customer' | 'ai' | 'human';
  sender_name: string;
  content: string;
  msg_ts: string;
}

export interface OutboundStatus {
  id: number;
  status: 'pending' | 'sent' | 'failed';
  error: string | null;
}

export async function ensureOutboundTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS outbound_messages (
      id         BIGSERIAL PRIMARY KEY,
      thread_id  TEXT NOT NULL,
      is_direct  BOOLEAN NOT NULL DEFAULT true,
      text       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      error      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      sent_at    TIMESTAMPTZ
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS conversation_state (
      thread_id  TEXT PRIMARY KEY,
      ai_paused  BOOLEAN NOT NULL DEFAULT false,
      paused_by  TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// Danh sách hội thoại 1:1 (group_type='direct') — mới nhất trước, kèm trạng thái AI on/off
export async function listInboxThreads(): Promise<InboxThread[]> {
  await ensureOutboundTables();
  const rows = await query<{
    thread_id: string; name: string; last_message: string | null; last_msg_ts: string | null;
    ai_paused: boolean | null; unread_customer_count: string;
  }>(
    `SELECT
       gn.group_id AS thread_id,
       gn.name,
       last.content AS last_message,
       last.msg_ts AS last_msg_ts,
       COALESCE(cs.ai_paused, false) AS ai_paused,
       COUNT(m.id) FILTER (WHERE m.responder_type = 'customer' AND m.msg_ts > COALESCE(last_reply.msg_ts, '1970-01-01')) AS unread_customer_count
     FROM group_names gn
     LEFT JOIN conversation_state cs ON cs.thread_id = gn.group_id
     LEFT JOIN LATERAL (
       SELECT content, msg_ts FROM messages WHERE group_id = gn.group_id ORDER BY msg_ts DESC LIMIT 1
     ) last ON true
     LEFT JOIN LATERAL (
       SELECT MAX(msg_ts) AS msg_ts FROM messages WHERE group_id = gn.group_id AND responder_type IN ('ai','human')
     ) last_reply ON true
     LEFT JOIN messages m ON m.group_id = gn.group_id
     WHERE gn.group_type = 'direct'
     GROUP BY gn.group_id, gn.name, last.content, last.msg_ts, cs.ai_paused
     ORDER BY last.msg_ts DESC NULLS LAST
     LIMIT 100`,
  );

  return rows.map(r => ({
    thread_id: r.thread_id,
    name: r.name,
    last_message: r.last_message,
    last_msg_ts: r.last_msg_ts,
    ai_paused: r.ai_paused === true,
    unread_customer_count: Number(r.unread_customer_count),
  }));
}

export async function getThreadMessages(threadId: string): Promise<InboxMessage[]> {
  return query<InboxMessage>(
    `SELECT id, responder_type, sender_name, content, msg_ts
     FROM messages
     WHERE group_id = $1 AND msg_type = 'text'
     ORDER BY msg_ts ASC
     LIMIT 200`,
    [threadId],
  );
}

export async function setAiPaused(threadId: string, paused: boolean, pausedBy: string | null): Promise<void> {
  await ensureOutboundTables();
  await query(
    `INSERT INTO conversation_state (thread_id, ai_paused, paused_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (thread_id) DO UPDATE SET ai_paused = $2, paused_by = $3, updated_at = NOW()`,
    [threadId, paused, pausedBy],
  );
}

export async function enqueueOutboundMessage(threadId: string, text: string): Promise<number> {
  await ensureOutboundTables();
  const rows = await query<{ id: number }>(
    `INSERT INTO outbound_messages (thread_id, is_direct, text) VALUES ($1, true, $2) RETURNING id`,
    [threadId, text],
  );
  return rows[0].id;
}

export async function getOutboundStatus(ids: number[]): Promise<OutboundStatus[]> {
  if (ids.length === 0) return [];
  return query<OutboundStatus>(
    `SELECT id, status, error FROM outbound_messages WHERE id = ANY($1::bigint[])`,
    [ids],
  );
}
