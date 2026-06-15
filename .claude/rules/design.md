# Design Rules

## Nguyên tắc UX cho Agent (output trong Zalo)

- **Ngắn gọn**: Reply không quá 5-7 dòng — Zalo mobile không hiển thị tốt text dài
- **Emoji có chọn lọc**: 1-2 emoji để dễ scan, không spam emoji
- **Luôn trích dẫn nguồn**: "Theo [tên file]:" — đây là tính năng cốt lõi, không bao giờ bỏ
- **Khai báo AI**: Agent luôn là AI Assistant, không giả vờ là người
- **Tiếng Việt**: Tất cả output cho user phải là tiếng Việt, tone thân thiện nhưng chuyên nghiệp

## Format reply chuẩn

```
[Câu trả lời ngắn gọn]

📎 Nguồn: "tên-file.xlsx"
```

Nếu không có thông tin:
```
Tôi chưa có thông tin về vấn đề này trong tài liệu hiện tại.
Vui lòng liên hệ [người có thể hỗ trợ] hoặc cập nhật tài liệu vào Google Drive.
```

## Format summary ngày (chuẩn spec section 5.2)

```
📊 *DAILY SUMMARY — DD/MM/YYYY*

🔑 *Điểm chính hôm nay:*
• ...

💬 *Câu hỏi Sales đã hỏi Agent:*
• ...

✅ *Việc cần follow-up:*
• ...

😊 *Sentiment chung:* tích cực/trung tính/cần chú ý
```

## Dashboard (Week 3 — Next.js)

- **Audience**: Manager, không phải Sale hay khách hàng
- **Màn hình chính** (theo spec section 5.3):
  1. Tổng quan: group count, deal stage funnel, alerts
  2. Danh sách Groups: filter by sale/stage/time
  3. Chi tiết Group: summary history + AI log
  4. Analytics: top questions, doc usage
  5. Quản lý Sale: assign/reassign
  6. Cài đặt: Drive folder, cron schedule, agent config
- **Stack**: Next.js App Router, không thêm UI lib phức tạp — Tailwind đủ cho MVP
- **Data source**: Đọc trực tiếp từ PostgreSQL qua API routes — không cần thêm layer

## Mô hình dữ liệu — Deal stages

Chưa được spec hóa rõ ràng; khi implement Dashboard cần confirm với PO:
- Gợi ý: `Mới` → `Đang tư vấn` → `Thương lượng` → `Chờ chốt` → `Đã chốt` → `Thất bại`
- Có thể detect tự động từ conversation bằng Gemini, hoặc Manager set tay trên Dashboard
