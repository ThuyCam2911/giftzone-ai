import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isAuthenticated } from '@/lib/auth';
import {
  getQuote, addMessage, updateQuoteItems, listCatalogPrices, type QuoteItem,
} from '@/lib/queries/quote-negotiations';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function stripFences(text: string): string {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
}

interface AiTurnResult { items: QuoteItem[]; reply: string }

// Sales gõ 1 câu chỉ đạo tự nhiên (vd "giảm 5% cho Rầy Diệt", "bớt 2 chai Sâu
// Cuốn Lá xuống còn 3 chai") → Gemini đọc bảng giá thật + items hiện tại, trả
// về items mới + 1 câu trả lời ngắn xác nhận lại cho Sales — dùng đúng pattern
// GoogleGenerativeAI + JSON-schema-prompt + stripFences đã có ở
// app/api/zenterprise/live/analyze/route.ts để giữ nhất quán trong admin.
async function runNegotiationTurn(
  instruction: string,
  currentItems: QuoteItem[],
  catalog: { product_name: string; unit: string; unit_price: number }[],
): Promise<AiTurnResult> {
  const catalogText = catalog.map(c => `${c.product_name} — ${c.unit}: ${Math.round(c.unit_price).toLocaleString('vi-VN')}đ`).join('\n');
  const itemsText = currentItems.map(it => `${it.qty} ${it.unit} ${it.product_name} @ ${Math.round(it.unit_price).toLocaleString('vi-VN')}đ`).join('\n') || '(chưa có dòng nào)';

  const prompt = `Bạn là trợ lý soạn báo giá nội bộ cho nhân viên Sales của GiftZone (nông dược). Sales sẽ chỉ đạo điều chỉnh báo giá bằng tiếng Việt tự nhiên (vd "giảm 5% cho SP A", "đổi Rầy Diệt sang chai 100g", "bớt số lượng xuống 2").

Bảng giá CHUẨN (chỉ được dùng đơn giá/quy cách có trong danh sách này, không tự bịa):
${catalogText}

Báo giá hiện tại:
${itemsText}

Chỉ đạo của Sales: "${instruction}"

Áp dụng chỉ đạo, trả về DUY NHẤT 1 JSON object đúng schema sau, không markdown, không chữ nào khác:
{
  "items": [{"product_name":"...","unit":"...","unit_price":số,"qty":số}],
  "reply": "1 câu ngắn tiếng Việt xác nhận lại thay đổi cho Sales, dưới 30 từ"
}
Nếu chỉ đạo không rõ ràng hoặc không áp dụng được, giữ nguyên "items" như cũ và "reply" hỏi lại Sales cho rõ.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
    });
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(stripFences(result.response.text()));
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((it: any) => it?.product_name && it?.unit && Number.isFinite(Number(it.unit_price)) && Number.isFinite(Number(it.qty)))
          .map((it: any) => ({
            product_name: String(it.product_name),
            unit: String(it.unit),
            unit_price: Number(it.unit_price),
            qty: Number(it.qty),
          }))
      : currentItems;
    const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'Dạ em đã cập nhật báo giá ạ.';
    return { items, reply };
  } catch {
    return { items: currentItems, reply: 'Dạ em chưa hiểu rõ yêu cầu, anh/chị nói lại cụ thể hơn giúp em nhé (vd "giảm 5% cho <tên SP>").' };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const quote = await getQuote(id);
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await addMessage(id, 'sales', text);

  const catalog = await listCatalogPrices();
  const { items, reply } = await runNegotiationTurn(text, quote.items, catalog);

  await updateQuoteItems(id, items);
  await addMessage(id, 'ai', reply, items);

  return NextResponse.json({ ok: true, items, reply });
}
