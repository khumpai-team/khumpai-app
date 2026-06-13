# RAG Knowledge Base — Implementation Plan

> **For agentic workers:** implement task-by-task (TDD). Steps use `- [ ]`. Needs design sign-off + an embedding deployment + the curated corpus before starting.

**Goal:** Answer patients' education questions ("¿puedo comer arroz?", "¿por qué sube mi azúcar en la mañana?", "¿qué es la hemoglobina glicosilada?") with **grounded, cited, plain-Peruvian-Spanish** answers drawn from an approved corpus (a FAQ base + paraphrased international/National diabetes guidance), never freeform medical advice.

**Architecture:** Curated snippets → embedded with Azure OpenAI embeddings → stored in **Postgres + pgvector** (reuses the DB we already run; no new service). A dedicated `POST /api/rag/ask` endpoint embeds the question, retrieves top-k snippets by cosine similarity, and asks `gpt-5.4-mini` to answer **only from those snippets** with a source citation — or to say it doesn't have enough info. The chat routes education-type questions to this path (the diary builder stays separate).

**Tech:** Postgres `pgvector`, Drizzle `vector` column, Azure OpenAI embeddings (`text-embedding-3-small`, 1536-d) + `gpt-5.4-mini`, Vitest.

---

## Key decisions (confirm/override before building)

1. **Vector store: pgvector in our existing Postgres** (Azure Database for PostgreSQL supports the `vector` extension; local dev switches the Docker image to `pgvector/pgvector:pg16`). *Rationale:* zero new infra, reuses what we deployed. **Future swap:** Azure AI Search behind the same `retrieve()` interface — the chat/endpoint don't change.
2. **Embeddings:** Azure OpenAI **`text-embedding-3-small`** (cheap, 1536-d). Requires an embedding **deployment** in your Azure OpenAI resource → `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`.
3. **Corpus = paraphrased + cited, not verbatim.** International standards (ADA Standards of Care) and MINSA/Peru guidance are copyrighted — we store **plain-language paraphrases with attribution** (`source`, optional `sourceUrl`), not copied text. **A clinician should review the corpus before production.** ~40–60 snippets to start (FAQ + nutrition + glucose basics + foot care + when-to-see-a-doctor).
4. **Grounded + safe answers:** the RAG system prompt forces: answer ONLY from the provided snippets, ALWAYS cite the source, NEVER give a dose/diagnosis (defer to doctor — reuses the 5 rules), and say *"No tengo esa información todavía; pregúntale a tu médico"* when the snippets don't cover it.
5. **Separate from the diary builder.** The model in `/api/agent/chat` stays scoped to `registerEntry`. RAG is its own `/api/rag/ask` path, routed by an education-question detector in `useChat`.

---

## File structure
```
docker-compose.yml                      # MODIFY → image pgvector/pgvector:pg16
server/src/db/schema.ts                 # MODIFY → add `knowledge` table w/ vector column
server/src/data/knowledge.ts            # NEW → curated corpus (paraphrased + sources)
server/src/rag/embed.ts                 # NEW → embed text via Azure OpenAI
server/src/rag/ingest.ts                # NEW → embed corpus → upsert rows (run once)
server/src/rag/retrieve.ts              # NEW → embed query → cosine top-k
server/src/http/rag.route.ts            # NEW → POST /api/rag/ask (SSE grounded answer + citations)
server/src/index.ts                     # MODIFY → mount ragRoute
server/.env.example                     # MODIFY → AZURE_OPENAI_EMBEDDING_DEPLOYMENT
src/agent/ragClient.ts                  # NEW → browser client for /api/rag/ask (SSE)
src/app/useChat.ts                      # MODIFY → detect education Q → RAG path
src/components/chat/* / useChatStore    # MODIFY → render answer + a "Fuente: …" citation chip
```

---

## Task 1 — pgvector + `knowledge` table
- [ ] **docker-compose.yml**: change the postgres image to `pgvector/pgvector:pg16` (drop-in; keeps trust auth + 5433). `docker compose down && up` to pull it.
- [ ] **Migration**: enable the extension and add the table. In a new Drizzle migration (or a pre-migrate SQL): `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] **schema.ts**: add
```ts
import { vector } from 'drizzle-orm/pg-core';
export const knowledge = pgTable('knowledge', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  content: text('content').notNull(),
  source: text('source').notNull(),          // e.g. "ADA 2025", "MINSA"
  sourceUrl: text('source_url'),
  embedding: vector('embedding', { dimensions: 1536 }),
});
```
- [ ] Add an IVFFlat/HNSW index for cosine in the migration: `CREATE INDEX ON knowledge USING hnsw (embedding vector_cosine_ops);`
- [ ] Run `db:generate` + `db:migrate`; verify the table + extension exist. Commit.

## Task 2 — Curate the corpus (`server/src/data/knowledge.ts`)
- [ ] Export `KNOWLEDGE: { id; topic; content; source; sourceUrl? }[]` — ~40–60 paraphrased, plain-Peruvian-Spanish snippets across: glucose basics & ranges (no specific dosing), nutrition (Peruvian foods — link to `peruvian-foods`), sleep↔glucose, foot care, hydration, activity after meals, medication adherence (general, not doses), red-flag/when-to-see-a-doctor, common FAQs. Each ≤ ~100 words, with `source` ("ADA 2025", "MINSA", "OMS") attribution. **Paraphrase, don't copy.** (Seed from the existing hardcoded KB in `src/agent/tools/queryRag.ts`.)
- [ ] Add a top-of-file note: *content paraphrased for education; not a substitute for medical advice; review by a clinician before production.*
- [ ] No test (data). Commit.

## Task 3 — Embedding helper (`server/src/rag/embed.ts`)
- [ ] `export async function embed(texts: string[]): Promise<number[][]>` — call Azure OpenAI embeddings via the `openai`/`AzureOpenAI` client with `model: AZURE_OPENAI_EMBEDDING_DEPLOYMENT`. Batch-friendly. Read the deployment from env; throw a clear error if unset.
- [ ] **Test** (`server/test/embed.test.ts`): mock the OpenAI client; assert `embed(['a','b'])` returns the mocked vectors and calls the embeddings API with the configured model. (No live Azure call in tests.)
- [ ] Commit.

## Task 4 — Ingest script (`server/src/rag/ingest.ts`)
- [ ] `embed(KNOWLEDGE.map(k => k.content))` → upsert each row (`onConflictDoUpdate` by id) with its embedding. Idempotent. Add `"db:ingest": "tsx src/rag/ingest.ts"` to server scripts.
- [ ] Run `npm run db:ingest`; verify `select count(*) from knowledge where embedding is not null` = corpus size. Commit.

## Task 5 — Retrieval (`server/src/rag/retrieve.ts`) — TDD
- [ ] **Test first** (`server/test/retrieve.test.ts`): seed 3 rows with hand-set 3-d embeddings (use a tiny test table or stub `embed` to return known vectors); assert `retrieve('query', 2)` returns the 2 nearest by cosine, each with `{ content, source, score }`.
- [ ] Implement: `export async function retrieve(query: string, k = 4): Promise<{ content: string; source: string; sourceUrl?: string; score: number }[]>` — `embed([query])` → Drizzle/SQL `ORDER BY embedding <=> $queryVec LIMIT k` (cosine distance; `<=>`), map distance→score. Filter out very-low-similarity hits (threshold).
- [ ] Commit.

## Task 6 — `POST /api/rag/ask` (SSE grounded answer) — TDD
- [ ] **Test** (`server/test/rag.route.test.ts`, hermetic): force the "no embedding deployment" path → SSE `error` + `done` (like the agent route's not-configured test), so it's offline-safe and green.
- [ ] Implement `server/src/http/rag.route.ts`: body `{ question }` → `retrieve(question)` → build a RAG prompt:
  - **system (stable, cacheable):** "Eres Khumpi. Responde SOLO con la información de las FUENTES. Cita la fuente al final (Fuente: …). NO des dosis ni diagnósticos — eso lo decide su médico. Si las fuentes no cubren la pregunta, di que no tienes esa información y sugiere preguntar al médico. Español peruano sencillo."
  - **context:** the retrieved snippets (numbered, with their `source`).
  - **user:** the question.
  → stream `chat.completions` text; at the end emit the `sources` used (so the UI shows citations). Reuse the strict-fallback/streaming pattern from `agent.route.ts`. If retrieval is empty → stream the honest "no info" line. Mount in `index.ts`.
- [ ] Verify `cd server && npx tsc --noEmit` + tests green. Commit.

## Task 7 — Chat integration (browser)
- [ ] `src/agent/ragClient.ts`: `askRag(question, onText, onSources)` — POST `/api/rag/ask`, parse SSE (`text` deltas + a final `sources` event + `done`).
- [ ] `useChat.ts`: add an **education-question detector** (deterministic) — e.g. ends with "?" OR matches `/(qu[eé]|c[oó]mo|por qu[eé]|puedo|es bueno|cu[aá]l|cu[aá]nto|sirve|debo evitar)/` AND is NOT a data/guardrail/spike/symptom intent. Route those to `askRag(...)`, streaming Khumpi's answer; render a **citation chip** ("Fuente: ADA 2025"). Keep logging/diary turns on the existing path. (Touches the UI agent's `useChat`/components — coordinate / do when their work has landed.)
- [ ] Add a `ragAnswer` chat item kind (or reuse a message + a citation field) in `useChatStore`; render the source chip in `MessageBubble`/a small component.
- [ ] Verify front tsc + tests green. Commit.

## Task 8 — Replace the mock `queryRag`
- [ ] Repoint `src/agent/tools/queryRag.ts` (and any `clientToolRouter` use) at the real retrieval semantics, or deprecate it in favor of the `/api/rag/ask` path. Keep the `{ content, source }` contract so nothing else breaks. Commit.

---

## Safety & sourcing (non-negotiable for a health app)
- **Grounded only:** the model answers from retrieved snippets; if none are relevant, it says it doesn't know and points to the doctor (no hallucinated medical guidance).
- **Citations always:** every answer shows its `source`.
- **No dosing/diagnosis:** the RAG system prompt + the existing deterministic guardrails both apply.
- **Corpus integrity:** paraphrased, attributed, **clinician-reviewed before production**; tag each snippet's `source`/`sourceUrl` for auditability.

## Future swap (no caller changes)
Replace `retrieve.ts` internals with **Azure AI Search** (vector + semantic) when the corpus grows or you want hybrid keyword+vector ranking — the `retrieve(query,k) → {content,source,score}[]` interface and `/api/rag/ask` stay identical.

## Open items to confirm
- **pgvector vs Azure AI Search** for v1 (recommend pgvector).
- **Embedding deployment** name in your Azure OpenAI (`text-embedding-3-small`).
- **Corpus scope/sources** for v1 (FAQ + ADA/MINSA paraphrases) and who reviews it.
- Whether RAG ships **before or after** the Azure deploy (recommend after — it depends on the embedding deployment + corpus review).
