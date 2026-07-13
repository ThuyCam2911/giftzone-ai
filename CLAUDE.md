# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Monorepo Structure

```
giftzone-agent/
├── giftzone-agent-backend/   # Node.js ESM agent (Zalo AI + RAG + Deal Analyzer)
├── giftzone-agent-admin/     # Next.js 14 App Router admin dashboard
├── spike/                    # Throwaway proof-of-concept scripts
├── render.yaml               # Render deploy config (backend only)
└── CLAUDE.md
```

> Backend and admin do **not** share code — different runtimes (Node.js ESM vs Next.js TS). They share the same Supabase database.

---

## Commands

### Backend
```bash
cd giftzone-agent-backend
npm install
npm run dev          # --watch, auto-restart on file change
npm start            # production
npm run index:drive  # manually re-index Google Drive (after Gemini quota resets)
```

Set `SKIP_INDEX=true` in `.env` to skip Drive indexing on startup.

### Admin (Dashboard)
```bash
cd giftzone-agent-admin
npm install
npm run dev          # port 3000 (Next.js default)
npm run build        # production build
```

ENV file: `giftzone-agent-admin/.env.local`
```
DASHBOARD_PASSWORD=...
SESSION_SECRET=...
SETTINGS_ENC_KEY=...  # phải khớp giá trị trên backend (Render) — mã hoá zalo_cookie at-rest
PG_HOST=localhost
PG_PORT=5433
PG_DATABASE=giftzone_agent
PG_USER=postgres
PG_PASSWORD=postgres
```

### Spike
```bash
cd spike
npm run auth:drive         # OAuth2 flow — get Google refresh_token
node zalo/mention-test.js  # test @mention detection in live Zalo group
node pgvector/pgvector-spike.js
```

### Infrastructure
```bash
# Local: pgvector on port 5433 (5432 was taken)
docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16

# Production: Supabase (pgvector built-in, free tier)
# Enable: SQL Editor → CREATE EXTENSION IF NOT EXISTS vector;
# Connection: Settings → Database → Session pooler (port 5432)
# Username format: postgres.[PROJECT_REF] (required for pooler tenant routing)
```

---

## Architecture

### Backend (`giftzone-agent-backend/src/`)

```
src/
├── index.js              # Startup sequence
├── zalo/
│   ├── session.js        # Zalo login + health check
│   ├── listener.js       # WebSocket message handler
│   └── responder.js      # AI reply dispatcher
├── rag/
│   ├── embedder.js       # Gemini embedding-001, dim 1536
│   ├── indexer.js        # Google Drive → pgvector
│   └── retriever.js      # Cosine search + Gemini chat
├── deal/
│   └── analyzer.js       # Issue detection cron (15min, Gemini)
├── summary/
│   └── engine.js         # Daily group summary cron (18:00 Mon–Fri)
└── utils/
    ├── db.js             # pg Pool + initSchema()
    ├── config.js         # getConfig/setConfig via settings table
    ├── logger.js         # chalk logger, respects LOG_LEVEL
    └── cookie-extractor.js  # Chrome SQLite → Zalo cookie (local only)
```

**Startup sequence (`src/index.js`)**
1. `initSchema()` — create pgvector tables + HNSW index if not exist
2. `SessionManager.login()` — Zalo login via zca-js
3. `indexAll()` — index Google Drive docs (background, skipped if `SKIP_INDEX=true`)
4. `GroupListener` + `MentionResponder` — Zalo WebSocket
5. `startSummaryEngine()` + `startAutoSync()` — cron jobs
6. `startDailyAlert(api)` — 8AM Mon–Sat morning alert to `admin_group_id`
7. HTTP health server on `PORT` (default 3000) — keeps Render Free alive
8. Cookie refresh cron 3:00 AM (local machine with Chrome only)

**Backend modules added**
- `alert/daily.js` — morning alert cron (8:00 AM Mon–Sat, Asia/Ho_Chi_Minh); sends open issues + inactive groups + AI stats to admin group

**Key module notes**
- `session.js` — reads `ZALO_COOKIE` from ENV first, DB fallback; health-checks every 30min via `getOwnId()`, calls `onExpired` → `process.exit(1)`
- `listener.js` — handles `DirectMessage` (1:1, no @mention needed) and `GroupMessage` (@mention required); emits `onMention(ctx)` with `isDirect` flag
- `responder.js` — uses `MessageType.DirectMessage` when `ctx.isDirect=true`, `GroupMessage` otherwise; calls `answer()` directly, no thinking message, no source citation
- `embedder.js` — `outputDimensionality: 1536` (HNSW limit is 2000; default 3072 exceeds it); exponential backoff on 429
- `indexer.js` — 600ms delay between chunks (critical for free-tier rate limit); polls Drive Changes API every **24h** (reduced from 15min to preserve embedding quota)
- `analyzer.js` — model fallback chain; XML tags around conversation to prevent prompt injection; 60s delay between groups; role-based tagging `[GZ-Sales]`/`[GZ-CS]`/`[GZ-Manager]`/`[GZ-Tech]`/`[KH]` (no-op if table empty); writes `analyzer_status=degraded` to settings when entire chain fails
- `cookie-extractor.js` — safety: requires `zpsid`/`zpw_sek` and ≥3 cookies before writing DB; does NOT run at startup

### Admin (`giftzone-agent-admin/`)

```
app/
├── api/                  # Next.js API routes (backend-for-frontend)
│   ├── auth/
│   ├── config/
│   ├── groups/
│   ├── gz-members/
│   ├── issues/[id]/      # PATCH — manual resolve/reopen issue
│   ├── knowledge/
│   ├── logs/
│   ├── overview/
│   └── zenterprise/
│       ├── accounts/, accounts/[id]/   # CRUD zenterprise_accounts
│       └── live/analyze/               # phân tích + ghi hội thoại zEnterprise Live
├── analytics/
├── deals/
├── groups/
│   └── [groupId]/        # Group detail page (dynamic route)
├── knowledge-base/
├── logs/
├── overview/
├── sales-members/        # Per-person KPI: msgs, groups, issues, response time
├── settings/
└── zenterprise/          # zEnterprise Management (thay thế /demo cũ)
    ├── accounts/         # CRUD tài khoản zEnterprise
    ├── live/              # Kịch bản mô phỏng hội thoại (rename của /demo)
    └── dashboard/         # Phân tích tổng quan + theo từng account, filter/time range
components/
├── ui/                   # Reusable UI primitives (StatsCard, WeekChart)
├── Sidebar.tsx           # Nav groups: zEnterprise Management / Tổng quan / Giám sát / Quản lý
├── LocaleProvider.tsx    # Context VI/EN cho toàn bộ Client Components
├── LanguageSwitcher.tsx
├── AnalyticsPage.tsx     # Analytics + quality score + unanswered + response time per member
├── DealsPage.tsx         # + manual resolve button per issue
├── GZMemberManager.tsx   # + role dropdown (Sales/CS/Manager/Tech)
├── GroupTypeManager.tsx
├── SettingsForm.tsx
├── SessionAlert.tsx
├── LiveChat.tsx          # zEnterprise Live — kịch bản mô phỏng, ghi vào bảng production thật
├── ZEnterpriseAccountsManager.tsx
└── ZEnterpriseDashboard.tsx
lib/
├── db.ts                 # pg Pool (separate from backend, avoids ESM/CJS conflict)
├── auth.ts               # HMAC-SHA256 token, gz_session cookie
├── utils.ts
├── i18n/
│   ├── dictionary.ts     # Toàn bộ key VI/EN — tsc validate key tồn tại (DictKey union type)
│   ├── config.ts         # Locale type, cookie name (gz_locale)
│   └── server.ts         # getLocale()/getDict() cho Server Components (đọc cookie)
└── queries/              # All DB queries isolated here — pages never write SQL directly
    ├── overview.ts
    ├── logs.ts
    ├── deals.ts           # getIssueLabels(locale) — issue type labels song ngữ
    ├── analytics.ts
    ├── group-detail.ts   # getGroupDetail(), getInactiveGroups()
    ├── sales-members.ts  # getSalesMembersData() — per-member KPI with LATERAL join
    ├── zenterprise.ts             # CRUD zenterprise_accounts + link candidates
    ├── zenterprise-live.ts        # insertLiveConversation() — ghi vào group_names/messages/ai_logs/sales_issues thật
    └── zenterprise-dashboard.ts   # Aggregate overview + per-account stats
types/
└── index.ts
```

**Admin conventions**
- `export const dynamic = 'force-dynamic'` on every page with DB queries (prevents Next.js build-time prerender crash)
- All date/time display must include `timeZone: 'Asia/Ho_Chi_Minh'` (Vercel runs UTC)
- DB queries belong in `lib/queries/` — never inline SQL in page components
- Pool `max: 2` (Supabase free tier: 15 connections total; backend uses max 5)
- Dynamic route params: `params: Promise<{ groupId: string }>` (Next.js 14+ App Router — must `await params`)
- `proxy.ts` is the middleware file (NOT `middleware.ts`) — Edge runtime uses Web Crypto API (`crypto.subtle`), not Node `crypto`
- **i18n (VI/EN, thêm 2026-07-08)**: `lib/i18n/dictionary.ts` chứa toàn bộ chuỗi UI, key kiểu `DictKey` union — TypeScript báo lỗi ngay nếu gọi `t()` với key không tồn tại. Server Components dùng `await getDict()` (đọc cookie `gz_locale`); Client Components dùng `useLocale()` từ `LocaleProvider` (bọc toàn app ở `layout.tsx`). Đổi ngôn ngữ ghi cookie + `router.refresh()` để Server Components re-render theo locale mới. Không dịch nội dung AI-generated động (vd Vietnamese summary/insight text lưu sẵn trong DB từ Gemini) — chỉ dịch "chrome" của UI (tiêu đề, nhãn, nút, header bảng...)

### Database Schema (Supabase / pgvector)

| Table | Purpose |
|-------|---------|
| `doc_chunks` | RAG chunks — `embedding vector(1536)`, HNSW `m=16, ef_construction=64` |
| `ai_logs` | AI query/answer log — `sources JSONB`, `latency_ms`, `is_answered BOOL`, `top_score FLOAT` |
| `messages` | All Zalo messages — `is_gz_member BOOL`, `msg_type TEXT` (text/media) |
| `settings` | DB-backed config (source of truth over `.env` for most keys) |
| `group_names` | Zalo group metadata + `group_type` (internal/customer) |
| `gz_members` | GiftZone team UIDs + `role` (sales/cs/manager/technical) |
| `deals` | Deal tracking per customer per group |
| `deal_events` | Deal stage change history |
| `sales_issues` | Quality issues detected by analyzer (open/resolved) |
| `zenterprise_accounts` | zEnterprise account CRUD — `account_name`, `phone`, `branch`, `role`, `status`, `linked_sender_uid` (optional link tới dữ liệu thật trong `messages`/`ai_logs`) |

All timestamps: `TIMESTAMPTZ`. Group/User IDs: `TEXT` (Zalo IDs are large numbers, string is safer).

**New columns added (2026-06-25) via `ADD COLUMN IF NOT EXISTS` migrations in `initSchema()`:**
- `gz_members.role` — phân role nhân viên; analyzer dùng để tag `[GZ-Sales]`/`[GZ-CS]` etc.
- `ai_logs.is_answered` — `false` khi top similarity < 0.5 hoặc answer chứa "chưa có thông tin"
- `ai_logs.top_score` — similarity score của chunk match tốt nhất (0–1)
- `messages.is_gz_member` — cached khi insert, tránh JOIN mỗi lần analytics
- `messages.msg_type` — `'text'` hoặc `'media'`; analyzer skip non-text khi detect issues

### AI Stack (all free-tier)

| Role | Model | Notes |
|------|-------|-------|
| RAG chat | `gemini-2.5-flash-lite` | via `@google/generative-ai` |
| Summary | `gemini-1.5-flash` | daily group summary |
| Embeddings | `gemini-embedding-001` | `outputDimensionality: 1536` |
| Issue detection | `gemini-2.5-flash-lite` | dùng chung `GEMINI_API_KEY` (đổi từ OpenRouter — model free bị 404/429 liên tục) |

Gemini embedding quota resets ~7:00 AM Vietnam time. If exhausted: set `SKIP_INDEX=true`, restart, run `npm run index:drive` after reset.

**Tối ưu số lệnh gọi/token (2026-07-06):**
- `ops/assistant.js` `classifyIntent()` — heuristic (keyword, miễn phí) chạy trước; chỉ gọi Gemini khi heuristic không đủ tự tin (không match keyword rõ, hoặc `summary` mà thiếu tên nhóm). Trước đây gọi Gemini vô điều kiện cho MỌI @mention trong nhóm internal → giờ phần lớn câu hỏi ops/summary thường gặp bỏ qua hẳn 1 lệnh gọi
- Tất cả `generateContent()` calls (retriever, ops, summary, analyzer) đều thêm `generationConfig.maxOutputTokens` — trước đây không giới hạn, dễ lãng phí token nếu model trả lời dài hơn cần thiết. Giá trị theo đúng yêu cầu format trong prompt (vd RAG/Ops trả lời ngắn ~10 dòng → 600 tokens, summary "dưới 300 từ" → 1200, analyzer JSON issues → 1500 giữ nguyên mức cũ)
- `classifyIntent` dùng `temperature: 0` — output JSON ngắn, cần ổn định/deterministic, không cần sáng tạo

### Zalo Session Constraints

- **One web connection per account** — close all `chat.zalo.me` tabs before deploying
- Cookie is IP-bound — do NOT create a new session from local VN machine then paste to Render US server; use cookies from an already-trusted session
- `selfListen: false` in production (prevents echo loop)
- Cookie format: J2TEAM array `[{name,value,...}]` — `parseCookie()` handles both array and object

### Deploy

| Service | Platform | Config |
|---------|----------|--------|
| Backend (Sales AI) | Render — `giftzone-ai` | `render.yaml`, account 1, internal sales groups, `ENABLE_RAG` mặc định bật |
| Backend (Deal Monitor) | Render — `giftzone-deal-monitor` | manual, account 2, customer groups, **`ENABLE_RAG=false`** (tắt RAG docs, Ops Assistant vẫn chạy nếu account này cũng ở trong nhóm internal) + `ENABLE_DEAL_ANALYSIS=true` + `INSTANCE_ID=dealmonitor` |
| Admin Dashboard | Vercel — `giftzone-ai.vercel.app` | root dir: `giftzone-agent-admin` |
| Database | Supabase | project ref: `ytvcmkczealtlvapjjke`, Session Pooler port 5432 |

Vercel env vars (production):
```
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-...pooler.supabase.com:5432/postgres
DASHBOARD_PASSWORD=...
SESSION_SECRET=...
SETTINGS_ENC_KEY=...  # phải khớp giá trị trên backend (Render) — mã hoá zalo_cookie at-rest
```

---

## Environment Variables

### Backend (`giftzone-agent-backend/.env`)
```
ZALO_IMEI
ZALO_COOKIE          # ENV takes priority over DB value
ZALO_USER_AGENT
ZALO_TEST_GROUP_ID
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
DRIVE_FOLDER_ID      # folder OR single file ID
GEMINI_API_KEY       # dùng chung cho RAG, Ops Assistant, Summary, Embedding, Deal Analyzer
SETTINGS_ENC_KEY     # hex 64 ký tự (32 bytes) — mã hoá zalo_cookie at-rest, PHẢI khớp với giftzone-agent-admin
PG_HOST
PG_PORT=5433
PG_DATABASE          # must set PG_DATABASE=postgres on Render (default is giftzone_agent for local Docker)
PG_USER
PG_PASSWORD
AGENT_NAME=GiftZone AI
SUMMARY_CRON         # default: "0 18 * * 1-5"
SKIP_INDEX           # "true" to skip Drive indexing at startup
LOG_LEVEL            # debug / info / warn / error (default: info)
SKIP_ZALO             # "true" = không connect Zalo (Deal Monitor không dùng — cần đọc msg nhóm khách)
ENABLE_RAG            # "false" = tắt trả lời RAG docs (tài liệu công ty) — Ops Assistant vẫn hoạt động ở nhóm internal. Set false trên giftzone-deal-monitor.
ENABLE_SUMMARY        # "false" = tắt Summary Engine (default: bật)
ENABLE_DEAL_ANALYSIS  # "true" = bật Sales Issue Monitor/analyzer (default: tắt)
INSTANCE_ID           # đặt trên deal-monitor để tách cookie DB key riêng (zalo_cookie_<INSTANCE_ID>)
```

⚠️ `giftzone-agent-backend/.env` and `spike/.env` contain live Zalo session cookies — **never commit**.

---

## Critical Decisions Log

### Zalo / Cookie
- **ENV cookie priority over DB**: `session.js` reads `process.env.ZALO_COOKIE` first — DB stale cookie must never override a fresh ENV value
- **`initSchema` does NOT seed `zalo_cookie`**: Seeding caused re-insert of old cookie on redeploy, which then overrode ENV
- **Cookie extractor does NOT run at startup**: Would overwrite valid DB cookie with empty array if Chrome has no `chat.zalo.me` session
- **IP binding**: New cookies from local VN IP are rejected by Render US IP. Always reuse cookies from an already-running trusted session
- **`Another connection is opened`**: Close all `chat.zalo.me` tabs → restart. Render rolling deploy may also trigger — usually self-resolves

### Backend
- **No thinking message**: Better UX on Zalo mobile; Gemini is fast enough
- **No source citation in reply**: Cleaner replies — removed from `responder.js` and `retriever.js` SYSTEM_PROMPT
- **`MessageType.DirectMessage` for 1:1**: zca-js enum is `DirectMessage=0`, NOT `UserMessage` — wrong type = no messages received
- **`PG_DATABASE` required on Render**: Default `giftzone_agent` only exists in local Docker; Render needs `PG_DATABASE=postgres`
- **`better-sqlite3` is `optionalDependencies`**: Native module needed only on local Mac with Chrome; must not crash on Render build

### Deal Analyzer
- **Dùng Gemini (`GEMINI_API_KEY`), không còn OpenRouter**: OpenRouter's free MODEL_CHAIN (llama-3.3-70b, deepseek-r1, gemma-3-27b) rệu rã — 2/3 model bị gỡ khỏi OpenRouter (404), model còn lại rate-limit liên tục (429). Đổi sang `gemini-2.5-flash-lite` dùng chung key với RAG/Ops — có exponential backoff retry cho 429/503 (giống `embedder.js`)
- **60s delay between groups**: tránh rate limit Gemini free tier
- **`deal_key` format**: LLM returns `customer_name_no_accents`, code prepends `${groupId}__` — do NOT include group_id in prompt (causes double prefix)
- **`gz_members` role tagging**: Empty table = no tags = behavior identical to before (safe default). With roles: `[GZ-Sales]`, `[GZ-CS]`, `[GZ-Manager]`, `[GZ-Tech]` + `[KH]`
- **Prompt injection guard**: Conversation wrapped in `<conversation>...</conversation>` XML tags
- **auto-resolve guard**: only calls `autoResolve()` when `messages.length >= 5` — prevents resolving open issues when there's not enough data to re-analyze
- **`analyzer_status` setting**: written to `settings` table with value `'degraded'` when entire MODEL_CHAIN fails; Dashboard can surface this warning

### Admin / Dashboard
- **`force-dynamic`**: Required on all pages with DB queries — prevents Next.js build-time prerender crash
- **Timezone**: All date display needs `timeZone: 'Asia/Ho_Chi_Minh'` (Vercel runs UTC)
- **HMAC-SHA256 auth token**: `createHmac('sha256', secret).update(password).digest('hex')` — not reversible base64
- **`lib/queries/` pattern**: All SQL isolated in `lib/queries/` — pages only call typed functions
- **Supabase Session Pooler**: Use `postgres.[PROJECT_REF]` as username; Transaction Pooler breaks pgvector HNSW
- **`giftzone-agent-admin` is a regular directory**: Vercel does not clone git submodules — already converted

### Admin / Dashboard (additions)
- **`proxy.ts` is the middleware** (NOT `middleware.ts`): This Next.js version (16.x) uses `proxy.ts`. Having both files causes build error "Both middleware.ts and proxy.ts detected" — delete `middleware.ts`, put all auth logic in `proxy.ts`
- **Web Crypto in `proxy.ts`**: Edge runtime has no Node `crypto` — use `crypto.subtle.importKey` / `crypto.subtle.sign` for HMAC-SHA256 to match `lib/auth.ts`
- **`window.location.href` for post-login redirect**: `router.push` silently fails if Vercel SSR crashes during navigation; hard redirect is reliable
- **`KNOWN_KEYS` pattern in settings**: UI always shows known config keys with defaults — decouples settings page from backend restart/seeding order
- **`INSERT ... ON CONFLICT DO UPDATE` for config PUT**: Plain `UPDATE` no-ops if row doesn't exist yet (backend not restarted to seed); upsert always works

### Infrastructure
- **Render Free Web Service** (not Background Worker): Background Worker lost free tier in 2024; use Web Service + cron-job.org ping every 14min to prevent sleep
- **Health endpoint must return tiny response**: cron-job.org fails with "output too large" if response is big → service sleeps. Return plain `ok` text, not JSON
- **`INSTANCE_ID` env var for multi-account**: set `INSTANCE_ID=dealmonitor` on deal-monitor service → uses DB key `zalo_cookie_dealmonitor` instead of shared `zalo_cookie` — prevents account 1 cookie overwriting account 2
- **GitHub SSH remote**: HTTPS returns 403 due to account mismatch (Thuy-Cam vs ThuyCam2911)
- **2 Render accounts**: Account 1 = Sales AI (internal groups), Account 2 = Deal Monitor (customer groups)
- **Render root directory must match folder name**: after monorepo rename, update Root Directory in Render Settings for each service or deploy fails with `cd: No such file or directory`

---

## Project Status (as of 2026-06-25)

### ✅ Completed features

| Feature | Location | Notes |
|---------|----------|-------|
| RAG agent (Zalo @mention → Gemini answer) | `backend/src/rag/` | Stable, deployed on Render |
| Deal analyzer (issue detection cron) | `backend/src/deal/analyzer.js` | Gemini free tier, 15min cron |
| Daily summary (18:00 Mon–Fri) | `backend/src/summary/engine.js` | Sends to each active group |
| Daily morning alert (8AM) + knowledge gap | `backend/src/alert/daily.js` | Runtime config fix + top 3 unanswered/7 days |
| Admin dashboard login + auth | `admin/app/login/`, `proxy.ts` | HMAC-SHA256, hard redirect after login |
| Overview page | `admin/app/overview/` | KPI cards + 7-day chart |
| Logs page | `admin/app/logs/` | AI query log with latency |
| Deals page + manual resolve | `admin/app/deals/` | Open issues per group + Resolve button |
| Analytics page + response time | `admin/app/analytics/` | Top questions, doc usage, quality score, unanswered, response time per member |
| Group detail page | `admin/app/groups/[groupId]/` | KPI cards, open issues, top senders, AI log |
| Inactive group detection | `admin/app/groups/` | Amber banner for groups silent >3 days |
| Settings page (all known keys) | `admin/app/settings/` | `KNOWN_KEYS` pattern — shows all keys even before backend seeds DB |
| GZ Members manager + role | `admin/components/GZMemberManager.tsx` | Role dropdown (Sales/CS/Manager/Tech) |
| Group type manager | `admin/components/GroupTypeManager.tsx` | internal / customer classification |
| Sales Members page | `admin/app/sales-members/` | KPI per person: msgs, groups, open issues, avg response time |
| Role-based analyzer tagging | `backend/src/deal/analyzer.js` | `[GZ-Sales]`/`[GZ-CS]` etc. instead of generic `[GZ]` |
| `is_answered` + `top_score` tracking | `backend/src/rag/retriever.js` | Accurate unanswered detection via similarity score |
| `is_gz_member` + `msg_type` on messages | `backend/src/zalo/listener.js` | Enables response time analytics; filters non-text from analyzer |
| Auto-sync interval 24h | `backend/src/rag/indexer.js` | Reduced from 15min to preserve Gemini embedding quota |
| zEnterprise Management (2026-07-08) | `admin/app/zenterprise/` | 3 trang: Accounts CRUD, Live (rename của Demo — bỏ hết wording "demo"), Dashboard phân tích (tổng quan + per-account, filter/time range). Data thật, ghi vào bảng production giống hệt luồng thật |
| VI/EN i18n toàn dashboard (2026-07-08) | `admin/lib/i18n/`, `admin/components/LocaleProvider.tsx` | Toggle ở Sidebar + trang login; cookie `gz_locale`; dịch toàn bộ UI chrome, không dịch nội dung AI-generated động |

### ⏳ Pending (user action required)

| Action | Where | Why |
|--------|-------|-----|
| Re-extract cookie account 2 | Zalo web → J2TEAM extension | Account deal-monitor có thể bị ban hoặc cookie thiếu `zpw_enk` |
| Set `SKIP_INDEX=true` trên Render (nếu chưa) | Render ENV → giftzone-ai service | Ngăn re-index toàn bộ Drive mỗi lần deploy, tránh hết embedding quota |
| Verify UptimeRobot đang ping đúng URL + interval ≤14min | UptimeRobot dashboard | Service vẫn có khả năng sleep nếu ping URL sai hoặc interval quá dài |

### 🔲 Not yet implemented

- Deal stage tracker (Idea #1 — skipped by choice)
- Critical issue → gửi Zalo alert ngay (không đợi 8AM daily alert)
- `analyzer_status=degraded` warning hiển thị trên Overview dashboard (backend ghi vào settings nhưng admin chưa đọc)
- Push notification / webhook to external systems
- Multi-language support
- User management (multiple manager accounts)

---

## Security Assessment (2026-07-04) — items #2,3,4 (Trung bình) và #2,3,4 (Khuyến nghị) đã fix 2026-07-06; #1 nền tảng và #4 pháp lý cần xử lý riêng

Đánh giá bảo mật luồng chat Zalo Agent — dùng `zca-js` (không phải API chính thức Zalo, impersonate session qua cookie lấy bằng extension J2TEAM Cookie). Xếp theo mức độ rủi ro.

### 🔴 Cao

1. **Mô hình nền tảng dựa trên "session hijacking" chính tài khoản mình** — `zca-js` vi phạm ToS Zalo (tự động hoá tài khoản cá nhân). Tài khoản có thể bị khoá bất kỳ lúc nào. Cookie = toàn quyền tài khoản, không 2FA/device-binding nào khác ngoài kiểm tra IP. Đây là rủi ro nền tảng, không vá được bằng code.
2. ✅ **FIXED 2026-07-06** — ~~Zalo cookie lưu plaintext trong DB, hiển thị plaintext trên Dashboard~~ — `settings.zalo_cookie*` giờ mã hoá AES-256-GCM at-rest (`utils/crypto.js` backend, `lib/crypto.ts` admin, cùng format `enc:v1:iv:tag:ciphertext`, key `SETTINGS_ENC_KEY` set trên cả Render + Vercel; không set key → fallback plaintext cho local dev). Settings UI + `settings/page.tsx` (Server Component) + `/api/config` GET đều mask giá trị thành `••••••••••••` trước khi rời server — không còn leak qua RSC payload. Textarea để trống = giữ nguyên, nhập mới = ghi đè (không thể vô tình gửi lại chuỗi mask).
3. ✅ **FIXED 2026-07-06** — ~~`/api/config` (GET/PUT) không tự gọi `isAuthenticated()`~~ — đã thêm check tường minh, không còn dựa hoàn toàn vào `proxy.ts` middleware.
4. **Chat khách hàng bị log + gửi Gemini (bên thứ 3, nước ngoài) không thông báo/đồng ý** — `giftzone-deal-monitor` lưu vĩnh viễn mọi tin nhắn nhóm khách vào `messages`, gửi cho Gemini API phân tích issues/sentiment. Khách không biết đang bị AI phân tích/lưu trữ. Rủi ro pháp lý theo Nghị định 13/2023/NĐ-CP (bảo vệ dữ liệu cá nhân) — yêu cầu thông báo, nhiều trường hợp cần đồng ý, đánh giá tác động khi chuyển dữ liệu ra nước ngoài.

### 🟡 Trung bình

- ✅ **FIXED 2026-07-06** — ~~Không rate-limit `/login`~~ — thêm bảng `login_attempts`, chặn 5 lần sai/10 phút theo IP (`x-forwarded-for`)
- Không có data retention/xoá dữ liệu — `messages`, `ai_logs`, `sales_issues` tích luỹ vô thời hạn, không đáp ứng được quyền xoá dữ liệu của khách hàng (NĐ13/2023)
- Cookie sống rất dài, cron tự refresh 3AM từ chính session Chrome gốc — không xoay vòng credential thật, chỉ kéo dài tuổi thọ cùng 1 phiên
- So sánh token/password không constant-time (`token === expected` trong `lib/auth.ts`, `proxy.ts`) — lý thuyết dễ timing attack, rủi ro thực tế thấp qua network

### 🟢 Đã làm tốt

- Prompt injection guard: `analyzer.js` (`<conversation>`) và `ops/assistant.js` (`<du_lieu_van_hanh>`) đều wrap nội dung chat trong XML tag trước khi đưa vào prompt Gemini
- `.env`, cookie file gitignore đúng, chưa từng commit nhầm
- Token dashboard dùng HMAC-SHA256, không phải base64 reversible
- Health endpoint không leak thông tin (`res.end('ok')`)

### Khuyến nghị ưu tiên

1. ✅ Đã thêm `isAuthenticated()` tường minh vào `/api/config`
2. ✅ Đã mask cookie field trên Settings UI
3. ✅ Đã mã hoá `zalo_cookie` at-rest trong DB (AES-256-GCM)
4. ✅ Đã rate-limit `/login` theo IP
5. ⏳ **Chưa làm — cần bàn với người phụ trách pháp lý**: thông báo tối thiểu cho khách về việc chat được AI phân tích/lưu trữ (giảm rủi ro NĐ13/2023). Đây không phải vấn đề code, cần quyết định từ phía kinh doanh/pháp lý.

**⚠️ Việc cần làm để fix có hiệu lực:** set biến môi trường `SETTINGS_ENC_KEY` (chuỗi hex 64 ký tự = 32 bytes, vd `openssl rand -hex 32`) — **giống hệt giá trị** trên cả Render (`giftzone-ai`, `giftzone-deal-monitor`) và Vercel (`giftzone-agent-admin`). Nếu không set, hệ thống fallback về plaintext (không crash) nhưng mất tác dụng mã hoá.

---

## Known Bugs Fixed

| File | Bug | Fix |
|------|-----|-----|
| `rag/indexer.js` | 600ms delay was assumed to be inside `embed()`, causing quota exhaustion | Moved delay into `indexFile()` loop explicitly |
| `rag/indexer.js` | Crash when imported as module | Guard `process.argv[1]?.endsWith()` |
| `rag/retriever.js` | Similarity score leaked into LLM context | Removed score from context string |
| `zalo/listener.js` | `query` variable shadowed DB import | Renamed to `userQuery` |
| `zalo/responder.js` | Thinking message + source citation in reply | Removed both |
| `deal/analyzer.js` | Prompt injection via user messages | Wrapped conversation in XML tags |
| `deal/analyzer.js` | Double `groupId__` prefix in deal_key | LLM returns name only; code prepends groupId |
| `summary/engine.js` | `const { rows } = await query()` — rows was undefined | Fixed destructuring |
| `lib/auth.ts` | Base64 token was reversible | Replaced with HMAC-SHA256 |
| `lib/queries/analytics.ts` | topQuestions had no time filter | Added `WHERE created_at >= NOW() - INTERVAL '7 days'` |
| `app/overview/page.tsx` | Chart key timezone mismatch (UTC vs VN) | `sv-SE` locale + `timeZone: 'Asia/Ho_Chi_Minh'` |
| all pages | Vercel prerender crash at build time | `export const dynamic = 'force-dynamic'` |
| `components/GZMemberManager.tsx` | Save silently failed, selections lost after reload | Added `res.ok` check, error state, try/catch |
| `app/api/gz-members/route.ts` | `gz_members` table missing on fresh Supabase | Added `ensureTable()` with `CREATE TABLE IF NOT EXISTS` before every query |
| `app/login/page.tsx` | Login succeeded but no redirect to inner pages | Changed `router.push` → `window.location.href` (hard redirect) |
| `proxy.ts` | Token mismatch with `lib/auth.ts` (btoa vs HMAC) | Replaced btoa with Web Crypto `crypto.subtle` HMAC-SHA256 |
| `app/settings/page.tsx` | `admin_group_id` not visible before backend restart | Added `KNOWN_KEYS` merge pattern — shows all known keys regardless of DB state |
| `app/api/config/route.ts` | PUT silently no-ops for unseeded keys | Changed `UPDATE` → `INSERT ... ON CONFLICT DO UPDATE` |
| `zalo/responder.js` | Error handler calls `_send()` without `isDirect` → sends GroupMessage to 1:1 UID → "Nhóm này không tồn tại" | Pass `isDirect` to `_send()` in catch block |
| `src/index.js` | Health endpoint returned JSON → cron-job.org "output too large" → stopped pinging → Render sleep | Changed to `res.end('ok')` plain text |
| `alert/daily.js` | `admin_group_id` read at startup — if set after deploy via Dashboard, alert never sends | Moved `getConfig()` call inside cron callback (runtime read) |
| `deal/analyzer.js` | `autoResolve()` called when < 5 messages → resolves open issues with no evidence | Guard: only call when `messages.length >= 5` |
| `zalo/listener.js` | gz_members cache timestamp not set on DB error → stampede of failed queries under DB outage | Update `_gzMembersLoadedAt` before `await` to prevent retry flood |
| `app/api/issues/[id]/route.ts` | SQL string interpolation for `resolved_at` (pattern risk) | Replaced with `CASE WHEN $1='resolved' THEN NOW() ELSE NULL END` |
| `app/api/config/route.ts` | No auth check, relied solely on `proxy.ts` middleware; cookie leaked plaintext via RSC payload in `settings/page.tsx` | Added `isAuthenticated()`, AES-256-GCM encryption at rest, mask cookie before it ever leaves the server (page.tsx + API GET) |
| `app/api/auth/route.ts` | No rate limiting — dashboard password brute-forceable | Added `login_attempts` table, 5 failures/10min per IP → 429 |
