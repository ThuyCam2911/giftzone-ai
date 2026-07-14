import pg from 'pg';
import { createLogger } from './logger.js';

const log = createLogger('DB');
const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const config = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 }
      : {
          host:     process.env.PG_HOST     ?? 'localhost',
          port:     Number(process.env.PG_PORT ?? 5433),
          database: process.env.PG_DATABASE ?? 'giftzone_agent',
          user:     process.env.PG_USER     ?? 'postgres',
          password: process.env.PG_PASSWORD ?? 'postgres',
        };
    pool = new Pool(config);
    pool.on('error', (err) => log.error('Pool error', err.message));
  }
  return pool;
}

export async function query(sql, params) {
  return getPool().query(sql, params);
}

export async function initSchema() {
  log.info('Khởi tạo schema...');
  await query(`CREATE EXTENSION IF NOT EXISTS vector`);

  // Bảng lưu chunks tài liệu từ Google Drive
  await query(`
    CREATE TABLE IF NOT EXISTS doc_chunks (
      id          BIGSERIAL PRIMARY KEY,
      file_id     TEXT NOT NULL,
      file_name   TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content     TEXT NOT NULL,
      embedding   vector(1536),
      indexed_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // HNSW index cho semantic search
  await query(`
    CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx
    ON doc_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `);

  // Bảng log tương tác AI
  await query(`
    CREATE TABLE IF NOT EXISTS ai_logs (
      id          BIGSERIAL PRIMARY KEY,
      group_id    TEXT NOT NULL,
      sender_uid  TEXT NOT NULL,
      query       TEXT NOT NULL,
      answer      TEXT NOT NULL,
      sources     JSONB DEFAULT '[]',
      latency_ms  INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bảng lưu tin nhắn group để tổng hợp summary
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          BIGSERIAL PRIMARY KEY,
      group_id    TEXT NOT NULL,
      sender_uid  TEXT NOT NULL,
      sender_name TEXT,
      content     TEXT NOT NULL,
      msg_ts      TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bảng cấu hình — quản lý qua Dashboard thay vì .env
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      description TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed default values nếu chưa có
  await query(`
    INSERT INTO settings (key, value, description) VALUES
      ('drive_folder_id',   $1, 'Google Drive folder/file ID để index tài liệu'),
      ('summary_cron',      $2, 'Cron schedule cho daily summary (mặc định: 18:00 T2-T6)'),
      ('agent_name',        $3, 'Tên hiển thị của AI agent trong Zalo'),
      ('skip_index',        $4, 'Bỏ qua index Drive khi khởi động (true/false)'),
      ('log_level',         $5, 'Mức log: debug / info / warn / error'),
      ('admin_group_id',    '',        'Group ID nhận daily alert 8:00 AM (để trống = tắt alert)'),
      ('session_status',    'unknown', 'Trạng thái Zalo session: ok / warning / expired / unknown'),
      ('session_last_seen', '',        'Lần cuối session còn sống (ISO timestamp)')
    ON CONFLICT (key) DO NOTHING
  `, [
    process.env.DRIVE_FOLDER_ID  ?? '',
    process.env.SUMMARY_CRON     ?? '0 18 * * 1-5',
    process.env.AGENT_NAME       ?? 'GiftZone AI',
    process.env.SKIP_INDEX       ?? 'false',
    process.env.LOG_LEVEL        ?? 'info',
  ]);

  // Bảng deals — mỗi deal là 1 khách hàng đang được tư vấn trong group
  await query(`
    CREATE TABLE IF NOT EXISTS deals (
      id               BIGSERIAL PRIMARY KEY,
      group_id         TEXT NOT NULL,
      deal_key         TEXT UNIQUE NOT NULL,
      customer_name    TEXT,
      product          TEXT,
      stage            TEXT NOT NULL DEFAULT 'Mới',
      confidence       FLOAT DEFAULT 0.8,
      last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bảng deal_events — lịch sử thay đổi stage
  await query(`
    CREATE TABLE IF NOT EXISTS deal_events (
      id          BIGSERIAL PRIMARY KEY,
      deal_id     BIGINT REFERENCES deals(id) ON DELETE CASCADE,
      from_stage  TEXT,
      to_stage    TEXT NOT NULL,
      evidence    TEXT,
      detected_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bảng issues chất lượng sales — phát hiện từ hội thoại Zalo
  await query(`
    CREATE TABLE IF NOT EXISTS sales_issues (
      id           BIGSERIAL PRIMARY KEY,
      group_id     TEXT NOT NULL,
      issue_key    TEXT UNIQUE NOT NULL,
      issue_type   TEXT NOT NULL,
      severity     TEXT NOT NULL DEFAULT 'medium',
      title        TEXT NOT NULL,
      description  TEXT,
      evidence     TEXT,
      status       TEXT NOT NULL DEFAULT 'open',
      detected_at  TIMESTAMPTZ DEFAULT NOW(),
      resolved_at  TIMESTAMPTZ,
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bảng tên nhóm Zalo — lazy-populated khi listener gặp group mới
  await query(`
    CREATE TABLE IF NOT EXISTS group_names (
      group_id   TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      group_type TEXT NOT NULL DEFAULT 'customer',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Migration: thêm group_type nếu bảng đã tồn tại trước đó
  await query(`
    ALTER TABLE group_names ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'customer'
  `);

  // Bảng thành viên team GiftZone — dùng để phân biệt [GZ] vs [KH] khi analyze issues
  await query(`
    CREATE TABLE IF NOT EXISTS gz_members (
      sender_uid  TEXT PRIMARY KEY,
      sender_name TEXT NOT NULL,
      added_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Mốc lần analyze cuối per group — thay cho việc suy ra từ sales_issues
  await query(`
    CREATE TABLE IF NOT EXISTS analyzer_runs (
      group_id TEXT PRIMARY KEY,
      last_run TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Drive folders để index (quản lý qua Dashboard Settings)
  await query(`
    CREATE TABLE IF NOT EXISTS drive_folders (
      id         SERIAL PRIMARY KEY,
      folder_id  TEXT NOT NULL UNIQUE,
      note       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Migrations — thêm column mới nếu chưa tồn tại
  await query(`ALTER TABLE gz_members  ADD COLUMN IF NOT EXISTS role        TEXT      NOT NULL DEFAULT 'sales'`);
  await query(`ALTER TABLE ai_logs     ADD COLUMN IF NOT EXISTS is_answered BOOLEAN   DEFAULT true`);
  await query(`ALTER TABLE ai_logs     ADD COLUMN IF NOT EXISTS top_score   FLOAT`);
  await query(`ALTER TABLE messages    ADD COLUMN IF NOT EXISTS is_gz_member BOOLEAN  DEFAULT false`);
  await query(`ALTER TABLE messages    ADD COLUMN IF NOT EXISTS msg_type    TEXT      DEFAULT 'text'`);

  // zEnterprise: gán nhóm Zalo vào 1 chi nhánh/cửa hàng để phân tích theo store
  await query(`ALTER TABLE group_names ADD COLUMN IF NOT EXISTS branch TEXT`);

  // zEnterprise: phân biệt tin nhắn của khách / AI trả lời / nhân viên trả lời tay
  // (thay cho is_gz_member vốn chỉ biết "người gửi có phải GZ member", không biết ai/AI đang trả lời)
  await query(`ALTER TABLE messages    ADD COLUMN IF NOT EXISTS responder_type TEXT NOT NULL DEFAULT 'customer'`);

  // zEnterprise: phân loại nhanh loại câu hỏi (order/promotion/complaint/info/other) để thống kê theo store/account
  await query(`ALTER TABLE messages    ADD COLUMN IF NOT EXISTS question_type  TEXT`);

  // zEnterprise Inbox: hàng đợi tin nhắn 1:1 gửi từ Dashboard — backend poll và gửi qua Zalo thật
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

  // zEnterprise Inbox: cờ tạm dừng AI theo từng hội thoại 1:1 khi nhân viên đang trả lời trực tiếp trên Dashboard
  await query(`
    CREATE TABLE IF NOT EXISTS conversation_state (
      thread_id  TEXT PRIMARY KEY,
      ai_paused  BOOLEAN NOT NULL DEFAULT false,
      paused_by  TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  log.info('Schema sẵn sàng ✓');
}
