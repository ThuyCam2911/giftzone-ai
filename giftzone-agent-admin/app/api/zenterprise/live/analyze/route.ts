import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isAuthenticated } from '@/lib/auth';
import { insertLiveConversation, type LiveMessageInput, type LiveAnalysis } from '@/lib/queries/zenterprise-live';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const VALID_ISSUE_TYPES = [
  'no_reply', 'slow_reply', 'rude_behavior', 'customer_complaint',
  'broken_promise', 'missed_opportunity', 'dropped_conversation',
  'low_engagement', 'negative_sentiment',
];

function stripFences(text: string): string {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
}

function fallbackAnalysis(messages: LiveMessageInput[]): LiveAnalysis {
  return {
    summary: `Hội thoại gồm ${messages.length} tin nhắn giữa nhân viên và khách hàng.`,
    sentiment: 'neutral',
    category: 'Khác',
    quality_score: 7,
    has_issue: false,
    issue_type: null,
    issue_severity: null,
    issue_title: null,
  };
}

async function analyzeWithGemini(scenarioLabel: string, messages: LiveMessageInput[]): Promise<LiveAnalysis> {
  const transcript = messages
    .map(m => `${m.senderId.startsWith('live-employee') ? 'NHÂN VIÊN' : 'KHÁCH HÀNG'} (${m.senderName}): ${m.text}`)
    .join('\n');

  const prompt = `Bạn là hệ thống phân tích chất lượng hội thoại CSKH cho một chuỗi F&B trên nền tảng zEnterprise của GiftZone.
Phân tích đoạn hội thoại Zalo dưới đây (kịch bản: "${scenarioLabel}") và trả về DUY NHẤT một JSON object đúng schema sau, không thêm chữ nào khác, không markdown:

{
  "summary": "tóm tắt hội thoại trong 1-2 câu tiếng Việt",
  "sentiment": "positive" | "neutral" | "negative",
  "category": "Đặt hàng" | "Khiếu nại" | "Hỏi thông tin/Khuyến mãi" | "Khác",
  "quality_score": số nguyên 1-10 đánh giá chất lượng phục vụ của nhân viên,
  "has_issue": true/false — true nếu có vấn đề chất lượng dịch vụ cần đội quản lý theo dõi,
  "issue_type": null hoặc một trong ${JSON.stringify(VALID_ISSUE_TYPES)},
  "issue_severity": null hoặc "critical"|"high"|"medium"|"low",
  "issue_title": null hoặc tiêu đề ngắn gọn (dưới 80 ký tự)
}

<conversation>
${transcript}
</conversation>`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
    });
    const result = await model.generateContent(prompt);
    const raw = stripFences(result.response.text());
    const parsed = JSON.parse(raw);

    return {
      summary: String(parsed.summary ?? '').slice(0, 500) || fallbackAnalysis(messages).summary,
      sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      category: String(parsed.category ?? 'Khác'),
      quality_score: Number.isFinite(Number(parsed.quality_score))
        ? Math.max(1, Math.min(10, Math.round(Number(parsed.quality_score))))
        : 7,
      has_issue: Boolean(parsed.has_issue),
      issue_type: VALID_ISSUE_TYPES.includes(parsed.issue_type) ? parsed.issue_type : null,
      issue_severity: ['critical', 'high', 'medium', 'low'].includes(parsed.issue_severity) ? parsed.issue_severity : null,
      issue_title: parsed.issue_title ? String(parsed.issue_title).slice(0, 80) : null,
    };
  } catch {
    return fallbackAnalysis(messages);
  }
}

export async function POST(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { scenarioLabel?: string; messages?: LiveMessageInput[]; handoffOccurred?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const scenarioLabel = (body.scenarioLabel ?? 'zEnterprise Live').slice(0, 100);
  const messages = Array.isArray(body.messages) ? body.messages.filter(m => m?.text?.trim()) : [];

  if (messages.length < 2) {
    return NextResponse.json({ error: 'Cần ít nhất 2 tin nhắn để phân tích' }, { status: 400 });
  }

  const start = Date.now();
  const analysis = await analyzeWithGemini(scenarioLabel, messages);
  const latencyMs = Date.now() - start;

  const nowLabel = new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  });
  const groupId = `live-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const groupName = `${scenarioLabel}${body.handoffOccurred ? ' (có chuyển giao NV)' : ''} — ${nowLabel}`;

  await insertLiveConversation({ groupId, groupName, messages, analysis, latencyMs });

  return NextResponse.json({ groupId, analysis });
}
