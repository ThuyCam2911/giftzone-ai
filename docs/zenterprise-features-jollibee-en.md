# zEnterprise — Features GiftZone Provides for Jollibee

> Scope: **excludes the automated AI customer-response feature** (Jollibee already has its own AI chatbot — GiftZone would only integrate/connect data if needed, not replace Jollibee's existing AI). This document focuses on **branch-level account management, operational monitoring, and performance analytics** for a direct 1:1 customer messaging model.

---

## 1. zEnterprise Account Management by Branch

Each zEnterprise account represents **one Jollibee branch/store**, messaging customers directly on Zalo.

**Information managed per account:**
- Account name, email, password (stored encrypted)
- **Branch** — e.g. "Jollibee Nguyen Trai", "Jollibee District 7"...
- **Role**: Sales / CS / Manager / Technical
- **Status**: Active / Inactive

**Supported actions**: add / edit / delete accounts through the UI, with a confirmation step before deletion. Quick stat cards: total / active / inactive.

---

## 2. 1:1 Conversation Management (Inbox)

This is the main operational screen, showing every 1:1 conversation between customers and each branch's Zalo account:

- Conversation list: customer name, latest message, unread count
- **Manageable per store**: conversations can be viewed/filtered by individual branch, supporting a multi-store setup
- An indicator shows whether AI is actively replying or a staff member has **taken over**
- **Per-conversation AI on/off toggle** — when off, the system clearly shows "AI paused, staff replying only," preventing AI and staff from replying over each other
- Staff can **type and send messages directly from the Dashboard** — messages are sent over real Zalo, with real-time delivery status

---

## 3. Customer Message Classification — the foundation for order intake

Every incoming customer message is automatically tagged into one of 4 categories:

| Label | Meaning |
|---|---|
| **Order** | Customer placing an order, booking a table, asking about delivery, payment |
| **Complaint** | Customer expressing dissatisfaction, requesting a refund/return |
| **Promotion** | Customer asking about deals, vouchers, combos |
| **Info** | Customer asking about price, address, opening hours, menu |

This labeling lets Jollibee see what percentage of messages are orders vs. complaints, per store, over time. It's a foundation that can be extended into a full order-tracking system (order ID, status, order value) if Jollibee needs it.

---

## 4. Automated Service-Quality Issue Detection (AI-powered)

The system uses AI to periodically scan conversations and automatically detect service-quality issues:

| Issue type | Meaning |
|---|---|
| No reply | Customer hasn't been answered |
| Slow reply | Response took longer than expected |
| Inappropriate tone | Staff behavior/tone was not appropriate |
| Customer complaint | Customer dissatisfaction detected |
| Broken promise | A commitment made to the customer wasn't followed through |
| Missed opportunity | Customer showed interest but wasn't engaged in time |
| Dropped conversation | Conversation left unresolved / abandoned |
| Low engagement | Customer showing little response/interest |
| Negative sentiment | Signs of customer frustration or disappointment |

Each issue is tagged with a priority level (critical / high / medium / low) and can be actioned and marked resolved directly on the Dashboard. The system computes a **Service Quality Score** per branch, making it easy to spot which branch needs attention without manually reading every conversation.

---

## 5. Performance Monitoring Dashboard by Branch

Filterable by **date range** and by **specific branch**.

- Total messages, number of customers, active branches in the period, daily message volume chart
- A branch performance comparison table: message count, open issues, Service Quality Score
- Top customer questions, helping Jollibee understand what customers care about most
- Average response time per branch
- List of unanswered questions — useful for improving service scripts/processes
- Full interaction log, for audit/review purposes

**Custom metrics can be added based on Jollibee's specific needs** — e.g. F&B-industry-specific KPIs, branch-specific targets, or Jollibee's own report format. This may involve additional cost depending on the complexity of the request.

---

## 6. Customization

| Item | Customizable | How |
|---|---|---|
| Dashboard language | Full VI / EN interface | Switch instantly from the Sidebar |
| Number of branches | Unlimited | Add a new zEnterprise account per branch |
| Staff roles | Sales / CS / Manager / Technical | Display label, used for filtering/analysis |
| System configuration | Display name, reporting schedule, etc. | Applied instantly, no redeployment needed |
| Scoring formulas / metrics | Customizable to a formula Jollibee provides | Implemented by GiftZone's engineering team per specific request |

---

## 7. Value Summary for Jollibee

Excluding the customer-facing AI (which Jollibee already has), GiftZone provides a **multi-branch operations monitoring and optimization layer for 1:1 messaging**:

1. Centralized account management by branch
2. Real per-store Inbox: view 1:1 conversations, toggle AI per case, staff can reply manually when needed
3. Automatic order/complaint/promotion/info message tagging — a foundation for a full order-tracking system
4. AI-powered automatic detection of service-quality issues, scored and compared across branches
5. Branch performance dashboard, extendable with custom metrics as needed
6. Ready to integrate Jollibee's own AI if needed, rather than requiring GiftZone's AI
