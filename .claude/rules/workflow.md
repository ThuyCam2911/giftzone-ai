# Workflow Rules

## Trước khi code

1. **Đọc `memory.md`** — kiểm tra xem quyết định kiến trúc đã chốt có liên quan không
2. **Không hỏi lại những gì đã chốt** — Gemini (không phải Anthropic), zca-js (không phải ZOA), port 5433
3. **Với thay đổi ảnh hưởng embedding dim**: luôn kiểm tra `db.js` (schema) và `retriever.js` (query cast) khớp với `embedder.js`

## Khi viết/sửa code

- **Không bao giờ ghi vào `.env`** — chỉ hướng dẫn user sửa tay
- **Không commit `.env`, `*.local.*`, `*.log`** — đã có trong gitignore
- **Mỗi thay đổi logic RAG**: test bằng `npm run index:drive` sau khi quota reset
- **Thay đổi Zalo listener**: test bằng @mention thật trong group test (`6598808947011857265`)

## Git workflow

```bash
git status                    # xem file nào thay đổi
git diff                      # review trước khi commit
git add <specific-files>      # KHÔNG dùng git add -A hoặc git add .
git commit -m "..."           # message ngắn, tiếng Anh hoặc tiếng Việt đều OK
```

Không push force. Không bypass hooks.

## Khi agent bị lỗi

1. **"Another connection is opened"** → Đóng `chat.zalo.me` trên browser → restart
2. **`zpw_enk null` / cookie lỗi** → Re-extract cookie → cập nhật `.env` → restart
3. **Embedding 429** → Thêm `SKIP_INDEX=true` vào `.env` → restart; chạy `npm run index:drive` sau khi quota reset
4. **DB connection refused** → Kiểm tra Docker container pgvector đang chạy port 5433

## Deploy lên server (chưa làm)

- Agent cần dedicated server — không share với services khác dùng nhiều RAM
- Một Zalo session = một process = một server/container
- Không bao giờ mở `chat.zalo.me` trên máy server
- Recommend: `pm2` để manage process, auto-restart khi crash
