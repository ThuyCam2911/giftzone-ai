import { Zalo } from 'zca-js';
import 'dotenv/config';

let cookieValue = process.env.ZALO_COOKIE;
try {
  const parsed = JSON.parse(cookieValue);
  if (Array.isArray(parsed)) {
    cookieValue = { url: 'https://chat.zalo.me', cookies: parsed };
  }
} catch {}

const zalo = new Zalo(
  { imei: process.env.ZALO_IMEI, cookie: cookieValue, userAgent: process.env.ZALO_USER_AGENT },
  { selfListen: false, checkUpdate: false }
);

const api = await zalo.login();
const ownId = await api.getOwnId();

// Lấy profile của chính mình
const profile = await api.getUserInfo({ userId: ownId }).catch(() => null);

console.log('\n=== THÔNG TIN TÀI KHOẢN AGENT ===');
console.log('User ID  :', ownId);
console.log('Raw profile:', JSON.stringify(profile, null, 2));
process.exit(0);
