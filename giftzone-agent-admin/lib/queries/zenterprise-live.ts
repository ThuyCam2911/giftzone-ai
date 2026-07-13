import { query } from '@/lib/db';

export interface LiveMessageInput {
  senderId: string;      // 'live-customer' | 'live-employee-a' | 'live-employee-b'
  senderName: string;
  text: string;
}

export interface LiveAnalysis {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  category: string;
  quality_score: number;
  has_issue: boolean;
  issue_type: string | null;
  issue_severity: 'critical' | 'high' | 'medium' | 'low' | null;
  issue_title: string | null;
}

/**
 * Ghi 1 phiên zEnterprise Live vào đúng các bảng production (group_names, messages,
 * ai_logs, sales_issues) — để trang /groups/[groupId] có sẵn hiển thị y hệt dữ liệu thật,
 * không phải màn hình dựng riêng.
 */
export async function insertLiveConversation(params: {
  groupId: string;
  groupName: string;
  messages: LiveMessageInput[];
  analysis: LiveAnalysis;
  latencyMs: number;
}): Promise<void> {
  const { groupId, groupName, messages, analysis, latencyMs } = params;

  await query(
    `INSERT INTO group_names (group_id, name, group_type, updated_at)
     VALUES ($1, $2, 'customer', NOW())
     ON CONFLICT (group_id) DO UPDATE SET name = $2, updated_at = NOW()`,
    [groupId, groupName],
  );

  const base = Date.now();
  const n = messages.length;
  for (let i = 0; i < n; i++) {
    const m = messages[i];
    const isEmployee = m.senderId.startsWith('live-employee');
    const msgTs = new Date(base - (n - i) * 20_000).toISOString();
    await query(
      `INSERT INTO messages (group_id, sender_uid, sender_name, content, msg_ts, is_gz_member, msg_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'text')`,
      [groupId, m.senderId, m.senderName, m.text, msgTs, isEmployee],
    );
  }

  const answer =
    `Tóm tắt: ${analysis.summary}\n` +
    `Cảm xúc: ${SENTIMENT_LABEL[analysis.sentiment] ?? analysis.sentiment} · ` +
    `Danh mục: ${analysis.category} · Điểm chất lượng phục vụ: ${analysis.quality_score}/10`;

  await query(
    `INSERT INTO ai_logs (group_id, sender_uid, query, answer, sources, latency_ms, is_answered, top_score)
     VALUES ($1, 'ze-live-analyzer', $2, $3, '[]'::jsonb, $4, true, 1)`,
    [groupId, `[Phân tích tự động] ${groupName}`, answer, latencyMs],
  );

  if (analysis.has_issue && analysis.issue_type) {
    const lastCustomerMsg = [...messages].reverse().find(m => m.senderId === 'live-customer');
    await query(
      `INSERT INTO sales_issues (group_id, issue_key, issue_type, severity, title, description, evidence, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       ON CONFLICT (issue_key) DO NOTHING`,
      [
        groupId,
        `ze-live-${groupId}`,
        analysis.issue_type,
        analysis.issue_severity ?? 'medium',
        analysis.issue_title ?? analysis.summary.slice(0, 80),
        analysis.summary,
        lastCustomerMsg?.text ?? null,
      ],
    );
  }
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: 'Tích cực',
  neutral: 'Trung tính',
  negative: 'Tiêu cực',
};
