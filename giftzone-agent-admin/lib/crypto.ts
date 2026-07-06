/**
 * Mã hoá giá trị nhạy cảm (zalo_cookie) trước khi ghi vào DB.
 * Cùng thuật toán với backend's utils/crypto.js — cần cùng SETTINGS_ENC_KEY
 * (32-byte hex) set trên cả Vercel (admin) và Render (backend).
 * Không set key → giữ nguyên plaintext (fallback an toàn cho local dev).
 */
import { createCipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const hex = process.env.SETTINGS_ENC_KEY;
  if (!hex) return null;
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('SETTINGS_ENC_KEY phải là chuỗi hex 64 ký tự (32 bytes)');
  return key;
}

export function encryptSensitive(plain: string): string {
  const key = getKey();
  if (!key || !plain) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}
