/**
 * GiftZone AI Sales Agent
 * Entry point — khởi động toàn bộ hệ thống
 */
import 'dotenv/config';
import chalk from 'chalk';
import { createServer } from 'http';
import { MessageType } from 'zca-js';
import { SessionManager } from './zalo/session.js';
import { GroupListener } from './zalo/listener.js';
import { MentionResponder } from './zalo/responder.js';
import { startSummaryEngine } from './summary/engine.js';
import { startDealAnalyzer } from './deal/analyzer.js';
import { startDailyAlert } from './alert/daily.js';
import { indexAll, startAutoSync } from './rag/indexer.js';
import { initSchema } from './utils/db.js';
import { loadConfig, getConfig } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { extractZaloCookies } from './utils/cookie-extractor.js';
import cron from 'node-cron';

const log = createLogger('Main');

async function main() {
  console.log(chalk.bold.blue('\n╔══════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   GiftZone AI Sales Agent — MVP      ║'));
  console.log(chalk.bold.blue('╚══════════════════════════════════════╝\n'));

  // 1. Khởi tạo DB schema + load config
  log.info('Bước 1/5: Khởi tạo database schema...');
  await initSchema();
  await loadConfig();
  log.info(`Config loaded — agent: ${getConfig('agent_name')}, drive: ${getConfig('drive_folder_id')}`);

  const skipZalo = process.env.SKIP_ZALO === 'true';
  let api = null;

  if (skipZalo) {
    log.info('SKIP_ZALO=true — bỏ qua kết nối Zalo (chế độ Deal Monitor)');
  } else {
    // 2. Login Zalo
    log.info('Bước 2/5: Kết nối Zalo...');
    const session = new SessionManager();
    session.onExpired = async () => {
      log.error('⚠️  SESSION EXPIRED — Agent dừng hoạt động. Cần cập nhật cookie và restart.');
      const adminGroup = process.env.ZALO_TEST_GROUP_ID;
      if (adminGroup && api) {
        try {
          await api.sendMessage(
            { msg: '⚠️ GiftZone Agent: Zalo session vừa hết hạn.\nVào Dashboard Settings → paste cookie mới → Render Manual Deploy.' },
            adminGroup,
            MessageType.GroupMessage
          );
        } catch (_) { /* ignore — session đã expire, gửi có thể fail */ }
      }
      process.exit(1);
    };
    api = await session.login();

    // 3. Index Google Drive (chạy nền, không block startup)
    log.info('Bước 3/5: Index tài liệu Google Drive (nền)...');
    if (getConfig('skip_index') !== 'true') {
      indexAll()
        .then(total => log.info(`Index Drive xong: ${total} chunks`))
        .catch(err => log.warn(`Index Drive lỗi: ${err.message} — Chạy "npm run index:drive" khi quota reset`));
    } else {
      log.info('SKIP_INDEX=true — bỏ qua index Drive lúc startup');
    }

    // 4. Khởi động listener + responder
    log.info('Bước 4/5: Khởi động Zalo listener...');
    const responder = new MentionResponder(api);
    const listener = new GroupListener(api, session.ownId);
    listener.onMention = (ctx) => responder.handle(ctx);
    listener.start();

    // 5. Khởi động Summary Engine + Drive auto-sync
    log.info('Bước 5/5: Khởi động Summary Engine & Drive auto-sync...');
    if (process.env.ENABLE_SUMMARY !== 'false') {
      startSummaryEngine(api);
    } else {
      log.info('Summary Engine tắt (ENABLE_SUMMARY=false)');
    }
    startAutoSync().catch(err => log.warn('Auto-sync lỗi', err.message));

    // Daily morning alert
    startDailyAlert(api);
  }

  if (process.env.ENABLE_DEAL_ANALYSIS === 'true') {
    startDealAnalyzer(api); // api=null nếu SKIP_ZALO → không gửi critical alert
  } else {
    log.info('Deal Intelligence tắt (ENABLE_DEAL_ANALYSIS != true)');
  }

  // 6. Cookie extractor — cron hàng ngày lúc 3:00 sáng (không chạy lúc startup)
  cron.schedule('0 3 * * *', () => {
    log.info('[CookieCron] Đang refresh Zalo cookie từ Chrome...');
    extractZaloCookies()
      .then(ok => ok
        ? log.info('[CookieCron] ✅ Refresh cookie thành công')
        : log.warn('[CookieCron] ⚠️ Refresh cookie thất bại — kiểm tra Chrome đã mở chat.zalo.me chưa'))
      .catch(err => log.error('[CookieCron] Lỗi:', err.message));
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  console.log(chalk.bold.green('\n✅ Agent đang chạy — sẵn sàng nhận @mention trong group\n'));
  console.log(chalk.gray('   Ctrl+C để tắt'));

  // HTTP health endpoint — giữ Render Free tier không bị sleep
  const PORT = process.env.PORT || 3000;
  createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  }).listen(PORT, () => log.info(`Health endpoint: http://localhost:${PORT}`));

  // Graceful shutdown
  process.on('SIGINT', () => {
    log.info('Shutting down...');
    session.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(chalk.red('\n❌ Agent crash:'), err.message);
  console.error(err);
  process.exit(1);
});
