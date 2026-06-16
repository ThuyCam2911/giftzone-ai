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
# Local dev: pgvector runs on port 5433 (5432 was busy)
docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16

# Production: Supabase (pgvector built-in, free tier)
# Enable extension: SQL Editor → CREATE EXTENSION IF NOT EXISTS vector;
# Connection: Settings → Database → Session pooler (port 5432)
# User format: postgres.[PROJECT_REF] (required for pooler tenant routing)
```

## Project Status (cập nhật 2026-06-16)

### Đã hoàn thành
- **Agent core**: RAG pipeline hoàn chỉnh — Drive indexing, pgvector search, Gemini chat
- **Agent reply UX**: Không thinking message, không source citation trong reply
- **Chat 1:1 Zalo**: `listener.js` xử lý `MessageType.DirectMessage` — Sales nhắn thẳng cho agent không cần @mention
- **DB-backed config**: Bảng `settings` là source of truth; `utils/config.js` cung cấp `getConfig/setConfig`
- **Zalo session health**: `session.js` ghi `session_status` và `session_last_seen` vào `settings`
- **Cookie auto-refresh**: `cookie-extractor.js` đọc Chrome SQLite + decrypt AES-128-CBC, cron 3:00 AM hàng ngày; `better-sqlite3` là optional dep (không crash trên server)
- **Dashboard** (`/dashboard`): Next.js 14 App Router — deploy tại `giftzone-ai.vercel.app`
  - Auth: password → `gz_session` cookie
  - Overview: 4 KPI cards + bar chart 7 ngày + health panel + top questions + recent queries; `force-dynamic` để luôn fetch data mới
  - AI Logs: bảng paginated, filter date/group
  - Knowledge Base: danh sách file đã index + chat RAG trực tiếp + stats (top questions, unanswered, doc usage)
  - Settings: edit config keys + textarea zalo_cookie
  - Design: brand colors `#02AD64` (xanh) + `#FF6900` (cam), sidebar gradient, card shadows, pulse animation
- **Database**: Supabase (pgvector built-in, free tier); Session Pooler port 5432
- **2 Render services**: `giftzone-ai` (Sales AI, account 1) + `giftzone-deal-monitor` (Deal Monitor, account 2)
- **Deal Analyzer**: cron 15 phút, OpenRouter `meta-llama/llama-3.3-70b-instruct:free`, detect deal stage từ messages
- **`SKIP_ZALO` env var**: khi `true` bỏ qua toàn bộ Zalo login/listener — dùng cho deal-monitor nếu không cần Zalo connection

### Trạng thái từng phần

| Phần | Trạng thái | Ghi chú |
|------|-----------|---------|
| Agent RAG | ✅ Production | Model: `gemini-2.5-flash-lite`, dim 1536 |
| Agent reply format | ✅ | Không thinking msg, không source citation |
| Chat 1:1 Zalo | ✅ Code | `MessageType.DirectMessage`, không cần @mention |
| Chat group @mention | ✅ Code | Vẫn cần @mention trong group |
| Agent summary engine | ✅ | Cron 18:00 T2-T6, `gemini-1.5-flash` |
| Cookie auto-refresh | ✅ | Cron 3AM, đọc Chrome SQLite; chỉ chạy trên máy local có Chrome |
| Deal Analyzer | ✅ Code | Cron 15 phút, llama-3.3-70b, lưu vào `deals` table |
| Agent deploy giftzone-ai | ❌ Broken | Cookie mới update từ local VN không dùng được từ Render US — cần revert cookie cũ |
| Agent deploy giftzone-deal-monitor | ❌ Broken | Cùng vấn đề cookie IP; SKIP_ZALO=true tạm thời fix được deal analyzer nhưng không nghe Zalo |
| Dashboard auth | ✅ | Simple password, cookie-based |
| Dashboard overview | ✅ | Chart 7 ngày, health, top questions, force-dynamic |
| Dashboard logs | ✅ | Paginated, filter date/group |
| Dashboard knowledge base | ✅ | File list + RAG chat + stats |
| Dashboard settings | ✅ | Edit config + zalo_cookie |
| Database | ✅ Supabase | pgvector enabled, schema sẵn sàng |
| Dashboard deploy | ✅ Vercel | `giftzone-ai.vercel.app` |
| Analytics page (spec §5.3) | ⏳ Chưa làm | Top questions đã có trong Overview/KB; full analytics page chưa |
| Deal stage tracking UI | ⏳ Chưa làm | Analyzer có nhưng chưa có UI trên Dashboard |

### Bước tiếp theo
1. **Fix giftzone-ai** — revert `ZALO_COOKIE` về giá trị cũ (trước khi update hôm nay). Cookie cũ đã được Zalo trust từ US IP. IMEI không thay đổi thì không cần revert.
2. **Fix giftzone-deal-monitor Zalo** — session mới tạo từ local VN bị reject từ Render US. Giải pháp: dùng `SKIP_ZALO=true` + deal analyzer chạy trên data từ giftzone-ai (nếu cùng DB), HOẶC migrate sang server Vietnam/Singapore.
3. **Kiến trúc 2 account** — giftzone-ai (account 1) trong nhóm sales nội bộ; giftzone-deal-monitor (account 2) trong nhóm sales-khách hàng. Deal-monitor cần Zalo connection riêng để log messages từ nhóm khách.
4. **Deal stage tracking** — Deal Analyzer đã có code, cần thêm UI trên Dashboard để xem deals
5. **Analytics page** — màn hình 4 trong spec: top questions theo group, doc usage timeline

### Quyết định quan trọng đã chốt
- **Không có thinking message**: UX tốt hơn trên Zalo mobile; Gemini đủ nhanh
- **Không trích dẫn nguồn trong reply**: Reply sạch hơn — đã bỏ khỏi cả `responder.js` và `retriever.js` SYSTEM_PROMPT
- **Chat model**: `gemini-2.5-flash-lite` (nhanh hơn, miễn phí)
- **Chat 1:1 dùng `MessageType.DirectMessage`**: zca-js enum là `DirectMessage=0`, không phải `UserMessage` — nhầm type này sẽ không nhận được tin nhắn
- **Render Free Web Service thay Background Worker**: Background Worker không còn free tier (2024); Web Service free + cron-job.org ping mỗi 14 phút để tránh sleep
- **`better-sqlite3` là optionalDependencies**: Native module chỉ cần trên máy local có Chrome; không crash khi build trên Render
- **Cookie extractor KHÔNG chạy lúc startup**: Tránh ghi đè cookie cũ bằng cookie rỗng khi Chrome chưa có session `chat.zalo.me` — chỉ chạy qua cron 3AM
- **Cookie extractor safety check**: Phải có `zpsid`/`zpw_sek` và ≥3 cookies trước khi ghi DB — tránh lưu array rỗng
- **Supabase Session Pooler**: Dùng `postgres.[PROJECT_REF]` làm username (tenant routing); không dùng Transaction Pooler vì pgvector HNSW cần persistent connection
- **`force-dynamic` trên overview page**: Next.js App Router cache server components theo mặc định → data không cập nhật khi reload; `export const dynamic = 'force-dynamic'` fix điều này
- **`unstable_cache` cho performance**: `force-dynamic` làm mỗi request hit DB; thêm `unstable_cache` TTL 60s (overview) và 30s (logs) để nhiều request trong cùng window dùng chung 1 DB hit
- **Supabase pool limits**: Free tier giới hạn 15 connections; dashboard pool `max: 2`, agent pool `max: 5` — tổng tối đa 7, an toàn cho Vercel serverless (nhiều instances)
- **Timezone display**: Vercel serverless dùng UTC, `toLocaleString()` không có `timeZone` option → giờ hiển thị sai. Fix: tất cả date/time display phải có `timeZone: 'Asia/Ho_Chi_Minh'`
- **WeekChart là client component**: Bar chart cần hover state → phải dùng `'use client'` + `useState`; server component không thể có interactivity
- **Dashboard là regular directory**: Vercel không clone git submodule → đã convert `dashboard/` thành regular files
- **GitHub SSH remote**: HTTPS bị 403 do account mismatch (Thuy-Cam vs ThuyCam2911) → dùng SSH
- **Zalo cookie IP binding**: Cookie mới tạo từ máy local VN bị Zalo reject khi gọi từ Render US IP. Cookie cũ đã được trust thì tiếp tục hoạt động. Khi update cookie: phải dùng cookie từ session đã chạy ổn định, KHÔNG tạo session mới từ local rồi paste lên Render.
- **Deal Monitor architecture**: 2 Zalo accounts — account 1 (Sales AI) trong nhóm nội bộ sales, account 2 (Deal Monitor) trong nhóm sales-khách hàng. Deal Analyzer cron đọc messages từ DB để detect deal stage.
- **OpenRouter model**: `meta-llama/llama-3.3-70b-instruct:free` — `nvidia/nemotron-ultra-253b-v1:free` đã bị xóa khỏi OpenRouter

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
6. HTTP health server trên `PORT` (default 3000) — giữ Render Free không sleep
7. Cookie refresh cron 3:00 AM hàng ngày (chỉ hiệu quả trên máy local có Chrome)

### Key modules
- **`src/zalo/session.js`** — `SessionManager`: wraps zca-js login, đọc cookie từ DB `settings.zalo_cookie` trước rồi fallback `.env`; health-checks every 30min via `getOwnId()`, calls `onExpired` → `process.exit(1)`
- **`src/zalo/listener.js`** — `GroupListener`: xử lý cả `DirectMessage` (1:1, không cần @mention) lẫn `GroupMessage` (@mention required); strips @mention tokens by pos/len offsets; emit `onMention(ctx)` với flag `isDirect`
- **`src/zalo/responder.js`** — `MentionResponder`: dùng `MessageType.DirectMessage` khi `ctx.isDirect=true`, `GroupMessage` khi false; calls `answer()` trực tiếp, logs to `ai_logs`
- **`src/utils/cookie-extractor.js`** — đọc Chrome SQLite (`~/Library/.../Cookies`), decrypt AES-128-CBC dùng macOS Keychain key, filter lấy `.zalo.me` cookies, lưu vào `settings.zalo_cookie`; safety: cần `zpsid`/`zpw_sek` + ≥3 cookies
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

ENV file: `dashboard/.env.local` (local dev)
```
DASHBOARD_PASSWORD=...
SESSION_SECRET=...
PG_HOST=localhost
PG_PORT=5433
PG_DATABASE=giftzone_agent
PG_USER=postgres
PG_PASSWORD=postgres
```

Vercel env vars (production):
```
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-...pooler.supabase.com:5432/postgres
DASHBOARD_PASSWORD=...
SESSION_SECRET=...
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
- `summary/engine.js`: `query()` trả về array trực tiếp nhưng code dùng `const { rows } = await query()` → `rows = undefined` → summary engine crash silently từ đầu. Fix: `fetchMessages` return trực tiếp, `getActiveGroups` dùng `const rows = await query()`
- `dashboard/app/overview/page.tsx`: PostgreSQL `DATE()` trả về Date object; chart key dùng string → không match. Fix: `new Date(r.day).toISOString().slice(0, 10)`
- **Timezone chart key**: Sau nửa đêm VN (00:00–07:00) UTC date là ngày hôm trước → key sai. Fix: `sv-SE` locale với `timeZone: 'Asia/Ho_Chi_Minh'` cho YYYY-MM-DD keys
- **Vercel prerender error**: Next.js App Router prerender pages với DB calls lúc build time → crash. Fix: `export const dynamic = 'force-dynamic'` trên tất cả pages có DB query (overview, logs, settings, knowledge-base)

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
