/**
 * Mã hoá giá trị nhạy cảm (zalo_cookie) trước khi ghi vào DB / giải mã khi đọc.
 * Cùng thuật toán với admin's lib/crypto.ts — cần cùng SETTINGS_ENC_KEY
 * (32-byte hex) set trên cả Render (backend) và Vercel (admin).
 * Không set key → giữ nguyên plaintext (fallback an toàn cho local dev,
 * và cho phép migrate dần: dữ liệu cũ chưa mã hoá vẫn đọc được bình thường).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getKey() {
  const hex = process.env.SETTINGS_ENC_KEY;
  if (!hex) return null;
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('SETTINGS_ENC_KEY phải là chuỗi hex 64 ký tự (32 bytes)');
  return key;
}

export function encryptSensitive(plain) {
  const key = getKey();
  if (!key || !plain) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

export function decryptSensitive(value) {
  if (!value || !value.startsWith(PREFIX)) return value; // plaintext cũ hoặc không có key
  const key = getKey();
  if (!key) throw new Error('SETTINGS_ENC_KEY chưa cấu hình nhưng dữ liệu trong DB đã bị mã hoá');
  const [ivHex, tagHex, dataHex] = value.slice(PREFIX.length).split(':');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}
