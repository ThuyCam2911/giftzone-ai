/**
 * Quote Negotiation — luồng khách hàng hỏi báo giá chính thức (demo showoff,
 * nhánh ai-for-demo). KHÁC với quote/assistant.js (Sales tự hỏi giá cho bản
 * thân, trả lời ngay qua Zalo): ở đây khách hỏi, AI báo "đợi chút", rồi đưa đề
 * xuất báo giá cho Sales DUYỆT TRÊN DASHBOARD (không qua Zalo) trước khi AI
 * gửi báo giá cuối cùng lại cho khách.
 *
 * Dùng chung `product_prices`/matchProduct/getPriceRows với quote/assistant.js
 * để giá khách nghe trong chat và giá Sales thấy trên Dashboard luôn khớp nhau.
 */
import { generateText } from '../utils/claude.js';
import { query } from '../utils/db.js';
import { matchProduct, getPriceRows, extractQuantityAndUnit, listDistinctProducts } from './generator.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('QuoteNegotiation');

const QUOTE_KEYWORDS = [
  'báo giá', 'giá bao nhiêu', 'giá sao', 'bao nhiêu tiền', 'cho giá', 'giá cả',
  'giá thế nào', 'giá sỉ', 'lấy giá', 'chốt giá', 'gửi báo giá', 'xin báo giá',
  'cho mình xin giá', 'cho em xin giá', 'mua thì giá', 'đặt hàng thì giá', 'đặt mua',
];

// Khách gõ trên điện thoại rất hay đặt sai vị trí dấu (vd "gía" thay vì "giá",
// "trưf" thay vì "trừ") — so khớp CÓ dấu chính xác sẽ trượt hầu hết các câu
// gõ vội. Bỏ hết dấu (NFD + xoá combining marks, đ/Đ → d/D) trước khi so khớp
// để chấp nhận sai vị trí dấu, chỉ cần đúng các chữ cái.
function stripDiacritics(str) {
  return (str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const QUOTE_KEYWORDS_NORMALIZED = QUOTE_KEYWORDS.map(k => stripDiacritics(k.toLowerCase()));

export function isFormalQuoteIntent(text) {
  const q = stripDiacritics((text ?? '').toLowerCase());
  return QUOTE_KEYWORDS_NORMALIZED.some(k => q.includes(k));
}

// Tách câu thành từng đoạn — mỗi đoạn thường ứng với 1 sản phẩm (giống quote/assistant.js)
const SEGMENT_SPLIT_RE = /\n|,|;|\s+và\s+|\+/i;
function splitSegments(text) {
  return (text ?? '').split(SEGMENT_SPLIT_RE).map(s => s.trim()).filter(Boolean);
}

// Khác quote/assistant.js: không có bước "hỏi lại chờ trả lời" — nếu khách không
// nói rõ số lượng/quy cách, tự lấy quy cách rẻ nhất + số lượng 1 làm bản nháp,
// Sales tự điều chỉnh trên Dashboard thay vì bot hỏi lại khách nhiều vòng.
async function extractItemsFromText(text) {
  const items = [];
  const seen = new Set();
  for (const seg of splitSegments(text)) {
    const matches = await matchProduct(seg);
    if (matches.length !== 1) continue;
    const productName = matches[0];
    if (seen.has(productName)) continue;
    seen.add(productName);

    const priceRows = await getPriceRows(productName);
    if (priceRows.length === 0) continue;

    const found = extractQuantityAndUnit(seg, priceRows);
    if (found) {
      items.push({ product_name: productName, unit: found.row.unit, unit_price: Number(found.row.unit_price), qty: found.qty });
    } else {
      items.push({ product_name: productName, unit: priceRows[0].unit, unit_price: Number(priceRows[0].unit_price), qty: 1 });
    }
  }
  return items;
}

function stripFences(text) {
  return (text ?? '').replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
}

// Fallback khi không match được sản phẩm nào theo tên trực tiếp (vd khách hỏi
// theo công dụng "thuốc trị đạo ôn" thay vì tên sản phẩm) — nhờ Claude đọc bảng
// giá + bối cảnh hội thoại để đề xuất 1 bản nháp hợp lý
async function draftItemsWithAI(rawQuery, contextSummary) {
  const products = await listDistinctProducts();
  const catalogLines = [];
  for (const p of products) {
    const rows = await getPriceRows(p);
    catalogLines.push(`${p}: ${rows.map(r => `${r.unit} ${Math.round(r.unit_price).toLocaleString('vi-VN')}đ`).join(', ')}`);
  }

  const prompt = `Dựa vào bảng giá sản phẩm nông dược dưới đây và yêu cầu báo giá của khách, đề xuất danh sách sản phẩm/số lượng hợp lý nhất. Nếu khách không nói rõ số lượng, đề xuất số lượng 1 ở quy cách rẻ nhất.

Bảng giá:
${catalogLines.join('\n')}

Bối cảnh hội thoại trước đó: ${contextSummary || '(không có)'}
Yêu cầu của khách: "${rawQuery}"

Trả về DUY NHẤT 1 JSON array, không markdown, không chữ nào khác:
[{"product_name":"...","unit":"...","unit_price":số,"qty":số}]
Nếu không xác định được sản phẩm nào phù hợp, trả về [].`;

  try {
    const raw = await generateText(prompt, { temperature: 0.2, maxTokens: 400 });
    const parsed = JSON.parse(stripFences(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(it => it && it.product_name && it.unit && Number.isFinite(Number(it.unit_price)) && Number.isFinite(Number(it.qty)))
      .map(it => ({ product_name: String(it.product_name), unit: String(it.unit), unit_price: Number(it.unit_price), qty: Number(it.qty) }));
  } catch (err) {
    log.warn('Draft items bằng AI lỗi — trả về rỗng, Sales tự nhập tay trên Dashboard:', err.message);
    return [];
  }
}

function money(n) {
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

/**
 * Bắt đầu 1 phiên báo giá cần Sales duyệt — ghi vào quote_negotiations +
 * message mở đầu cho Sales trong quote_negotiation_messages (KHÔNG gửi qua Zalo,
 * chỉ hiện trên Dashboard — xem CLAUDE.md/plan cho lý do).
 * @returns {Promise<number>} id của quote_negotiations vừa tạo
 */
export async function startNegotiation({ customerUid, customerName, rawQuery, contextSummary }) {
  let items = await extractItemsFromText(rawQuery);
  if (items.length === 0 && contextSummary) {
    items = await extractItemsFromText(contextSummary);
  }
  if (items.length === 0) {
    items = await draftItemsWithAI(rawQuery, contextSummary);
  }

  const total = items.reduce((s, it) => s + it.unit_price * it.qty, 0);
  const aiNote = `Khách "${customerName || customerUid}" hỏi: "${rawQuery}"`;

  const { rows } = await query(
    `INSERT INTO quote_negotiations (customer_uid, customer_name, items, total, ai_note)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [customerUid, customerName ?? null, JSON.stringify(items), total, aiNote]
  );
  const quoteId = rows[0].id;

  const openingMsg = items.length > 0
    ? `Khách hỏi báo giá. Đề xuất:\n${items.map(i => `- ${i.qty} ${i.unit} ${i.product_name} — ${money(i.unit_price * i.qty)}`).join('\n')}\nTổng: ${money(total)}\n\nDuyệt giúp em nhé, hoặc nhắn điều chỉnh (vd "giảm 5% cho SP A").`
    : `Khách hỏi báo giá nhưng em chưa rõ sản phẩm/số lượng từ câu: "${rawQuery}". Anh/chị xem giúp em, tự thêm sản phẩm trên Dashboard nhé.`;

  await query(
    `INSERT INTO quote_negotiation_messages (quote_id, sender, text, items_snapshot) VALUES ($1, 'ai', $2, $3)`,
    [quoteId, openingMsg, JSON.stringify(items)]
  );

  log.info(`Bắt đầu phiên báo giá #${quoteId} cho khách ${customerUid} — ${items.length} dòng, tổng ${money(total)}`);
  return quoteId;
}
