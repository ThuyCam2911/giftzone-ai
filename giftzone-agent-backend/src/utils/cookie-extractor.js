/**
 * Tự động extract Zalo cookie từ Chrome trên macOS
 * - Đọc Chrome SQLite cookie DB (copy sang /tmp trước để tránh lock)
 * - Decrypt AES-128-CBC dùng key từ macOS Keychain
 * - Lưu vào DB settings (key: zalo_cookie) để agent dùng khi restart
 */
import { execSync, execFileSync } from 'child_process';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';
import { setConfig } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('CookieExtractor');
const require = createRequire(import.meta.url);

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 không khả dụng trên server (bình thường — chỉ cần trên máy local có Chrome)
}

const CHROME_COOKIE_PATHS = [
  join(homedir(), 'Library/Application Support/Google/Chrome/Default/Network/Cookies'),
  join(homedir(), 'Library/Application Support/Google/Chrome/Default/Cookies'),
  join(homedir(), 'Library/Application Support/Chromium/Default/Network/Cookies'),
];

const ZALO_DOMAIN = '.zalo.me';

function getChromeSafeStorageKey() {
  try {
    const b64 = execFileSync('security', [
      'find-generic-password', '-w', '-a', 'Chrome', '-s', 'Chrome Safe Storage',
    ]).toString().trim();
    const password = Buffer.from(b64, 'base64');
    // Chrome macOS: PBKDF2-SHA1, 1003 iterations, 16-byte key, salt='saltysalt'
    return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  } catch {
    log.warn('Không lấy được Chrome Safe Storage key từ Keychain');
    return null;
  }
}

function decryptValue(encryptedBuf, key) {
  if (!encryptedBuf || encryptedBuf.length === 0) return '';
  const buf = Buffer.isBuffer(encryptedBuf) ? encryptedBuf : Buffer.from(encryptedBuf);
  const prefix = buf.slice(0, 3).toString();
  if (prefix !== 'v10' && prefix !== 'v11') {
    // Không encrypted — plain text
    return buf.toString('utf8');
  }
  if (!key) return '';
  try {
    const iv = Buffer.alloc(16, ' '); // Chrome dùng spaces làm IV
    const encrypted = buf.slice(3);
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export async function extractZaloCookies() {
  log.info('Bắt đầu extract Zalo cookies từ Chrome...');

  // Tìm Chrome cookie file
  const cookiePath = CHROME_COOKIE_PATHS.find(p => existsSync(p));
  if (!cookiePath) {
    log.error('Không tìm thấy Chrome cookie database. Chrome đã được cài chưa?');
    return false;
  }

  // Copy sang /tmp để tránh SQLite lock khi Chrome đang mở
  const tmpPath = join(tmpdir(), `chrome-cookies-${Date.now()}.db`);
  try {
    copyFileSync(cookiePath, tmpPath);
  } catch (err) {
    log.error('Không copy được cookie DB:', err.message);
    return false;
  }

  if (!Database) {
    log.warn('better-sqlite3 không khả dụng — cookie extractor chỉ chạy trên máy local có Chrome');
    return false;
  }

  let db;
  try {
    const key = getChromeSafeStorageKey();
    db = new Database(tmpPath, { readonly: true });

    const rows = db.prepare(`
      SELECT name, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite
      FROM cookies
      WHERE host_key LIKE ?
      ORDER BY name
    `).all(`%${ZALO_DOMAIN}%`);

    if (rows.length === 0) {
      log.warn('Không tìm thấy cookie nào cho zalo.me. Bạn đã đăng nhập chat.zalo.me trong Chrome chưa?');
      return false;
    }

    // Format theo J2TEAM cookie format mà zca-js dùng
    const cookies = rows.map(row => ({
      name:     row.name,
      value:    decryptValue(row.encrypted_value, key),
      domain:   ZALO_DOMAIN,
      path:     row.path || '/',
      secure:   row.is_secure === 1,
      httpOnly: row.is_httponly === 1,
      sameSite: row.samesite === 2 ? 'Strict' : row.samesite === 1 ? 'Lax' : 'None',
    })).filter(c => c.value !== '');

    // Phải có ít nhất zpsid — cookie session chính của Zalo
    const hasSession = cookies.some(c => ['zpsid', 'zpw_sek', 'zpw_enk'].includes(c.name));
    if (!hasSession || cookies.length < 3) {
      log.warn(`Cookie không đủ (${cookies.length} cookies, hasSession=${hasSession}). Bỏ qua — không ghi đè cookie cũ.`);
      log.warn('Hãy mở chat.zalo.me trong Chrome và đăng nhập trước.');
      return false;
    }

    // Lưu vào DB settings
    await setConfig('zalo_cookie', JSON.stringify(cookies));
    log.info(`✅ Đã extract và lưu ${cookies.length} cookies từ Chrome vào DB`);
    return true;
  } catch (err) {
    log.error('Lỗi khi đọc Chrome cookies:', err.message);
    return false;
  } finally {
    db?.close();
    try { unlinkSync(tmpPath); } catch {}
  }
}
