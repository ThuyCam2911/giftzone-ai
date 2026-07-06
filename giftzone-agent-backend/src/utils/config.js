/**
 * Config manager — đọc từ bảng settings trong DB.
 * Fallback về process.env nếu DB chưa có giá trị.
 *
 * Key bắt đầu bằng "zalo_cookie" được mã hoá at-rest (AES-256-GCM) —
 * DB leak không còn đồng nghĩa với mất tài khoản Zalo ngay lập tức.
 * Cache trong process luôn giữ plaintext (đã giải mã) để dùng bình thường.
 */
import { query } from './db.js';
import { encryptSensitive, decryptSensitive } from './crypto.js';

const SENSITIVE_PREFIX = 'zalo_cookie';
const isSensitive = (key) => key.startsWith(SENSITIVE_PREFIX);

let cache = null;

export async function loadConfig() {
  const { rows } = await query(`SELECT key, value FROM settings`);
  cache = Object.fromEntries(
    rows.map(r => [r.key, isSensitive(r.key) ? decryptSensitive(r.value) : r.value])
  );
  return cache;
}

export function getConfig(key, fallback = undefined) {
  if (!cache) throw new Error(`Config chưa được load — gọi loadConfig() trước`);
  return cache[key] ?? fallback;
}

export async function setConfig(key, value) {
  const stored = isSensitive(key) ? encryptSensitive(value) : value;
  await query(
    `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`,
    [stored, key]
  );
  if (cache) cache[key] = value; // cache giữ plaintext
}

export async function getAllConfig() {
  const { rows } = await query(
    `SELECT key, value, description, updated_at FROM settings ORDER BY key`
  );
  return rows;
}
