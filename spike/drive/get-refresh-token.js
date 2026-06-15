/**
 * Script lấy Google OAuth2 Refresh Token một lần duy nhất.
 *
 * Cách dùng:
 *   1. Điền GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET vào .env
 *   2. cd spike && node drive/get-refresh-token.js
 *   3. Mở URL được in ra → đăng nhập Google → cho phép quyền
 *   4. Script tự nhận code, đổi lấy refresh_token, ghi vào .env
 */

import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '../.env');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const PORT = 3000;

// ─── Kiểm tra credentials đã có chưa ─────────────────────────────────────────
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(chalk.red('\n❌ Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong .env'));
  console.log(chalk.yellow('\nHướng dẫn lấy credentials:'));
  console.log('  1. Vào https://console.cloud.google.com');
  console.log('  2. Tạo project mới (hoặc chọn project có sẵn)');
  console.log('  3. Bật Google Drive API: APIs & Services → Library → "Google Drive API" → Enable');
  console.log('  4. Tạo OAuth2 credentials: Credentials → Create → OAuth 2.0 Client IDs');
  console.log('     - Application type: Desktop app');
  console.log('  5. Điền client_id và client_secret vào spike/.env');
  console.log('  6. Chạy lại script này\n');
  process.exit(1);
}

// ─── OAuth2 client ────────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // bắt buộc có prompt=consent để nhận refresh_token
});

// ─── Ghi refresh_token vào .env ───────────────────────────────────────────────
function writeTokenToEnv(refreshToken) {
  let envContent = fs.readFileSync(ENV_PATH, 'utf-8');

  if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
    envContent = envContent.replace(
      /GOOGLE_REFRESH_TOKEN=.*/,
      `GOOGLE_REFRESH_TOKEN=${refreshToken}`
    );
  } else {
    envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}`;
  }

  fs.writeFileSync(ENV_PATH, envContent);
  console.log(chalk.green('\n✅ GOOGLE_REFRESH_TOKEN đã được ghi vào spike/.env'));
}

// ─── Local HTTP server nhận callback ─────────────────────────────────────────
function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>❌ Lỗi: ${error}</h2><p>Đóng tab này và thử lại.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>❌ Không có code trong callback</h2>');
        server.close();
        reject(new Error('No code in callback'));
        return;
      }

      try {
        console.log(chalk.cyan('\n[AUTH] Đang đổi code lấy tokens...'));
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <h2>⚠️ Không nhận được refresh_token</h2>
            <p>Có thể bạn đã cấp quyền trước đó. Thử:</p>
            <ol>
              <li>Vào <a href="https://myaccount.google.com/permissions">Google Account → Apps với quyền truy cập</a></li>
              <li>Thu hồi quyền của app này</li>
              <li>Chạy lại script</li>
            </ol>
          `);
          server.close();
          reject(new Error('No refresh_token — hãy thu hồi quyền app rồi thử lại'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">
              <h2>✅ Xác thực thành công!</h2>
              <p>Refresh token đã được lưu vào <code>spike/.env</code></p>
              <p>Quay lại terminal để xem kết quả. Đóng tab này là xong.</p>
              <hr>
              <p style="color:#888;font-size:12px">Token: ${tokens.refresh_token.slice(0, 20)}...</p>
            </body>
          </html>
        `);

        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>❌ Lỗi đổi token: ${err.message}</h2>`);
        server.close();
        reject(err);
      }
    });

    server.listen(PORT, () => {
      console.log(chalk.bold.blue('\n=== Lấy Google Drive Refresh Token ===\n'));
      console.log(chalk.white('Mở URL sau trong trình duyệt:\n'));
      console.log(chalk.bold.cyan(authUrl));
      console.log(chalk.gray('\n(Đăng nhập bằng tài khoản Google có quyền truy cập Drive folder cần index)\n'));
      console.log(chalk.yellow(`⏳ Đang chờ callback trên http://localhost:${PORT}...`));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(chalk.red(`\n❌ Port ${PORT} đang bị chiếm. Dừng process đang dùng port đó rồi thử lại.`));
        console.log(chalk.gray(`  lsof -i :${PORT} | grep LISTEN`));
      }
      reject(err);
    });
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    const tokens = await startCallbackServer();

    writeTokenToEnv(tokens.refresh_token);

    console.log(chalk.bold.green('\n✅ Hoàn tất! Thông tin token:'));
    console.log(`  Refresh Token: ${tokens.refresh_token.slice(0, 30)}...`);
    console.log(`  Access Token:  ${tokens.access_token?.slice(0, 30)}...`);
    if (tokens.expiry_date) {
      console.log(`  Access Token hết hạn: ${new Date(tokens.expiry_date).toLocaleString('vi-VN')}`);
    }

    console.log(chalk.bold.blue('\n📋 Bước tiếp theo:'));
    console.log('  1. Lấy DRIVE_FOLDER_ID từ URL Google Drive folder cần index');
    console.log('     VD: https://drive.google.com/drive/folders/1ABC...XYZ  →  DRIVE_FOLDER_ID=1ABC...XYZ');
    console.log('  2. Điền vào spike/.env: DRIVE_FOLDER_ID=...');
    console.log('  3. Chạy: cd spike && npm run spike:drive\n');

    process.exit(0);
  } catch (err) {
    console.error(chalk.red('\n❌ Lỗi:'), err.message);
    process.exit(1);
  }
}

main();
