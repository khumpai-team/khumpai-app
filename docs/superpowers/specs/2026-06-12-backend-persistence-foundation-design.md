# Khumpai — Backend & Persistence Foundation (Spec 1)

**Date:** 2026-06-12
**Status:** Approved (approach delegated to engineering judgment, anchored to the PRD)
**Next spec:** Model-driven Diary Builder (Spec 2) — builds on this.

---

## 1. Context & goal

Today Khumpai is client-only: state lives in a Zustand store persisted to
`sessionStorage` (ephemeral, per-tab, single-device), and the Azure OpenAI call
runs through a **dev-only** Vite middleware proxy that does not exist in a
production build.

**Goal:** durable persistence behind a real Azure backend, and migrate the model
proxy into that backend — retiring the dev-only gap. This is the foundation the
model-driven Diary Builder (Spec 2) needs to persist confirmed entries and host
the real model call.

**PRD alignment.** The agent seam stays intact: the UI keeps speaking the
`AgentProvider` interface, safety (guardrails / red-flags) stays deterministic in
`useChat`, and honesty/offline behavior is preserved. Nothing here changes the
Mock↔Foundry swappability — it makes the Foundry side production-real.

## 2. Locked decisions

- **Azure-native API + Postgres** for persistence.
- **Stack:** standalone **Express** API (`/server`), **Drizzle ORM**, **Azure
  Database for PostgreSQL (Flexible Server)**. (Alts considered: Fastify — fine;
  Azure Functions — awkward for SSE streaming; Prisma — heavier than Drizzle.)
- **Auth: mocked single-user** (Carlos) for now. Schema is multi-user-ready
  (`user_id` FK) so real auth slots in later without a migration. Real auth is
  out of scope.
- Diary generation goes **model-driven + confirm card** — but that lands in
  Spec 2; this spec only makes the persistence + proxy real.

## 3. Architecture

```
Browser (Vite/React)
  │  zustand store (in-memory cache, same action surface)
  │  repository layer  src/lib/api/*   ── fetch/SSE ──┐
  ▼                                                    ▼
Vite dev: server.proxy  /api  ───────────────►  Express API  (/server)
                                                   │  Drizzle ORM
                                                   ▼
                                          Azure Database for PostgreSQL
                                                   ▲
                                  /api/agent/chat ──┘ (Azure OpenAI, key server-side)
```

- **Dev:** Vite `server.proxy` forwards `/api` → `http://localhost:8787` (the
  Express server). The current `foundryProxyPlugin` Vite middleware is **removed**;
  its logic moves into the Express route `POST /api/agent/chat`.
- **Prod:** API deployed to Azure Container Apps (or App Service); Postgres on
  Flexible Server. The browser bundle stays SDK/secret-free.

## 4. Database schema (Drizzle / Postgres)

One row per domain entity, scoped by `user_id` (and `person_id` where relevant).
`logs.payload` is **JSONB** to mirror the `LogEntry` discriminated union.

| Table | Key columns |
| --- | --- |
| `users` | id, name, created_at *(seed: Carlos)* |
| `persons` | id, user_id, name, relation, color |
| `logs` | id, person_id, type, timestamp, created_at, edited_at, source, confirmed, is_offline_capture, **payload JSONB** |
| `medications` | id, person_id, name, dose, frequency, schedule (text[]), adherence_log JSONB |
| `doctor_notes` | id, person_id, text, timestamp, source, for_question |
| `doctor_visits` | id, person_id, date, what_doctor_said, indications (text[]), next_appointment |
| `insights` | id, person_id, pattern, confidence, based_on_count, text, chart_data JSONB |
| `achievements` | id, user_id, title, description, unlocked_at, icon |
| `user_prefs` | user_id (PK), prefs JSONB |
| `emergency_contacts` | id, user_id, name, phone, relation, is_caregiver_user |

- **Migrations:** Drizzle Kit (`drizzle/` migrations committed).
- **Seed:** a `seed` script ports the existing `SEED_STATE` (Carlos's 10 days)
  into the DB so the demo is identical on first run.

## 5. API surface (Express, Zod-validated bodies)

- `GET  /api/state` — bootstrap the full `AppState` for the current user (one call
  on app load).
- `POST /api/logs` — create a log (confirmed or pending).
- `PATCH /api/logs/:id` — edit; `POST /api/logs/:id/confirm` — idempotent confirm.
- `POST /api/logs/batch` — flush the offline sync queue (chronological).
- `POST /api/doctor-notes`, `POST /api/medications/:id/adherence`,
  `POST /api/doctor-visits`, `PATCH /api/prefs`, `POST /api/achievements`.
- `POST /api/agent/chat` — the migrated streaming (SSE) proxy to Azure OpenAI
  (key stays server-side). Same SSE event protocol the browser orchestrator
  already speaks.

Request/response validation reuses the domain types via Zod schemas shared from
`src/types` where practical.

## 6. Client integration (persistence sync)

Keep Zustand as the **in-memory cache with the same action surface** so screens
and `useChat` barely change. Add a thin **repository layer** (`src/lib/api/`):

- **Bootstrap:** on app load, `GET /api/state` hydrates the store (replaces
  reading from `sessionStorage`).
- **Write-through:** store actions (`addLog`, `confirmLog`, `logMedicationTaken`,
  …) optimistically update memory **and** POST to the API; on failure they fall
  back to the offline queue.
- **Offline:** the existing `syncQueue` is preserved; on reconnect it flushes to
  `POST /api/logs/batch` (chronological order, idempotent by id).
- `sessionStorage` persistence is removed as the source of truth; an optional
  lightweight cache may remain for instant cold-start, with the server
  authoritative.

The store keeps its current action names/signatures, so the UI agent's screens
and `useChat` are largely untouched.

## 7. Security

- Azure OpenAI **API key and Postgres connection string live only on the server**
  (`/server/.env`, gitignored). Never shipped to the browser.
- CORS locked to the app origin.
- No secrets in `VITE_*` vars.

## 8. Testing

- **API integration tests** (supertest) against a throwaway test Postgres
  (Docker), covering each endpoint + idempotent confirm + batch flush ordering.
- **Repository-layer tests** for the client sync (bootstrap, write-through,
  offline-flush) with the API mocked.
- The existing **155 unit tests stay green** (pure libs/tools unchanged).

## 9. Scope / non-goals (Spec 1)

- ❌ Real authentication / multi-tenant security (mocked single-user now).
- ❌ Multi-device realtime sync.
- ❌ The model-driven diary craft (strict tools, prompt caching, few-shots) — that
  is **Spec 2**.
- ❌ Production deployment automation (we make it deploy-*able*; CI/CD is later).

## 10. Risks & mitigations

- **SSE through the Vite dev proxy → Express:** verify streaming isn't buffered
  (disable proxy buffering; `text/event-stream`). Mitigation: smoke-test
  `/api/agent/chat` early, as we did with the dev middleware.
- **Dirty shared working tree:** the UI agent commits to `main`; coordinate a
  clean commit boundary for the `/server` addition and the store change.
- **Store-swap regressions:** keeping the action surface identical and bootstrapping
  from `GET /api/state` minimizes UI churn; covered by repository tests.

## 11. Spec 2 preview — Model-driven Diary Builder (next)

Built on this foundation; captured here so it isn't lost:

- **Strict `registerEntry` tool** (`strict: true`, `additionalProperties: false`,
  all-required-with-nullable-optionals) so the model emits the exact `LogEntry`
  payload shape — eliminating the `context`-vs-`moment` class of bug at the source.
  Verify the Azure API version supports strict tools on `gpt-4.1`.
- **Cache-friendly prompt structure:** stable prefix (system prompt + tool schemas
  + 2-3 Peruvian few-shots) ≥1024 tokens placed FIRST; dynamic content (current
  datetime, compact patient context, the user turn) placed LAST → maximizes Azure
  automatic prompt-cache hits. Track `cached_tokens`.
- **Context management:** send a rolling window of recent turns + a short
  structured patient-context block, not the full transcript.
- **Mock removal:** the normal logging path goes fully model-driven; the
  deterministic parser is retained only for offline + the safety gates.
