/**
 * Config manager — đọc từ bảng settings trong DB.
 * Fallback về process.env nếu DB chưa có giá trị.
 */
import { query } from './db.js';

let cache = null;

export async function loadConfig() {
  const { rows } = await query(`SELECT key, value FROM settings`);
  cache = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return cache;
}

export function getConfig(key, fallback = undefined) {
  if (!cache) throw new Error(`Config chưa được load — gọi loadConfig() trước`);
  return cache[key] ?? fallback;
}

export async function setConfig(key, value) {
  await query(
    `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`,
    [value, key]
  );
  if (cache) cache[key] = value;
}

export async function getAllConfig() {
  const { rows } = await query(
    `SELECT key, value, description, updated_at FROM settings ORDER BY key`
  );
  return rows;
}
