// ─── Deals / Issues ──────────────────────────────────────────────────────────

export interface SalesIssue {
  id: number;
  group_id: string;
  group_name: string | null;
  issue_key: string;
  issue_type: string;
  severity: string;
  title: string;
  description: string | null;
  evidence: string | null;
  status: string;
  detected_at: string;
  resolved_at: string | null;
}

export interface GroupQualityRow {
  group_id: string;
  group_name: string | null;
  msg_count: number;
  open_issues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  ai_queries: number;
  resolved_issues: number;
  quality_score: number;
}

export interface DealsStats {
  openCount: number;
  criticalCount: number;
  resolvedToday: number;
  totalAllTime: number;
  avgScore: number;
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export interface LogRow {
  id: number;
  group_id: string;
  group_name: string | null;
  query: string;
  answer: string;
  sources: string[];
  latency_ms: number;
  created_at: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface QuestionRow {
  question: string;
  cnt: number;
}

export interface GroupUsageRow {
  group_id: string;
  group_name: string | null;
  cnt: number;
  avg_ms: number;
}

export interface DocUsageRow {
  src: string;
  cnt: number;
}

export interface LatencyStats {
  p50: number;
  p95: number;
  maxMs: number;
  total: number;
}

export interface DayCount {
  label: string;
  count: number;
}

// ─── Groups / Settings ───────────────────────────────────────────────────────

export interface GroupNameRow {
  group_id: string;
  name: string;
  group_type: string;
  updated_at: string;
}

export interface ConfigRow {
  key: string;
  value: string;
  description: string;
  updated_at: string;
}
