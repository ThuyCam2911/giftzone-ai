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
│   └── analyzer.js       # Issue detection cron (15min, OpenRouter)
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
- `indexer.js` — 600ms delay between chunks (critical for free-tier rate limit); polls Drive Changes API every 15min
- `analyzer.js` — model fallback chain; XML tags around conversation to prevent prompt injection; 60s delay between groups; `[GZ]`/`[KH]` role tagging from `gz_members` table (no-op if table empty)
- `cookie-extractor.js` — safety: requires `zpsid`/`zpw_sek` and ≥3 cookies before writing DB; does NOT run at startup

### Admin (`giftzone-agent-admin/`)

```
app/
├── api/                  # Next.js API routes (backend-for-frontend)
│   ├── auth/
│   ├── config/
│   ├── groups/
│   ├── gz-members/
│   ├── knowledge/
│   ├── logs/
│   └── overview/
├── analytics/
├── deals/
├── groups/
│   └── [groupId]/        # Group detail page (dynamic route)
├── knowledge-base/
├── logs/
├── overview/
└── settings/
components/
├── ui/                   # Reusable UI primitives (StatsCard, WeekChart)
├── Sidebar.tsx
├── AnalyticsPage.tsx     # Analytics + quality score + unanswered callout
├── DealsPage.tsx
├── GZMemberManager.tsx
├── GroupTypeManager.tsx
├── SettingsForm.tsx
└── SessionAlert.tsx
lib/
├── db.ts                 # pg Pool (separate from backend, avoids ESM/CJS conflict)
├── auth.ts               # HMAC-SHA256 token, gz_session cookie
├── utils.ts
└── queries/              # All DB queries isolated here — pages never write SQL directly
    ├── overview.ts
    ├── logs.ts
    ├── deals.ts
    ├── analytics.ts
    └── group-detail.ts   # getGroupDetail(), getInactiveGroups()
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

### Database Schema (Supabase / pgvector)

| Table | Purpose |
|-------|---------|
| `doc_chunks` | RAG chunks — `embedding vector(1536)`, HNSW `m=16, ef_construction=64` |
| `ai_logs` | AI query/answer log — `sources JSONB`, `latency_ms` |
| `messages` | All Zalo messages (group + 1:1) |
| `settings` | DB-backed config (source of truth over `.env` for most keys) |
| `group_names` | Zalo group metadata + `group_type` (internal/customer) |
| `gz_members` | GiftZone team UIDs — used by analyzer to tag `[GZ]` vs `[KH]` |
| `deals` | Deal tracking per customer per group |
| `deal_events` | Deal stage change history |
| `sales_issues` | Quality issues detected by analyzer (open/resolved) |

All timestamps: `TIMESTAMPTZ`. Group/User IDs: `TEXT` (Zalo IDs are large numbers, string is safer).

### AI Stack (all free-tier)

| Role | Model | Notes |
|------|-------|-------|
| RAG chat | `gemini-2.5-flash-lite` | via `@google/generative-ai` |
| Summary | `gemini-1.5-flash` | daily group summary |
| Embeddings | `gemini-embedding-001` | `outputDimensionality: 1536` |
| Issue detection | `meta-llama/llama-3.3-70b-instruct:free` | via OpenRouter, fallback chain |

Gemini embedding quota resets ~7:00 AM Vietnam time. If exhausted: set `SKIP_INDEX=true`, restart, run `npm run index:drive` after reset.

### Zalo Session Constraints

- **One web connection per account** — close all `chat.zalo.me` tabs before deploying
- Cookie is IP-bound — do NOT create a new session from local VN machine then paste to Render US server; use cookies from an already-trusted session
- `selfListen: false` in production (prevents echo loop)
- Cookie format: J2TEAM array `[{name,value,...}]` — `parseCookie()` handles both array and object

### Deploy

| Service | Platform | Config |
|---------|----------|--------|
| Backend (Sales AI) | Render — `giftzone-ai` | `render.yaml`, account 1, internal sales groups |
| Backend (Deal Monitor) | Render — `giftzone-deal-monitor` | manual, account 2, customer groups |
| Admin Dashboard | Vercel — `giftzone-ai.vercel.app` | root dir: `giftzone-agent-admin` |
| Database | Supabase | project ref: `ytvcmkczealtlvapjjke`, Session Pooler port 5432 |

Vercel env vars (production):
```
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-...pooler.supabase.com:5432/postgres
DASHBOARD_PASSWORD=...
SESSION_SECRET=...
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
GEMINI_API_KEY
OPENROUTER_API_KEY
PG_HOST
PG_PORT=5433
PG_DATABASE          # must set PG_DATABASE=postgres on Render (default is giftzone_agent for local Docker)
PG_USER
PG_PASSWORD
AGENT_NAME=GiftZone AI
SUMMARY_CRON         # default: "0 18 * * 1-5"
SKIP_INDEX           # "true" to skip Drive indexing at startup
LOG_LEVEL            # debug / info / warn / error (default: info)
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
- **OpenRouter fallback chain**: Free models get rate-limited; code tries models in sequence
- **60s delay between groups**: OpenRouter free tier ~3-6 req/min
- **`deal_key` format**: LLM returns `customer_name_no_accents`, code prepends `${groupId}__` — do NOT include group_id in prompt (causes double prefix)
- **`gz_members` role tagging**: Empty table = no tags = behavior identical to before (safe default)
- **Prompt injection guard**: Conversation wrapped in `<conversation>...</conversation>` XML tags

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
- **GitHub SSH remote**: HTTPS returns 403 due to account mismatch (Thuy-Cam vs ThuyCam2911)
- **2 Render accounts**: Account 1 = Sales AI (internal groups), Account 2 = Deal Monitor (customer groups)

---

## Project Status (as of 2026-06-18)

### ✅ Completed features

| Feature | Location | Notes |
|---------|----------|-------|
| RAG agent (Zalo @mention → Gemini answer) | `backend/src/rag/` | Stable, deployed on Render |
| Deal analyzer (issue detection cron) | `backend/src/deal/analyzer.js` | OpenRouter free tier, 15min cron |
| Daily summary (18:00 Mon–Fri) | `backend/src/summary/engine.js` | Sends to each active group |
| **Daily morning alert (8AM)** | `backend/src/alert/daily.js` | ⚠️ Needs backend restart on Render to activate |
| Admin dashboard login + auth | `admin/app/login/`, `proxy.ts` | HMAC-SHA256, hard redirect after login |
| Overview page | `admin/app/overview/` | KPI cards + 7-day chart |
| Logs page | `admin/app/logs/` | AI query log with latency |
| Deals page | `admin/app/deals/` | Deal stage + open issues per group |
| Analytics page | `admin/app/analytics/` | Top questions, doc usage, quality score, unanswered callout |
| **Group detail page** | `admin/app/groups/[groupId]/` | KPI cards, open issues, top senders, AI log |
| **Inactive group detection** | `admin/app/groups/` | Amber banner for groups silent >3 days |
| Settings page (all known keys) | `admin/app/settings/` | `KNOWN_KEYS` pattern — shows all keys even before backend seeds DB |
| GZ Members manager | `admin/components/GZMemberManager.tsx` | Fixed save bug (error feedback + `res.ok` check) |
| Group type manager | `admin/components/GroupTypeManager.tsx` | internal / customer classification |

### ⏳ Pending (user action required)

| Action | Where | Why |
|--------|-------|-----|
| Wait for next Render deploy | Auto on push to main | `alert/daily.js` activates on next restart — code already deployed |

### 🔲 Not yet implemented

- Deal stage tracker (Idea #1 — skipped by choice)
- Push notification / webhook to external systems
- Multi-language support
- User management (multiple manager accounts)

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
