# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Agent (production code)
```bash
cd agent
npm install
npm run dev          # run with --watch (auto-restart on file change)
npm start            # run normally
npm run index:drive  # index Google Drive documents into pgvector (run after quota resets)
```

Set `SKIP_INDEX=true` in `.env` to skip Drive indexing on startup (useful when Gemini embedding quota is exhausted).

### Spike (proof-of-concept scripts)
```bash
cd spike
npm run auth:drive   # OAuth2 flow — get Google refresh_token, writes to .env automatically
node zalo/mention-test.js    # test @mention detection in live Zalo group
node pgvector/pgvector-spike.js
```

### Infrastructure
```bash
# pgvector runs on port 5433 (5432 was busy)
docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16
```

## Project Status (cập nhật 2026-06-15)

### Đã hoàn thành
- **Agent core**: RAG pipeline hoàn chỉnh — Drive indexing, pgvector search, Gemini chat
- **Agent reply UX**: Bỏ "🤔 Đang tìm thông tin..." thinking message; bỏ source citations ("Theo [1]", "Nguồn:...") khỏi reply
- **DB-backed config**: Bảng `settings` là source of truth; `utils/config.js` cung cấp `getConfig/setConfig` với in-memory cache
- **Zalo session health**: `session.js` ghi `session_status` và `session_last_seen` vào `settings` sau login và health-check
- **Dashboard MVP** (`/dashboard`): Next.js 14 App Router, port 3001
  - Auth: password → `gz_session` cookie (base64 token)
  - Overview page: 4 StatsCard + SessionAlert banner
  - AI Logs page: bảng paginated với filter theo date/group
  - Settings page: form edit tất cả config keys (trừ read-only), textarea cho zalo_cookie

### Trạng thái từng phần

| Phần | Trạng thái | Ghi chú |
|------|-----------|---------|
| Agent RAG | ✅ Production | Model: `gemini-2.5-flash-lite`, dim 1536 |
| Agent reply format | ✅ Đã fix | Không thinking msg, không source citation |
| Agent summary engine | ✅ Hoạt động | Cron 18:00 T2-T6, `gemini-1.5-flash` |
| Dashboard auth | ✅ Hoạt động | Simple password, cookie-based |
| Dashboard overview | ✅ Hoạt động | Đọc stats từ DB |
| Dashboard logs | ✅ Hoạt động | Paginated, filter date/group |
| Dashboard settings | ✅ Hoạt động | Edit config + paste zalo_cookie |
| Deploy lên server | ❌ Chưa làm | Xem phần Deploy bên dưới |

### Bước tiếp theo
1. **Test end-to-end**: @mention trong group thật → verify reply không còn "Theo [1]"
2. **Deploy**: Cần server riêng cho agent (zca-js không share process), nginx proxy cho dashboard
3. **Deal stage tracking**: Chưa spec hóa — cần confirm với PO trước khi implement
4. **Analytics page** (màn hình 4 trong spec): top questions, doc usage — chưa làm

### Quyết định quan trọng đã chốt
- **Không có thinking message**: UX tốt hơn trên Zalo mobile; latency Gemini đủ nhanh không cần placeholder
- **Không trích dẫn nguồn trong reply**: Bỏ cả suffix trong `responder.js` lẫn instruction trong `retriever.js` SYSTEM_PROMPT — reply sạch hơn, tập trung vào câu trả lời
- **Chat model**: Đã nâng từ `gemini-1.5-flash` → `gemini-2.5-flash-lite` (nhanh hơn, miễn phí)
- **Config qua DB**: `settings` table thay vì `.env` để Dashboard có thể cập nhật không cần restart agent (trừ zalo_cookie vẫn cần restart)
- **Dashboard port 3001**: Tránh conflict với các service khác trên port 3000

---

## Architecture

Monorepo với ba packages:
- `/agent` — production agent (Node.js ESM, `"type": "module"`)
- `/dashboard` — Next.js 14 App Router, quản lý agent qua UI
- `/spike` — throwaway validation scripts

### Agent startup sequence (`src/index.js`)
1. `initSchema()` — creates pgvector tables/HNSW index if not exist
2. `SessionManager.login()` — Zalo login via zca-js
3. `indexAll()` — indexes Google Drive docs into pgvector (runs in background, non-blocking); skipped if `SKIP_INDEX=true`
4. `GroupListener` + `MentionResponder` — Zalo WebSocket listener
5. `startSummaryEngine()` + `startAutoSync()` — cron jobs

### Key modules
- **`src/zalo/session.js`** — `SessionManager`: wraps zca-js login, health-checks every 30min via `getOwnId()`, calls `onExpired` → `process.exit(1)` when session dies
- **`src/zalo/listener.js`** — `GroupListener`: filters `MessageType.GroupMessage`, detects @mention via `message.data.mentions[].uid === ownId` (NOT content string), strips @mention tokens from query text by pos/len offsets
- **`src/zalo/responder.js`** — `MentionResponder`: calls `answer()` trực tiếp (không có thinking message, không source citation suffix), logs to `ai_logs` table
- **`src/rag/embedder.js`** — Gemini `gemini-embedding-001`, `outputDimensionality: 1536` (default 3072 exceeds HNSW 2000-dim limit), exponential backoff on 429
- **`src/rag/indexer.js`** — fetches Drive folder/file, exports Google-native files to CSV/text, chunks (600 words, 60 overlap), embeds sequentially with **600ms delay between chunks** (critical for free-tier rate limit), upserts to `doc_chunks`; polls Drive Changes API every 15min for auto-sync
- **`src/rag/retriever.js`** — embeds query, cosine similarity search (`<=>`) top-5 chunks, builds Gemini prompt with context, returns answer + source file names
- **`src/summary/engine.js`** — cron: daily 18:00 Mon–Fri, weekly Fri 17:00; queries `messages` table per group, generates Vietnamese summary via `gemini-1.5-flash`
- **`src/utils/db.js`** — pg Pool on `PG_PORT` (default 5433); `initSchema()` creates `doc_chunks`, `ai_logs`, `messages`, `settings` tables
- **`src/utils/config.js`** — `getConfig(key, default)` / `setConfig(key, value)`: đọc/ghi bảng `settings` với in-memory cache; agent đọc config từ đây thay vì `.env` trực tiếp
- **`src/utils/logger.js`** — `createLogger('Name')`: chalk-colored logger, respects `LOG_LEVEL` env var (debug/info/warn/error)

### Database schema (pgvector)
- `doc_chunks(file_id, file_name, chunk_index, content, embedding vector(1536))` — HNSW index `m=16, ef_construction=64`
- `ai_logs(group_id, sender_uid, query, answer, sources JSONB, latency_ms)`
- `messages(group_id, sender_uid, sender_name, content, msg_ts)`

### Zalo session constraints
- **ONE web connection at a time** — browser must NOT have `chat.zalo.me` open while agent runs
- Cookie expires periodically; re-extract from `chat.zalo.me` → update `ZALO_COOKIE` in `.env` → restart
- `selfListen: false` in production (prevents echo loop)
- Cookie format: J2TEAM array `[{name,value,...}]` — `parseCookie()` handles both array and object formats

### AI stack (all free-tier)
- **Chat (RAG reply)**: `gemini-2.5-flash-lite` via `@google/generative-ai`
- **Summary**: `gemini-1.5-flash`
- **Embeddings**: `gemini-embedding-001`, `outputDimensionality: 1536`
- Gemini free tier has daily embedding quota — resets ~7:00 AM Vietnam time; if exhausted use `SKIP_INDEX=true` and run `npm run index:drive` after reset

### Dashboard (`/dashboard`)
```bash
cd dashboard
npm install
npm run dev   # port 3001
```

ENV file: `dashboard/.env.local`
```
DASHBOARD_PASSWORD=...
SESSION_SECRET=...
PG_HOST=localhost
PG_PORT=5433
PG_DATABASE=giftzone_agent
PG_USER=postgres
PG_PASSWORD=postgres
```

- Auth: `POST /api/auth` → cookie `gz_session`; `middleware.ts` bảo vệ tất cả routes trừ `/login`
- Token: `Buffer.from(password + secret).toString('base64')` — không cần JWT
- `lib/db.ts` — pg Pool riêng, KHÔNG import từ agent (tránh ESM/CJS conflict)

### Known bugs fixed
- `indexer.js`: 600ms inter-chunk delay must be in the `indexFile()` loop, NOT assumed to be inside `embed()` — missing delay was root cause of quota exhaustion
- `indexer.js`: guard `process.argv[1]?.endsWith()` — was crashing when imported as module
- `listener.js`: local `userQuery` var (was named `query`, shadowing the db import)
- `responder.js`: đã bỏ thinking message và source citation suffix — reply đến thẳng từ `answer()`
- `retriever.js` SYSTEM_PROMPT: đã bỏ "Luôn trích dẫn nguồn" và thêm "KHÔNG trích dẫn nguồn hay số thứ tự" — ngăn Gemini tự thêm "Theo [1]" trong reply

### Environment variables (agent/.env)
```
ZALO_IMEI, ZALO_COOKIE, ZALO_USER_AGENT
ZALO_TEST_GROUP_ID
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
DRIVE_FOLDER_ID          # can be a folder OR a single file ID
PG_HOST, PG_PORT=5433, PG_DATABASE, PG_USER, PG_PASSWORD
GEMINI_API_KEY
AGENT_NAME=GiftZone AI
SUMMARY_CRON             # default: "0 18 * * 1-5"
SKIP_INDEX               # set "true" to skip Drive indexing at startup
LOG_LEVEL                # default: "info" (options: debug/info/warn/error)
```

⚠️ `agent/.env` and `spike/.env` contain live Zalo session cookies — never commit.
