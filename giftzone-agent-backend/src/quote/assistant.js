/**
 * Quote Assistant — Sales @mention hỏi "báo giá" → nếu thiếu số lượng/quy cách
 * thì hỏi lại, đủ thông tin thì tự tính tiền + xuất file .docx gửi thẳng cho
 * Sales (không gửi vào nhóm khách — xem eligibility ở responder.js).
 *
 * State "đang chờ trả lời số lượng" lưu ở bảng pending_quotes (không phải in-memory)
 * để không mất khi process restart, hết hạn sau PENDING_TTL_MS không trả lời.
 */
import { query } from '../utils/db.js';
import { matchProduct, getPriceRows, extractQuantityAndUnit, buildQuoteDocx } from './generator.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('QuoteAssistant');
const PENDING_TTL_MS = 15 * 60 * 1000;

const QUOTE_KEYWORDS = ['báo giá', 'giá bao nhiêu', 'giá sao', 'bao nhiêu tiền', 'cho giá', 'giá cả', 'giá thế nào'];

export function isQuoteRequest(text) {
  const q = (text ?? '').toLowerCase();
  return QUOTE_KEYWORDS.some(k => q.includes(k));
}

async function getPending(senderUid) {
  const { rows } = await query(
    `SELECT product_name, group_id FROM pending_quotes
     WHERE sender_uid = $1 AND updated_at >= NOW() - INTERVAL '${PENDING_TTL_MS / 60000} minutes'`,
    [senderUid]
  );
  return rows[0] ?? null;
}

async function savePending(senderUid, groupId, productName) {
  await query(
    `INSERT INTO pending_quotes (sender_uid, group_id, product_name, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (sender_uid) DO UPDATE SET group_id = $2, product_name = $3, updated_at = NOW()`,
    [senderUid, groupId, productName]
  );
}

async function clearPending(senderUid) {
  await query(`DELETE FROM pending_quotes WHERE sender_uid = $1`, [senderUid]);
}

function askQuantityText(productName, priceRows) {
  const options = priceRows.map(r => `- ${r.unit}: ${Math.round(r.unit_price).toLocaleString('vi-VN')}đ`).join('\n');
  return `Bạn cần báo giá ${productName} — số lượng bao nhiêu và quy cách nào ạ?\n\n${options}\n\nTrả lời theo mẫu: "<số lượng> <quy cách>", vd "20 ${priceRows[0].unit}"`;
}

async function finalizeQuote(productName, row, qty, requesterName) {
  const { filePath, grandTotal } = await buildQuoteDocx({
    items: [{ product_name: productName, unit: row.unit, unit_price: Number(row.unit_price), qty }],
    requesterName,
  });
  return {
    caption: `📄 Báo giá ${qty} ${row.unit} ${productName} — tổng ${Math.round(grandTotal).toLocaleString('vi-VN')}đ`,
    filePath,
  };
}

/**
 * @returns {Promise<{handled: boolean, answer?: string, filePath?: string}>}
 *   handled=false → không phải yêu cầu báo giá, caller fallback bình thường
 */
export async function handleQuoteRequest(userQuery, { senderUid, groupId, senderName }) {
  // 1. Đang chờ Sales trả lời số lượng/quy cách cho 1 sản phẩm cụ thể
  const pending = await getPending(senderUid);
  if (pending) {
    const priceRows = await getPriceRows(pending.product_name);
    const found = extractQuantityAndUnit(userQuery, priceRows);
    if (found) {
      await clearPending(senderUid);
      const { caption, filePath } = await finalizeQuote(pending.product_name, found.row, found.qty, senderName);
      return { handled: true, answer: caption, filePath };
    }
    // Chưa parse được — nếu tin nhắn này không liên quan gì tới báo giá nữa thì bỏ qua pending (không chặn câu hỏi khác)
    if (!isQuoteRequest(userQuery) && !/\d/.test(userQuery)) {
      return { handled: false };
    }
    return { handled: true, answer: askQuantityText(pending.product_name, priceRows) };
  }

  // 2. Yêu cầu báo giá mới
  if (!isQuoteRequest(userQuery)) return { handled: false };

  const products = await matchProduct(userQuery);
  if (products.length === 0) {
    return {
      handled: true,
      answer: 'Bạn cần báo giá sản phẩm nào ạ? (vd: Confidor 100SL, Anvil 5SC, Sofit 300EC...)',
    };
  }
  if (products.length > 1) {
    return {
      handled: true,
      answer: `Bạn muốn báo giá sản phẩm nào trong số này: ${products.join(', ')}?`,
    };
  }

  const productName = products[0];
  const priceRows = await getPriceRows(productName);
  if (priceRows.length === 0) {
    return { handled: true, answer: `Chưa có bảng giá cho ${productName}, bạn liên hệ Manager để cập nhật giúp mình nhé.` };
  }

  // Sales có thể hỏi đủ luôn trong 1 câu (vd "báo giá 20 chai 100ml Confidor 100SL")
  const found = extractQuantityAndUnit(userQuery, priceRows);
  if (found) {
    const { caption, filePath } = await finalizeQuote(productName, found.row, found.qty, senderName);
    return { handled: true, answer: caption, filePath };
  }

  await savePending(senderUid, groupId, productName);
  return { handled: true, answer: askQuantityText(productName, priceRows) };
}
