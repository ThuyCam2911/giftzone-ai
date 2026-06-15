/**
 * Test @mention detection trong Zalo group
 *
 * Script này chạy listener liên tục, in ra raw structure của mọi tin nhắn
 * để xác định cách parse @mention đúng trong zca-js.
 *
 * Cách dùng:
 *   cd spike && node zalo/mention-test.js
 *   → Lấy điện thoại, vào group Zalo, gửi "@<tên agent> xin chào"
 *   → Script sẽ in raw message và detect mention
 *   Ctrl+C để thoát
 */

import { Zalo, MessageType } from 'zca-js';
import chalk from 'chalk';
import 'dotenv/config';

// ─── Login ────────────────────────────────────────────────────────────────────
let cookieValue = process.env.ZALO_COOKIE;
try {
  const parsed = JSON.parse(cookieValue);
  if (Array.isArray(parsed)) {
    cookieValue = { url: 'https://chat.zalo.me', cookies: parsed };
  }
} catch {}

const credentials = {
  imei: process.env.ZALO_IMEI,
  cookie: cookieValue,
  userAgent: process.env.ZALO_USER_AGENT,
};

console.log(chalk.bold.blue('\n=== @mention Detection Test ===\n'));
console.log(chalk.yellow('Đang login...'));

const zalo = new Zalo(credentials, { selfListen: false, checkUpdate: false });
const api = await zalo.login();
const ownId = await api.getOwnId();

console.log(chalk.green(`✓ Login OK — Agent ID: ${ownId}`));
console.log(chalk.cyan(`✓ Group ID: ${process.env.ZALO_TEST_GROUP_ID}`));
console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk.bold('  👉 Lấy điện thoại → vào group test'));
console.log(chalk.bold('  👉 Nhấn @ và chọn tên Agent → gửi "@Agent xin chào"'));
console.log(chalk.bold('  👉 Script sẽ in raw message + detect mention'));
console.log(chalk.bold('  Ctrl+C để thoát'));
console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

// ─── Listener ─────────────────────────────────────────────────────────────────
api.listener.on('connected', () => {
  console.log(chalk.green('✓ WebSocket connected — đang lắng nghe...\n'));
});

api.listener.on('message', (message) => {
  const isGroup = message.type === MessageType.GroupMessage;
  if (!isGroup) return; // chỉ quan tâm group message

  const data = message.data ?? {};
  const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content ?? '');
  const mentions = data.mentions ?? data.mention ?? [];
  const fromUid = data.uidFrom ?? data.uid ?? data.fromUid ?? '?';

  // ─── In raw structure để debug ────────────────────────────────────────────
  console.log(chalk.bold.yellow('─── TIN NHẮN MỚI ───────────────────────────────'));
  console.log(chalk.white(`Từ UID:    ${fromUid}`));
  console.log(chalk.white(`Content:   ${content.slice(0, 120)}`));
  console.log(chalk.white(`Mentions:  ${JSON.stringify(mentions)}`));
  console.log(chalk.gray(`msgType:   ${data.msgType ?? data.type ?? '?'}`));
  console.log(chalk.gray(`Raw keys:  ${Object.keys(data).join(', ')}`));

  // In toàn bộ data nếu có mention (để xem structure đầy đủ)
  if (mentions.length > 0 || content.includes('@')) {
    console.log(chalk.cyan('\n📌 Message có @ — raw data:'));
    console.log(chalk.cyan(JSON.stringify(data, null, 2).slice(0, 800)));
  }

  // ─── Detect mention ───────────────────────────────────────────────────────
  const mentionedByContent = content.includes(`@${ownId}`);
  const mentionedByArray = Array.isArray(mentions) && mentions.some(
    (m) => String(m.uid ?? m.userId ?? m.id ?? '') === String(ownId)
  );
  const isAgentMentioned = mentionedByContent || mentionedByArray;

  if (isAgentMentioned) {
    console.log(chalk.bold.green('\n🎯 @AGENT MENTION DETECTED!'));
    console.log(chalk.green(`   Content: "${content}"`));
    console.log(chalk.green(`   via content: ${mentionedByContent} | via mentions[]: ${mentionedByArray}`));

    // Auto-reply để xác nhận
    const groupId = message.threadId ?? process.env.ZALO_TEST_GROUP_ID;
    api.sendMessage(
      { msg: `✅ [TEST] Agent nhận được @mention! Query: "${content.replace(/@\S+/g, '').trim()}"` },
      groupId,
      MessageType.GroupMessage
    ).then(() => {
      console.log(chalk.green('   → Auto-reply đã gửi'));
    }).catch((e) => {
      console.log(chalk.red(`   → Auto-reply lỗi: ${e.message}`));
    });
  } else {
    console.log(chalk.gray('   (không phải @mention Agent)'));
  }

  console.log('');
});

api.listener.on('closed', () => {
  console.log(chalk.red('\n✗ WebSocket closed — Zalo Web đang mở trên browser?'));
  process.exit(1);
});

api.listener.on('error', (err) => {
  console.log(chalk.red(`✗ Listener error: ${err}`));
});

api.listener.start();

// Giữ process chạy
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nĐã tắt listener. Bye!'));
  process.exit(0);
});
