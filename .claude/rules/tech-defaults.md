# Tech Defaults

## Stack mặc định — không thay đổi khi không có lý do

| Layer | Default | Lý do chọn |
|-------|---------|-----------|
| Runtime | Node.js ESM (`"type": "module"`) | Cùng ecosystem với zca-js |
| AI chat | `gemini-1.5-flash` | Free tier, tiếng Việt tốt |
| AI embedding | `gemini-embedding-001`, dim `1536` | Free tier; 1536 < HNSW limit 2000 |
| DB | PostgreSQL + pgvector, port **5433** | pgvector/pgvector:pg16 Docker |
| HNSW config | `m=16, ef_construction=64` | Đã validate với spike 10K vectors |
| Zalo | `zca-js` v1.6.0, `selfListen: false` | Duy nhất support group chat |
| Scheduler | `node-cron` | Đã integrated, không thêm dependency |
| Logger | `createLogger('Name')` từ `utils/logger.js` | Consistent format + chalk colors |

## Embedding — critical constraints

```js
// ĐÚNG
embModel.embedContent({
  content: { parts: [{ text: text.slice(0, 8000) }] },
  outputDimensionality: 1536,   // ← BẮT BUỘC, không bỏ
})

// Schema DB phải khớp
embedding vector(1536)          // ← trong CREATE TABLE

// Query pgvector phải cast đúng
ORDER BY embedding <=> $1::vector(1536)   // ← dimension phải khớp
```

Ba chỗ phải đồng bộ: `embedder.js` → `db.js` → `retriever.js`

## Rate limit Gemini free tier

- **Embedding**: Sequential 600ms delay giữa các chunks (đã có trong `embedder.js`)
- **Chat**: Không delay — `gemini-1.5-flash` free tier rộng hơn nhiều
- **429 handling**: Exponential backoff `2^attempt * 2000ms`, tối đa 5 lần

## Zalo API patterns

```js
// Gửi tin nhắn vào group
await api.sendMessage({ msg: text }, groupId, MessageType.GroupMessage)

// Detect @mention — ĐÚNG
message.data.mentions?.some(m => m.uid === ownId)

// Lấy own ID sau login
const ownId = await api.getOwnId()
```

## Database conventions

- Tất cả timestamps: `TIMESTAMPTZ` (timezone-aware)
- Group ID và User ID: `TEXT` (Zalo ID là số lớn, dùng string an toàn hơn bigint)
- JSON arrays: `JSONB` (sources trong ai_logs)
- Connection pool: singleton trong `utils/db.js` — không tạo pool mới ngoài file này

## Khi thêm tính năng mới

1. Thêm table mới vào `initSchema()` trong `utils/db.js`
2. Export function từ module riêng trong thư mục tương ứng (`zalo/`, `rag/`, `summary/`)
3. Wire vào `index.js` ở bước phù hợp trong startup sequence
4. Log đầu/cuối mỗi operation quan trọng với `log.info()`

## Dashboard (Week 3) — tech defaults

- Framework: Next.js 14+ App Router
- Styling: Tailwind CSS
- DB access: pg trực tiếp trong API routes (không thêm ORM cho MVP)
- Auth: simple session token (Manager không cần OAuth phức tạp cho MVP)
- Port: 3000 (dev), nginx proxy (production)
