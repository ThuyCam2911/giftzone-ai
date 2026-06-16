/**
 * Zalo Session Manager
 * - Login, giữ session, health check mỗi 30 phút
 * - Alert khi session expire
 */
import { Zalo } from 'zca-js';
import { getConfig, setConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Session');

function parseCookie(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { url: 'https://chat.zalo.me', cookies: parsed };
    }
    return parsed;
  } catch {
    return raw;
  }
}

export class SessionManager {
  constructor() {
    this.api = null;
    this.ownId = null;
    this.healthTimer = null;
    this.onExpired = null; // callback khi session expire
  }

  async login() {
    log.info('Đang login...');
    // Ưu tiên cookie từ DB; nếu có INSTANCE_ID thì dùng key riêng (tránh ghi đè giữa 2 instance)
    // ENV luôn thắng DB — tránh stale DB cookie override fresh ENV cookie khi deploy
    const cookieKey = process.env.INSTANCE_ID ? `zalo_cookie_${process.env.INSTANCE_ID}` : 'zalo_cookie';
    const rawCookie = process.env.ZALO_COOKIE || getConfig(cookieKey, null) || getConfig('zalo_cookie', null);
    const credentials = {
      imei:      process.env.ZALO_IMEI,
      cookie:    parseCookie(rawCookie),
      userAgent: process.env.ZALO_USER_AGENT,
    };

    const source = process.env.ZALO_COOKIE ? 'ENV' : getConfig(cookieKey, null) ? `DB[${cookieKey}]` : 'DB[zalo_cookie]';
    log.info(`Cookie source: ${source}, IMEI: ${credentials.imei?.slice(0, 8)}...`);

    const zalo = new Zalo(credentials, { selfListen: false, checkUpdate: false });
    this.api = await zalo.login();
    this.ownId = await this.api.getOwnId();

    log.info(`Login OK — Agent ID: ${this.ownId}`);
    await setConfig('session_status', 'ok').catch(() => {});
    await setConfig('session_last_seen', new Date().toISOString()).catch(() => {});
    this._startHealthCheck();
    return this.api;
  }

  _startHealthCheck() {
    // Health check mỗi 30 phút — gọi getOwnId để xác nhận session còn sống
    this.healthTimer = setInterval(async () => {
      try {
        await this.api.getOwnId();
        log.debug('Health check OK');
      } catch (err) {
        log.error('Health check FAIL — session có thể đã expire', err.message);
        await setConfig('session_status', 'warning').catch(() => {});
        this._onSessionExpired();
      }
    }, 30 * 60 * 1000);
  }

  async _onSessionExpired() {
    clearInterval(this.healthTimer);
    log.error('⚠️  SESSION EXPIRED — Cần lấy cookie mới từ chat.zalo.me');
    log.error('Hướng dẫn: Mở chat.zalo.me → đăng nhập → extract cookie → cập nhật .env → restart');
    await setConfig('session_status', 'expired').catch(() => {});
    if (typeof this.onExpired === 'function') this.onExpired();
  }

  stop() {
    clearInterval(this.healthTimer);
  }
}
