/**
 * Daily Alert — gửi tóm tắt buổi sáng vào group admin Zalo
 * Cron: 8:00 AM Mon–Sat (Asia/Ho_Chi_Minh)
 * Config: settings.admin_group_id hoặc ZALO_TEST_GROUP_ID
 */
import cron from 'node-cron';
import { MessageType } from 'zca-js';
import { query } from '../utils/db.js';
import { getConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('DailyAlert');

async function buildAlertMessage() {
  const today = new Date().toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const [criticalIssues, inactiveGroups, aiStats] = await Promise.all([
    // Issues critical/high đang open
    query(
      `SELECT s.issue_type, s.severity, s.title, gn.name AS group_name
       FROM sales_issues s
       LEFT JOIN group_names gn ON gn.group_id = s.group_id
       WHERE s.status = 'open' AND s.severity IN ('critical', 'high')
       ORDER BY CASE s.severity WHEN 'critical' THEN 1 ELSE 2 END, s.detected_at DESC
       LIMIT 5`,
    ),
    // Nhóm im lặng > 3 ngày
    query(
      `SELECT m.group_id, gn.name, MAX(m.msg_ts) AS last_msg
       FROM messages m
       LEFT JOIN group_names gn ON gn.group_id = m.group_id
       WHERE COALESCE(gn.group_type, 'customer') != 'internal'
       GROUP BY m.group_id, gn.name
       HAVING MAX(m.msg_ts) < NOW() - INTERVAL '3 days'
       ORDER BY MAX(m.msg_ts) ASC
       LIMIT 5`,
    ),
    // Thống kê AI hôm qua
    query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN answer ILIKE '%chưa có thông tin%' THEN 1 ELSE 0 END) AS unanswered
       FROM ai_logs
       WHERE created_at >= NOW() - INTERVAL '1 day'`,
    ),
  ]);

  const lines = [`📊 *DAILY ALERT — ${today}*\n`];

  // AI stats
  const aiTotal = Number(aiStats.rows[0]?.total ?? 0);
  const aiUnanswered = Number(aiStats.rows[0]?.unanswered ?? 0);
  if (aiTotal > 0) {
    const pct = Math.round(((aiTotal - aiUnanswered) / aiTotal) * 100);
    lines.push(`🤖 *AI hôm qua:* ${aiTotal} câu hỏi — chất lượng ${pct}%`);
  } else {
    lines.push(`🤖 *AI hôm qua:* Chưa có câu hỏi nào`);
  }

  // Critical issues
  if (criticalIssues.rows.length > 0) {
    lines.push(`\n⚠️ *Issues cần xử lý ngay (${criticalIssues.rows.length}):*`);
    for (const r of criticalIssues.rows) {
      const sev = r.severity === 'critical' ? '🔴' : '🟠';
      lines.push(`${sev} ${r.group_name ?? r.group_id}: ${r.title}`);
    }
  } else {
    lines.push(`\n✅ Không có issues critical/high đang mở`);
  }

  // Inactive groups
  if (inactiveGroups.rows.length > 0) {
    lines.push(`\n💤 *Nhóm im lặng > 3 ngày (${inactiveGroups.rows.length}):*`);
    for (const r of inactiveGroups.rows) {
      const days = Math.floor((Date.now() - new Date(r.last_msg).getTime()) / 86400000);
      lines.push(`• ${r.name ?? r.group_id}: ${days} ngày`);
    }
  }

  lines.push(`\n🔗 Dashboard: giftzone-ai.vercel.app`);
  return lines.join('\n');
}

export function startDailyAlert(api) {
  const adminGroupId = getConfig('admin_group_id') || process.env.ZALO_TEST_GROUP_ID;

  if (!adminGroupId) {
    log.warn('Daily Alert tắt — chưa cấu hình admin_group_id (settings) hoặc ZALO_TEST_GROUP_ID');
    return;
  }

  cron.schedule('0 8 * * 1-6', async () => {
    log.info('Gửi daily alert...');
    try {
      const msg = await buildAlertMessage();
      await api.sendMessage({ msg }, adminGroupId, MessageType.GroupMessage);
      log.info('Daily alert đã gửi');
    } catch (err) {
      log.error('Daily alert lỗi:', err.message);
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  log.info(`Daily Alert started — gửi 8:00 AM T2-T7 vào group ${adminGroupId}`);
}
