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

  const [criticalIssues, aiStats, knowledgeGaps] = await Promise.all([
    // Issues critical/high/medium đang open
    query(
      `SELECT s.issue_type, s.severity, s.title, gn.name AS group_name,
              GREATEST(0, EXTRACT(DAY FROM NOW() - s.detected_at))::int AS days_open
       FROM sales_issues s
       LEFT JOIN group_names gn ON gn.group_id = s.group_id
       WHERE s.status = 'open' AND s.severity IN ('critical', 'high', 'medium')
       ORDER BY CASE s.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, s.detected_at DESC
       LIMIT 8`,
    ),
    // Thống kê AI hôm qua
    query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_answered = false OR answer ILIKE '%chưa có thông tin%' THEN 1 ELSE 0 END) AS unanswered
       FROM ai_logs
       WHERE created_at >= NOW() - INTERVAL '1 day'`,
    ),
    // Top 3 câu hỏi AI chưa trả lời được trong 7 ngày (knowledge gap)
    query(
      `SELECT query, COUNT(*) AS cnt
       FROM ai_logs
       WHERE (is_answered = false OR answer ILIKE '%chưa có thông tin%')
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY query ORDER BY cnt DESC LIMIT 3`,
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

  // Issues
  if (criticalIssues.rows.length > 0) {
    lines.push(`\n⚠️ *Issues đang mở (${criticalIssues.rows.length}):*`);
    for (const r of criticalIssues.rows) {
      const sev = r.severity === 'critical' ? '🔴' : r.severity === 'high' ? '🟠' : '🟡';
      const ageLabel = r.days_open > 0 ? ` (mở ${r.days_open} ngày)` : ' (mở hôm nay)';
      lines.push(`${sev} ${r.group_name}: ${r.title}${ageLabel}`);
    }
    lines.push(`\n→ CS Lead vui lòng kiểm tra và điều chỉnh.`);
  } else {
    lines.push(`\n✅ Không có vấn đề nào`);
  }

  // Knowledge gap — câu hỏi Sales hay hỏi mà AI chưa trả lời được
  if (knowledgeGaps.rows.length > 0) {
    lines.push(`\n📚 *Knowledge gap 7 ngày qua (${knowledgeGaps.rows.length} câu):*`);
    for (const r of knowledgeGaps.rows) {
      const q = r.query.length > 60 ? r.query.slice(0, 57) + '…' : r.query;
      lines.push(`• "${q}" (${r.cnt}x)`);
    }
    lines.push(`→ Cập nhật tài liệu Google Drive để cải thiện.`);
  }

  lines.push(`\n🔗 Dashboard: https://themasterlayer.giftzone.vn/`);
  return lines.join('\n');
}

export function startDailyAlert(api) {
  cron.schedule('0 8 * * 1-6', async () => {
    // Đọc config tại runtime — admin_group_id có thể được set sau startup qua Dashboard
    const adminGroupId = getConfig('admin_group_id') || process.env.ZALO_TEST_GROUP_ID;
    if (!adminGroupId) {
      log.warn('Daily Alert bỏ qua — chưa cấu hình admin_group_id');
      return;
    }
    log.info('Gửi daily alert...');
    try {
      const msg = await buildAlertMessage();
      await api.sendMessage({ msg }, adminGroupId, MessageType.GroupMessage);
      log.info('Daily alert đã gửi');
    } catch (err) {
      log.error('Daily alert lỗi:', err.message);
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  log.info('Daily Alert started — gửi 8:00 AM T2-T7');
}
