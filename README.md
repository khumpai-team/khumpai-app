# Khumpai 🫶

**A conversational AI health companion for people living with type 2 diabetes in Peru.**

Khumpai (*"compañero"* in spirit) turns the daily work of managing diabetes into a
warm chat in Peruvian Spanish. You tell it what you ate, what your glucometer
said, how you slept — by **voice, photo, or text** — and it keeps your diary,
spots patterns, answers questions from trusted sources, and knows when to gently
push you toward your doctor. It works for the patient *and* for the family member
who helps care for them.

> ⚠️ **Not a medical device.** Khumpai never prescribes, diagnoses, or adjusts
> medication. It logs, educates from cited sources, and escalates to a clinician.
> The knowledge base is paraphrased from public guidance (ADA / MINSA / OMS) and
> needs clinician review before any real-world use.

---

## Why it exists

Type 2 diabetes management is relentless and mostly invisible: meals, readings,
sleep, stress, foot care, a dozen small decisions a day. Many patients in Peru
manage it with low digital literacy, intermittent connectivity, and limited time
with a doctor. Khumpai meets them where they are — a single friendly thread that's
**spoken-first**, **offline-tolerant**, and **safe by design**.

---

## What it does

- 🗣️ **Talk to your diary** — speak (`es-PE` speech-to-text), type, or snap a photo
  of your glucometer/plate/pill; the model extracts a structured entry and shows a
  **confirmation card** before anything is saved (human-in-the-loop).
- 📈 **Patterns, not just numbers** — surfaces gentle insights (e.g. *short sleep →
  higher morning sugar*) and a calm **spike → why → one action** flow when a reading
  runs high, instead of an alarming alert.
- 📚 **Grounded answers with citations** — education questions (*"¿puedo comer
  arroz?"*, *"¿por qué sube el azúcar en la mañana?"*) are answered **only** from a
  curated knowledge base via retrieval, with tappable **source chips** (ADA/MINSA/OMS).
  No source, no answer — it defers to your doctor.
- 🛟 **Safety rails that don't depend on the model** — deterministic guardrails refuse
  dose/diagnosis/stop-medication questions, a **red-flag triage** opens an emergency
  card for urgent symptoms, and a prompt-injection guard runs before any model call.
- 👪 **Caregiver mode** — log on behalf of a parent ("a mi papá le subió a 200"),
  with a person picker and a per-patient portfolio.
- 🩺 **Doctor report** — auto-builds notes and questions to bring to the next visit.
- 📴 **Offline demo** — entries queue locally and get deterministic local replies;
  they sync when the connection returns.
- 🏅 **Streaks & a daily morning check-in** to make the habit stick.

---

## Architecture

Khumpai is a **React SPA** plus a small **Express + Postgres** backend that also
acts as the secure proxy to **Azure OpenAI** (the browser never holds the API key).
In production it ships as **one container** — Express serves both `/api/*` and the
built SPA from the same origin.

```
                         ┌──────────────────────────────────────────┐
  Browser (React SPA)    │            Express API (server/)           │
  ─────────────────────  │  ───────────────────────────────────────  │
  useChat  ── the only   │  /api/state · /api/logs · /api/entities    │   ┌────────────┐
  consumer of the agent  │     └─ write-through persistence  ─────────┼──▶│  Postgres   │
  event stream           │  /api/agent/chat   (SSE proxy) ────────────┼─┐ │ (Drizzle ORM)│
        │                │  /api/rag/ask      (SSE, grounded+cited) ──┼─┤ └────────────┘
        ▼                │     └─ retrieve(): Spanish full-text search │ │
  AgentProvider (seam)   │  static dist/  (the built SPA in prod)      │ │ ┌──────────────┐
   ├─ MockAgentProvider  └────────────────────────────────────────────┘ └▶│ Azure OpenAI │
   └─ FoundryAgentProvider ─────────────────────────────────────────────  │ gpt-5.4-mini │
                                                                           └──────────────┘
  (optional, dormant unless configured) Azure App Insights · Azure AI Content Safety
```

**The agent seam.** All UI ↔ model interaction goes through one streaming
interface (`AgentProvider`): `sendMessage()` yields `text_*` / `tool_call` / `done`
events, and `provideToolResult()` resumes a turn after the user confirms a card.
Two implementations satisfy it — a deterministic `MockAgentProvider` (offline demo,
fully testable) and the `FoundryAgentProvider` (real Azure OpenAI). Swapping them is
a single env flag; **no UI changes required**.

**Retrieval (RAG).** Lexical, not vector — Postgres `to_tsvector('spanish')` +
`ts_rank` with an `ILIKE` fallback over a curated 40-entry corpus. It needs no
embedding deployment, so it works the moment the DB is seeded. The `retrieve()`
signature is stable, so an upgrade to pgvector/embeddings is a drop-in swap.

---

## Tech stack

| Layer | Choices |
|---|---|
| **Frontend** | React 18, TypeScript (strict), Vite, Zustand, Tailwind CSS, Framer Motion, React Router |
| **Agent** | Streaming `AgentProvider` seam · Azure OpenAI (`gpt-5.4-mini`) via the `openai` `AzureOpenAI` client · strict function tools · prompt caching |
| **Voice / Vision** | Web Speech API (`es-PE`) · model vision for photo attachments |
| **Backend** | Express, Drizzle ORM, PostgreSQL, Server-Sent Events, Zod validation |
| **RAG** | Postgres Spanish full-text search + `ILIKE` fallback (lexical) |
| **Observability / Safety** | Azure Application Insights · Azure AI Content Safety *(both scaffolded, dormant unless configured)* |
| **Testing** | Vitest (+ Supertest) — 226 front-end tests, server route/retrieval tests |
| **Deploy** | Single Docker container → Azure Container Apps |

---

## Getting started

### Prerequisites
- Node.js 22+
- Docker (for local Postgres)
- *(optional)* an Azure OpenAI deployment for the real model; without it, the app
  runs against the deterministic mock provider.

### 1. Install
```bash
npm install
cd server && npm install && cd ..
```

### 2. Start Postgres + migrate + seed
```bash
docker compose up -d            # Postgres on host port 5433
cd server
cp .env.example .env            # then fill DATABASE_URL (+ AZURE_OPENAI_* for the real model)
npm run db:migrate
npm run db:seed                 # demo patient "Carlos" + 10 days of data
npm run db:ingest               # load the RAG knowledge base
cd ..
```

### 3. Run
```bash
# terminal 1 — API (http://localhost:8787)
cd server && npm run dev
# terminal 2 — SPA (http://localhost:5173, proxies /api → :8787)
npm run dev
```

Open **http://localhost:5173**.

### Provider toggle
The root `.env` selects the agent backend:
```bash
VITE_AGENT_PROVIDER=foundry   # real Azure OpenAI  (omit / "mock" for the offline demo)
```

### Environment variables

**`server/.env`**
| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | e.g. `postgres://postgres:postgres@localhost:5433/khumpai` (prod: add `?sslmode=require`) |
| `AZURE_OPENAI_ENDPOINT` | for real model | base resource URL, e.g. `https://<res>.cognitiveservices.azure.com/` |
| `AZURE_OPENAI_API_KEY` | for real model | kept server-side only |
| `AZURE_OPENAI_DEPLOYMENT` | | defaults to `gpt-4.1`; set to `gpt-5.4-mini` |
| `AZURE_OPENAI_API_VERSION` | | e.g. `2025-04-01-preview` |
| `PORT` / `ALLOWED_ORIGIN` | | default `8787` / `http://localhost:5173` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | optional | lights up tracing |
| `CONTENT_SAFETY_ENDPOINT` / `CONTENT_SAFETY_KEY` | optional | input moderation |

> Secrets live only in gitignored `.env` files (and Container App secrets in prod).
> They are never baked into the image.

---

## Testing

```bash
npm test                 # front-end (Vitest) — 226 tests
cd server && npm test    # backend (Vitest + Supertest); needs Postgres up for DB tests
```

The deterministic safety logic (guardrails, red-flag triage, the education detector,
offline rules) is unit-tested independently of the model — those tests are the
backbone of "safe by design."

---

## Deploy

One container serves the API and the built SPA from a single origin. See
[`DEPLOY.md`](./DEPLOY.md) for the full Azure Container Apps walkthrough.

```bash
docker build -t khumpai .
az containerapp up --name khumpai --resource-group <rg> \
  --source . --target-port 8787 --ingress external \
  --env-vars DATABASE_URL=… AZURE_OPENAI_ENDPOINT=… AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini …
```

---

## Project structure

```
src/
  agent/        AgentProvider seam · Mock + Foundry providers · parser · tools · guardrails · RAG detector
  app/          useChat — the single orchestration seam · speech-to-text · offline hooks
  components/   chat · cards (confirm/insight/action/safety) · khumpi avatar · notifications · report
  screens/      Chat · Home · Journal · Report (doctor) · Caregiver · Settings · Onboarding
  store/        Zustand stores (app state, chat transcript, session)
  data/         seed data · Peruvian foods · Spanish i18n
  types/        the canonical domain model (the locked contract)
server/
  src/http/     state · logs · entities · agent (SSE proxy) · rag (SSE, grounded) routes
  src/rag/      retrieve() (Spanish FTS) · ingest
  src/data/     knowledge.ts — curated diabetes corpus (ADA/MINSA/OMS, paraphrased)
  src/db/       Drizzle schema · client · seed
docs/superpowers/  design specs and implementation plans
```

---

## Status & disclaimer

Khumpai is a **hackathon project / prototype**. It is **not** a certified medical
device and must not be used for diagnosis or treatment decisions. The knowledge
base is paraphrased from public sources and requires professional clinical review
before any real deployment. Always consult a qualified healthcare provider.

Built with care for the people who manage diabetes every day. 🇵🇪
