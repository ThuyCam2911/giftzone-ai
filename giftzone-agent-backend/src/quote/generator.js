/**
 * Sinh file báo giá (.docx) từ bảng product_prices — không gọi AI, tính toán
 * và điền số liệu hoàn toàn bằng code nên không tốn token và không có rủi ro
 * AI tính sai tiền.
 *
 * Dùng .docx (không phải .pdf) vì text lưu dạng Unicode trong XML — hiển thị
 * tiếng Việt đúng ngay cả trên container không cài font, không cần embed font
 * riêng như PDF (PDFKit font mặc định không có dấu tiếng Việt).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, TableLayoutType,
} from 'docx';
import { query } from '../utils/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('QuoteGenerator');

// ─── Tra cứu sản phẩm/giá ─────────────────────────────────────────────────────
export async function listDistinctProducts() {
  const { rows } = await query(
    `SELECT DISTINCT product_name FROM product_prices WHERE active ORDER BY product_name`
  );
  return rows.map(r => r.product_name);
}

export async function getPriceRows(productName) {
  const { rows } = await query(
    `SELECT product_name, unit, unit_price FROM product_prices
     WHERE product_name = $1 AND active ORDER BY unit_price ASC`,
    [productName]
  );
  return rows;
}

// Khớp tên sản phẩm nhắc tới trong câu hỏi — so khớp theo từ đầu tiên của tên
// SP (mã sản phẩm, vd "Confidor", "Anvil" — không dấu nên so khớp trực tiếp
// không cần chuẩn hoá tiếng Việt)
export async function matchProduct(text) {
  const q = (text ?? '').toLowerCase();
  const products = await listDistinctProducts();
  return products.filter(p => q.includes(p.split(' ')[0].toLowerCase()));
}

// Lấy phần "kích cỡ" trong 1 chuỗi quy cách, vd "chai 500ml" → "500ml",
// "can 1 lít" → "1lít" (bỏ khoảng trắng để so khớp khoan dung hơn)
function sizeToken(unit) {
  const m = (unit ?? '').match(/[\d.,]+\s*(ml|lít|kg|g)\b/i);
  return m ? m[0].replace(/\s+/g, '').toLowerCase() : null;
}

// Khớp số lượng + đúng quy cách (unit) trong 1 câu trả lời của Sales, dựa vào
// danh sách unit thật của sản phẩm đó (bot đã liệt kê khi hỏi lại trước đó).
// Ưu tiên khớp nguyên văn quy cách; nếu không có (vd Sales gõ "chai 1 lít"
// nhưng quy cách thật là "can 1 lít" — sai từ chỉ loại bao bì) thì fallback
// khớp theo riêng phần kích cỡ (500ml/1kg/1 lít...), khoan dung hơn với cách
// Sales gõ tắt/nhầm từ bao bì.
export function extractQuantityAndUnit(text, priceRows) {
  const qtyMatch = (text ?? '').match(/(\d+)/);
  if (!qtyMatch) return null;
  const qty = Number(qtyMatch[1]);
  const q = text.toLowerCase();

  let row = priceRows.find(r => q.includes(r.unit.toLowerCase()));
  if (!row) {
    const textNoSpace = q.replace(/\s+/g, '');
    row = priceRows.find(r => {
      const size = sizeToken(r.unit);
      return size && textNoSpace.includes(size);
    });
  }
  if (!row) return null;
  return { qty, row };
}

function money(n) {
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

// ─── Build .docx báo giá ──────────────────────────────────────────────────────
// items: [{ product_name, unit, unit_price, qty }]
export async function buildQuoteDocx({ items, requesterName }) {
  const rows = items.map(it => ({ ...it, line_total: it.unit_price * it.qty }));
  const grandTotal = rows.reduce((s, r) => s + r.line_total, 0);
  const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // Độ rộng cột cố định (đơn vị DXA, 1440 = 1 inch) — BẮT BUỘC phải khai báo cả
  // ở Table.columnWidths lẫn từng TableCell.width, nếu không 1 số app xem docx
  // (đặc biệt trên mobile) sẽ không tự autofit mà co mỗi cột về gần như 0, làm
  // chữ bị vỡ dòng từng ký tự một (lỗi đã gặp khi thiếu width)
  const COL_WIDTHS = [3200, 2000, 900, 1600, 1700]; // Sản phẩm, Quy cách, SL, Đơn giá, Thành tiền
  const headerCell = (text, i) => new TableCell({
    width: { size: COL_WIDTHS[i], type: WidthType.DXA },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
  });
  const cell = (text, i, alignment) => new TableCell({
    width: { size: COL_WIDTHS[i], type: WidthType.DXA },
    children: [new Paragraph({ text, alignment })],
  });

  const table = new Table({
    width: { size: COL_WIDTHS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          headerCell('Sản phẩm', 0), headerCell('Quy cách', 1), headerCell('SL', 2),
          headerCell('Đơn giá', 3), headerCell('Thành tiền', 4),
        ],
      }),
      ...rows.map(r => new TableRow({
        children: [
          cell(r.product_name, 0),
          cell(r.unit, 1),
          cell(String(r.qty), 2, AlignmentType.CENTER),
          cell(money(r.unit_price), 3, AlignmentType.RIGHT),
          cell(money(r.line_total), 4, AlignmentType.RIGHT),
        ],
      })),
    ],
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'BÁO GIÁ SẢN PHẨM', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `Ngày: ${today}` }),
        new Paragraph({ text: requesterName ? `Người yêu cầu: ${requesterName}` : '' }),
        new Paragraph({ text: '' }),
        table,
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [new TextRun({ text: `TỔNG CỘNG: ${money(grandTotal)}`, bold: true, size: 28 })],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [new TextRun({
            text: '⚠️ Báo giá demo do AI tạo tự động — vui lòng đối chiếu bảng giá thật trước khi gửi khách.',
            italics: true,
          })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filePath = path.join(os.tmpdir(), `bao-gia-${Date.now()}.docx`);
  fs.writeFileSync(filePath, buffer);
  log.info(`Đã tạo file báo giá: ${filePath} (tổng ${money(grandTotal)})`);
  return { filePath, grandTotal };
}
