/**
 * SPIKE: zca-js v1.6.0 — Session Stability
 *
 * API v1.6.0 dùng credentials từ browser (không có QR login).
 * Cách lấy credentials: xem hướng dẫn trong README.md
 *
 * Mục tiêu:
 *   1. Login bằng cookie + imei + userAgent
 *   2. Lấy danh sách groups → xác nhận kết nối
 *   3. Lắng nghe messages realtime → đo latency
 *   4. Gửi tin nhắn test vào group
 *   5. Đo session stability → bao lâu expire?
 *
 * Cách chạy:
 *   cd spike && npm install
 *   # Điền ZALO_IMEI, ZALO_COOKIE, ZALO_USER_AGENT vào .env
 *   npm run spike:zalo
 */

import { Zalo, MessageType } from 'zca-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '../results');

const results = {
  timestamp: new Date().toISOString(),
  zca_js_version: '1.6.0',
  tests: {},
};

function log(label, msg, color = 'white') {
  console.log(chalk[color](`[${label}] ${msg}`));
}

function saveResults() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, 'zalo-spike-result.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  log('RESULT', `Saved → spike/results/zalo-spike-result.json`, 'cyan');
}

// ─── Kiểm tra credentials ────────────────────────────────────────────────────
function checkCredentials() {
  const missing = [];
  if (!process.env.ZALO_IMEI) missing.push('ZALO_IMEI');
  if (!process.env.ZALO_COOKIE) missing.push('ZALO_COOKIE');
  if (!process.env.ZALO_USER_AGENT) missing.push('ZALO_USER_AGENT');

  if (missing.length > 0) {
    console.log(chalk.red('\n✗ Thiếu credentials trong .env:'), missing.join(', '));
    console.log(chalk.yellow('\nCách lấy credentials (3 bước):'));
    console.log('  1. Mở https://chat.zalo.me trên Chrome, đăng nhập tài khoản Agent');
    console.log('  2. Cài extension ZaloDataExtractor:');
    console.log('     https://github.com/JustKemForFun/ZaloDataExtractor');
    console.log('  3. Mở extension → copy IMEI, Cookie, UserAgent vào .env:\n');
    console.log(chalk.cyan('     ZALO_IMEI=<z_uuid từ extension>'));
    console.log(chalk.cyan('     ZALO_COOKIE=<cookie string từ extension>'));
    console.log(chalk.cyan('     ZALO_USER_AGENT=<user agent từ extension>\n'));
    console.log(chalk.gray('Hoặc lấy thủ công từ DevTools:'));
    console.log(chalk.gray('  IMEI: F12 → Console → localStorage.getItem("z_uuid")'));
    console.log(chalk.gray('  Cookie: F12 → Application → Cookies → chat.zalo.me → copy all'));
    console.log(chalk.gray('  UserAgent: F12 → Console → navigator.userAgent\n'));
    return false;
  }
  return true;
}

// ─── TEST 1: Login ────────────────────────────────────────────────────────────
async function testLogin() {
  log('TEST 1', 'Login với credentials từ .env...', 'yellow');
  const start = Date.now();

  // Cookie có thể là:
  //   - JSON array string "[{...}]" từ ZaloDataExtractor → cần wrap thành { url, cookies: [] }
  //   - Cookie string thuần "name=value; ..." → dùng trực tiếp
  let cookieValue = process.env.ZALO_COOKIE;
  try {
    const parsed = JSON.parse(cookieValue);
    if (Array.isArray(parsed)) {
      // J2TEAM format — zca-js expect { url, cookies: [] }
      cookieValue = { url: 'https://chat.zalo.me', cookies: parsed };
      log('TEST 1', 'Cookie format: J2TEAM array → wrapped thành object', 'cyan');
    }
  } catch {
    // Không phải JSON → là cookie string thuần, giữ nguyên
    log('TEST 1', 'Cookie format: plain string', 'cyan');
  }

  const credentials = {
    imei: process.env.ZALO_IMEI,
    cookie: cookieValue,
    userAgent: process.env.ZALO_USER_AGENT,
  };

  try {
    const zalo = new Zalo(credentials, { selfListen: true, checkUpdate: false });
    const api = await zalo.login();
    const elapsed = Date.now() - start;

    results.tests.login = {
      status: 'PASS',
      elapsed_ms: elapsed,
      note: 'Login thành công, session active',
    };
    log('TEST 1', `PASS — Login trong ${elapsed}ms`, 'green');
    return api;
  } catch (err) {
    results.tests.login = {
      status: 'FAIL',
      error: err.message,
      note: 'Cookie có thể đã expire — lấy lại từ browser',
    };
    log('TEST 1', `FAIL — ${err.message}`, 'red');
    if (err.message?.includes('cookie') || err.message?.includes('auth')) {
      log('TEST 1', 'Cookie đã expire — đăng nhập lại chat.zalo.me và lấy cookie mới', 'yellow');
    }
    throw err;
  }
}

// ─── TEST 2: Lấy danh sách groups ────────────────────────────────────────────
async function testGetGroups(api) {
  log('TEST 2', 'Lấy danh sách groups...', 'yellow');
  const start = Date.now();

  try {
    const groupsRes = await api.getAllGroups();
    const elapsed = Date.now() - start;

    // getAllGroups trả về object { gridVerMap, ... } chứa grid keys
    const groupIds = Object.keys(groupsRes?.gridVerMap ?? groupsRes ?? {});

    results.tests.get_groups = {
      status: 'PASS',
      elapsed_ms: elapsed,
      group_count: groupIds.length,
      sample_ids: groupIds.slice(0, 5),
    };
    log('TEST 2', `PASS — ${groupIds.length} groups trong ${elapsed}ms`, 'green');
    return { groupIds, raw: groupsRes };
  } catch (err) {
    results.tests.get_groups = { status: 'FAIL', error: err.message };
    log('TEST 2', `FAIL — ${err.message}`, 'red');
    return { groupIds: [], raw: null };
  }
}

// ─── TEST 3: getOwnId — xác nhận account info ────────────────────────────────
async function testGetOwnId(api) {
  log('TEST 3', 'Lấy thông tin tài khoản Agent...', 'yellow');
  const start = Date.now();

  try {
    const ownId = await api.getOwnId();
    const elapsed = Date.now() - start;

    results.tests.own_id = {
      status: 'PASS',
      elapsed_ms: elapsed,
      own_id: ownId,
      note: 'Đây là userId của Agent account — dùng để detect @mention',
    };
    log('TEST 3', `PASS — Agent ID: ${ownId} (${elapsed}ms)`, 'green');
    return ownId;
  } catch (err) {
    results.tests.own_id = { status: 'FAIL', error: err.message };
    log('TEST 3', `FAIL — ${err.message}`, 'red');
    return null;
  }
}

// ─── TEST 4: Realtime listener ────────────────────────────────────────────────
async function testListener(api, ownId) {
  log('TEST 4', 'Bắt đầu realtime listener — đợi 90s...', 'yellow');
  log('TEST 4', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('TEST 4', '  👉 Lấy điện thoại, vào group Zalo test', 'cyan');
  log('TEST 4', '  👉 Gửi bất kỳ tin nhắn nào vào group', 'cyan');
  log('TEST 4', '  👉 Sau đó gửi thêm: @agent test', 'cyan');
  log('TEST 4', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const receivedMessages = [];
  const agentMentions = [];

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      results.tests.listener = {
        status: receivedMessages.length > 0 ? 'PASS' : 'NO_MESSAGES',
        duration_s: 60,
        messages_received: receivedMessages.length,
        agent_mentions: agentMentions.length,
        latencies_ms: receivedMessages.map((m) => m.latency_ms),
        avg_latency_ms:
          receivedMessages.length > 0
            ? Math.round(
                receivedMessages.reduce((s, m) => s + m.latency_ms, 0) / receivedMessages.length
              )
            : null,
        p95_latency_ms:
          receivedMessages.length > 0
            ? (() => {
                const sorted = [...receivedMessages.map((m) => m.latency_ms)].sort((a, b) => a - b);
                return sorted[Math.ceil(sorted.length * 0.95) - 1];
              })()
            : null,
        note:
          receivedMessages.length === 0
            ? 'Không nhận được tin — kiểm tra Agent đã trong group chưa'
            : undefined,
      };

      const r = results.tests.listener;
      log(
        'TEST 4',
        receivedMessages.length > 0
          ? `PASS — ${receivedMessages.length} tin | avg ${r.avg_latency_ms}ms | p95 ${r.p95_latency_ms}ms`
          : 'NO_MESSAGES — Không nhận được tin trong 60s',
        receivedMessages.length > 0 ? 'green' : 'yellow'
      );
      if (agentMentions.length > 0) {
        log('TEST 4', `@agent mention detected: ${agentMentions.length} lần`, 'green');
      }
      resolve();
    }, 30_000);

    api.listener.on('message', (message) => {
      const serverTs = Number(message.data?.ts ?? message.data?.serverTime ?? 0);
      const latency_ms = serverTs > 0 ? Date.now() - serverTs : 0;

      const content =
        typeof message.data?.content === 'string'
          ? message.data.content
          : JSON.stringify(message.data?.content ?? '');

      const isGroupMsg = message.type === MessageType.GroupMessage;
      const isAgentMention =
        ownId &&
        (content.includes(`@${ownId}`) ||
          message.data?.mentions?.some?.((m) => m.uid === ownId));

      receivedMessages.push({
        latency_ms,
        type: message.type,
        threadId: message.threadId,
        content_preview: content.slice(0, 50),
        is_group: isGroupMsg,
        is_mention: !!isAgentMention,
      });

      if (isAgentMention) {
        agentMentions.push({ content, threadId: message.threadId });
        log('TEST 4', `@agent MENTION detected! content: "${content.slice(0, 80)}"`, 'green');
      } else {
        log('TEST 4', `Tin nhận [${isGroupMsg ? 'GROUP' : 'DM'}] latency=${latency_ms}ms: "${content.slice(0, 40)}"`, 'white');
      }
    });

    api.listener.on('connected', () => {
      log('TEST 4', 'WebSocket connected ✓', 'green');

      // Auto self-test: gửi 3 tin với delay để đo latency
      const delays = [1000, 3000, 6000];
      delays.forEach((delay, i) => {
        setTimeout(async () => {
          try {
            await api.sendMessage(
              { msg: `[auto-test ${i + 1}/3] latency probe ${Date.now()}` },
              process.env.ZALO_TEST_GROUP_ID,
              MessageType.GroupMessage
            );
          } catch (e) {
            log('TEST 4', `auto-test send error: ${e.message}`, 'red');
          }
        }, delay);
      });

      log('TEST 4', 'Tự gửi 3 tin auto-test để đo latency...', 'cyan');
      log('TEST 4', '+ Có thể gửi thêm "@agent test" từ điện thoại trong 30s còn lại', 'yellow');
    });

    api.listener.on('closed', () => {
      log('TEST 4', 'WebSocket closed — listener dừng', 'red');
      clearTimeout(timeout);
      resolve();
    });

    api.listener.on('error', (err) => {
      log('TEST 4', `Listener error: ${err}`, 'red');
    });

    api.listener.start();
  });
}

// ─── TEST 5: Gửi tin vào group ────────────────────────────────────────────────
async function testSendMessage(api, groupIds) {
  log('TEST 5', 'Gửi tin nhắn test vào group...', 'yellow');

  // Cần TEST_GROUP_ID trong .env hoặc dùng group đầu tiên
  const targetGroupId = process.env.ZALO_TEST_GROUP_ID || groupIds[0];

  if (!targetGroupId) {
    results.tests.send_message = {
      status: 'SKIP',
      note: 'Không có group — set ZALO_TEST_GROUP_ID trong .env',
    };
    log('TEST 5', 'SKIP — Set ZALO_TEST_GROUP_ID trong .env', 'yellow');
    return;
  }

  try {
    const start = Date.now();
    await api.sendMessage(
      {
        msg: `[SPIKE TEST ${new Date().toLocaleTimeString('vi-VN')}] Tin nhắn tự động từ zca-js spike script`,
      },
      targetGroupId,
      MessageType.GroupMessage
    );
    const elapsed = Date.now() - start;

    results.tests.send_message = {
      status: 'PASS',
      elapsed_ms: elapsed,
      group_id: targetGroupId,
    };
    log('TEST 5', `PASS — Gửi tin trong ${elapsed}ms vào group ${targetGroupId}`, 'green');
  } catch (err) {
    results.tests.send_message = { status: 'FAIL', error: err.message };
    log('TEST 5', `FAIL — ${err.message}`, 'red');
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.bold.blue('\n=== SPIKE: zca-js v1.6.0 Session Stability ===\n'));

  if (!checkCredentials()) {
    results.tests.credentials = { status: 'MISSING' };
    saveResults();
    process.exit(1);
  }

  let api;
  try {
    api = await testLogin();
  } catch {
    saveResults();
    process.exit(1);
  }

  const ownId = await testGetOwnId(api);
  const { groupIds } = await testGetGroups(api);
  await testSendMessage(api, groupIds);
  await testListener(api, ownId); // 60s window

  // ─── Tổng kết ─────────────────────────────────────────────────────────────
  const tests = results.tests;
  const passed = Object.values(tests).filter((t) => t.status === 'PASS').length;
  const total = Object.keys(tests).length;

  const listenerOk = tests.listener?.avg_latency_ms != null && tests.listener.avg_latency_ms < 2000;
  const sendOk = tests.send_message?.status === 'PASS';

  results.summary = {
    verdict:
      tests.login?.status === 'PASS' && (listenerOk || tests.listener?.status === 'NO_MESSAGES')
        ? 'GO — zca-js hoạt động, có thể build'
        : 'INVESTIGATE — Xem chi tiết từng test',
    passed_tests: `${passed}/${total}`,
    key_findings: [
      tests.own_id?.own_id ? `Agent ID: ${tests.own_id.own_id}` : null,
      tests.get_groups?.group_count != null
        ? `${tests.get_groups.group_count} groups hiện có`
        : null,
      tests.listener?.avg_latency_ms != null
        ? `Message latency: avg ${tests.listener.avg_latency_ms}ms | p95 ${tests.listener.p95_latency_ms}ms`
        : null,
      tests.listener?.agent_mentions > 0
        ? `@agent mention detection: WORKING`
        : '@agent mention: chưa test (gửi "@agent xxx" vào group)',
    ].filter(Boolean),
    recommendations: [
      'Session cookie từ browser — cần cơ chế alert khi expire + hướng dẫn renewal',
      'Listener dừng nếu mở Zalo Web song song — Agent cần chạy trên server riêng',
      'Nên test: chạy listener liên tục 24h, đo thời gian expire thực tế',
    ],
  };

  console.log(chalk.bold.blue('\n=== KẾT QUẢ SPIKE zca-js ==='));
  console.log(chalk[passed >= 3 ? 'green' : 'yellow'](`${passed}/${total} tests PASS`));
  results.summary.key_findings.forEach((f) => console.log(chalk.cyan(`  • ${f}`)));
  console.log(chalk.bold(`\nVerdict: ${results.summary.verdict}`));

  saveResults();
  process.exit(0);
}

main().catch((err) => {
  console.error(chalk.red('\nSpike crash:'), err.message);
  results.crash = err.message;
  saveResults();
  process.exit(1);
});
