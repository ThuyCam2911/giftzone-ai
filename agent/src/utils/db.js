import pg from 'pg';
import { createLogger } from './logger.js';

const log = createLogger('DB');
const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const config = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
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
      ('session_status',    'unknown', 'Trạng thái Zalo session: ok / warning / expired / unknown'),
      ('session_last_seen', '',        'Lần cuối session còn sống (ISO timestamp)'),
      ('zalo_cookie',       $6,        'Zalo session cookie (JSON array từ chat.zalo.me → F12 → Application → Cookies)')
    ON CONFLICT (key) DO NOTHING
  `, [
    process.env.DRIVE_FOLDER_ID  ?? '',
    process.env.SUMMARY_CRON     ?? '0 18 * * 1-5',
    process.env.AGENT_NAME       ?? 'GiftZone AI',
    process.env.SKIP_INDEX       ?? 'false',
    process.env.LOG_LEVEL        ?? 'info',
    process.env.ZALO_COOKIE      ?? '',
  ]);

  log.info('Schema sẵn sàng ✓');
}
