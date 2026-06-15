# Spike Scripts — Zalo AI Sales Agent

Ba script kiểm tra kỹ thuật trước khi build MVP.

## Yêu cầu

- Node.js 18+
- Docker (cho pgvector)

## Setup

```bash
cd spike
cp .env.example .env
# Điền credentials vào .env
npm install
```

---

## Spike 1: zca-js Session Stability

**Trả lời:** Session expire sau bao lâu? Auto-recover có cần scan QR lại không?

```bash
npm run spike:zalo
```

**Lần đầu:** Hiển thị QR → mở Zalo app → scan → đăng nhập.  
**Lần 2:** Chạy lại ngay để test recover từ session đã lưu (không cần QR).  
**Lần 3:** Chạy sau 24h để đo thời gian expire thực tế.

Kết quả: `spike/results/zalo-spike-result.json`

---

## Spike 2: Google Drive API

**Trả lời:** Index 100–200 trang mất bao lâu? Rate limit có vấn đề không?

**Chuẩn bị:**
1. Tạo Google Cloud project → bật Drive API
2. Tạo OAuth2 credentials → lấy `client_id`, `client_secret`
3. Chạy OAuth flow để lấy `refresh_token` (xem hướng dẫn bên dưới)
4. Tạo folder Google Drive test, upload 5–10 file PDF/DOCX/XLSX mẫu
5. Lấy folder ID từ URL Drive

**Lấy refresh_token:**
```bash
# Dùng OAuth Playground: https://developers.google.com/oauthplayground
# Scope: https://www.googleapis.com/auth/drive.readonly
```

```bash
npm run spike:drive
```

Kết quả: `spike/results/drive-spike-result.json`

---

## Spike 3: pgvector Latency

**Trả lời:** Semantic search với 10,000 chunks có đủ nhanh (<500ms) không?

**Setup PostgreSQL với pgvector:**
```bash
docker run -d \
  --name giftzone-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16

docker exec -it giftzone-pg psql -U postgres -c "CREATE DATABASE giftzone_spike;"
```

```bash
npm run spike:pgvector
```

Script tự tạo bảng → insert 10k rows → benchmark → xóa bảng sau khi xong.

Kết quả: `spike/results/pgvector-spike-result.json`

---

## Đọc kết quả

Sau khi chạy cả 3 spike, xem thư mục `spike/results/`:

| File | Verdict field | Ý nghĩa |
|------|--------------|---------|
| `zalo-spike-result.json` | `summary.verdict` | GO / INVESTIGATE |
| `drive-spike-result.json` | `summary.verdict` | GO / INVESTIGATE |
| `pgvector-spike-result.json` | `summary.verdict` | GO / ACCEPTABLE |

**Quyết định build khi:** cả 3 đều GO → bắt đầu Tuần 2 (Core Agent Features).
