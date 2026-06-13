# RAG from PDFs (pgvector) + Offline Knowledge Digest — Design

**Date:** 2026-06-12
**Status:** Approved (design), pending spec review

## Goal

Turn the 18 curated diabetes PDFs in `docs/rag-docs/` into the app's real
knowledge base, served two ways:

- **Online**: semantic retrieval over PDF-derived chunks using Azure embeddings
  (`text-embedding-3-small`) + Postgres **pgvector**.
- **Offline**: a small curated digest, distilled from the same PDFs and bundled
  in the SPA, so education questions get real (local, keyword-matched) answers
  with no signal — instead of only a "I'll review it when signal returns" line.

This replaces the placeholder corpora (the server's hardcoded 40-entry
`knowledge.ts` and the client's 15-entry `queryRag` KB) with content derived from
the real documents.

## Non-goals

- OCR of scanned/image PDFs (text-PDFs only; image-only docs are flagged + skipped).
- In-browser semantic embeddings (offline stays lexical — keyword match over the digest).
- Re-architecting `rag.route.ts` or the chat-UI integration (both already shipped;
  only `retrieve()` changes underneath, and the offline branch gains an education path).
- Dose/diagnosis content (guardrails still own that; the corpus carries reminders only).

## Architecture

One dev-time pipeline processes the PDFs once into clean, attributed chunks. That
shared corpus feeds two independent retrieval paths.

```
docs/rag-docs/*.pdf
      │  (dev-time ingest pipeline)
      ▼
  extract (unpdf) → chunk (~600 tok, ~80 overlap) → attribute (source + topic via manifest)
      │                                                         │
      ▼ embed each chunk (Azure text-embedding-3-small, 1536)   ▼ distill ~40–60 concise Q&A
  ┌───────────────────────────────┐                      ┌───────────────────────────────┐
  │ Postgres: knowledge            │                      │ src/data/knowledge-offline.ts │
  │   + embedding vector(1536)     │  ← ONLINE            │   (bundled in the SPA, ~100KB) │ ← OFFLINE
  │   + HNSW index                 │                      └───────────────────────────────┘
  └───────────────────────────────┘                              ▲
      ▲                                                    queryRag(): local keyword match
  retrieve(): embed query → pgvector cosine (<=>)                 │
      ▲                                                           │
  POST /api/rag/ask (has signal)                          useChat offline branch (no signal)
          └────────────────── same UX: streamed bubble + source chip ─────────────────┘
```

## Subsystem A — Online semantic RAG

### A1. Extraction + attribution
- `server/src/rag/pdf/extract.ts` — read each PDF with **`unpdf`** (pure-JS, ESM,
  no native deps), return `{ file, text, charCount }`. Collapse whitespace; strip
  obvious page-number/header noise.
- `server/src/rag/manifest.ts` — maps each of the 18 filenames to a clean
  `{ source, sourceUrl?, topic }`. Honors the parenthetical hints in the filenames:
  - *"Guias alimentarias en la poblacion peruana …"* → used for **which Peruvian
    foods exist**, not diabetes-diet advice (topic: `alimentos-peru`).
  - *"Tablas peruanas de composición …"* → detailed/optional → **online only**, not
    in the offline digest (topic: `composicion-alimentos`).
  - Source labels: ADA, OPS, CDC, MINSA / "Guías peruanas", etc.
- **Risk handling**: any PDF whose `charCount` is below a threshold (~200 chars) is
  treated as scanned/image-only — logged with a warning and **skipped** (no empty
  chunks shipped). The ingest summary prints which docs were used vs skipped.

### A2. Chunking
- `server/src/rag/pdf/chunk.ts` — split each doc's text into ~600-token chunks with
  ~80-token overlap, preferring paragraph/sentence boundaries. Each chunk →
  `{ id, docId, source, sourceUrl, topic, content }`. `id` is deterministic
  (`<docId>-<index>`) so re-ingest upserts cleanly.

### A3. Embedding + storage (pgvector)
- **Extension/infra**: migration runs `CREATE EXTENSION IF NOT EXISTS vector;`.
  Local `docker-compose.yml` switches the DB image to `pgvector/pgvector:pg16`.
  Azure Database for PostgreSQL Flexible Server: allowlist the `vector` extension.
- **Schema** (`server/src/db/schema.ts`): the `knowledge` table gains
  `embedding vector(1536)` (nullable) plus `doc_id text`. A Drizzle `customType`
  defines the `vector` column; a follow-on migration adds an **HNSW** index
  (`USING hnsw (embedding vector_cosine_ops)`).
- **Embedding client** (`server/src/rag/embed.ts`): wraps `AzureOpenAI.embeddings`
  using `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`. Exposes `embedOne(text)` and
  `embedMany(texts[])` (batched). Returns `null` when the embedding deployment is
  unconfigured, so callers can fall back gracefully.
- **Ingest** (`server/src/rag/ingest.ts`, rewritten): extract → chunk → `embedMany`
  → upsert rows (content, attribution, embedding) into `knowledge`. Prints a summary
  (docs used/skipped, chunk count, embedded count). Idempotent via deterministic ids.

### A4. Retrieval
- `server/src/rag/retrieve.ts`: if an embedding deployment is configured, embed the
  query and run `ORDER BY embedding <=> $1 LIMIT k` (cosine distance), mapping the
  distance to a `score`. **If embeddings are unconfigured or fail, fall back to the
  existing lexical FTS + ILIKE path** — so a no-embedding setup (and the current
  test suite) keeps working unchanged.
- `RetrieveResult` shape is unchanged (`content, source, sourceUrl?, score`), so
  `rag.route.ts` needs no changes.

### A5. Config
- `server/src/env.ts`: add `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` (optional string).
  `server/.env.example` documents it. Embeddings reuse the existing endpoint/key.

## Subsystem B — Offline curated digest

### B1. The digest
- `src/data/knowledge-offline.ts` — ~40–60 concise, paraphrased Spanish snippets
  distilled from the PDFs, each `{ id, topic, keywords[], content, source }`.
  Coverage: plate method, carbs/fiber, hidden sugars, eating out / buffet / parties,
  desserts, foot care, physical activity (incl. elderly), medication **reminders only**
  (take with food, never change dose alone), complications, doctor visits, and
  Peruvian-food guidance. Excludes the detailed composition table.
- This is **static, pre-generated content** (no runtime generation), shipped in the
  bundle. It replaces the placeholder `KNOWLEDGE_BASE` inside `queryRag`.

### B2. Retrieval (client, offline)
- `src/agent/tools/queryRag.ts` keeps its signature (`queryRag(query): RagResult | null`)
  and its `findFood` integration, but sources its KB from `knowledge-offline.ts`
  (expanded 15 → ~50 entries). Matching stays normalized keyword/topic lookup.

### B3. Wiring
- `src/app/useChat.ts` offline branch: when `isEducationQuestion(trimmed)` matches,
  call `queryRag(trimmed)`; on a hit, stream the snippet content + attach a source
  chip (with a subtle "sin conexión — información general" framing). On a miss, keep
  the existing warm acknowledgement (`getOfflineResponse`). Online education is
  unchanged (`/api/rag/ask`).

## Data flow summary

| Scenario | Path | Retrieval | Source of truth |
|---|---|---|---|
| Online education Q | `useChat → /api/rag/ask` | embed query → pgvector | `knowledge` table (PDF chunks) |
| Offline education Q | `useChat` offline branch | `queryRag` keyword match | `knowledge-offline.ts` (digest) |
| No embedding configured | `/api/rag/ask` | lexical FTS fallback | `knowledge` table |

## Error handling
- Scanned PDF → flagged + skipped (never ship empty chunks).
- Embedding deployment down/unset → retrieve falls back to lexical FTS; ingest logs
  that chunks were stored without embeddings.
- Offline digest miss → warm acknowledgement (no fabricated medical content).
- `/api/rag/ask` already degrades to "ask your doctor" when retrieval is empty.

## Testing
- `chunk.ts` — deterministic unit tests (sizes, overlap, boundary handling).
- `manifest.ts` — maps all 18 filenames; every file has a source + topic.
- `retrieve()` — lexical-fallback path stays green with no embeddings; semantic path
  tested against a tiny seeded embedded set.
- Offline education — `queryRag` returns expected snippets for common questions;
  `useChat` offline branch streams a digest answer for an education question and a
  warm ack for a non-education one.
- `rag.route` hermetic test — unchanged.

## New dependencies
- `unpdf` (server) — PDF text extraction.
- `pgvector/pgvector:pg16` (local Docker image).
- Azure: a `text-embedding-3-small` deployment (provisioned during the Azure deploy).

## Build order
1. Infra: pgvector image + extension migration; embedding env + client.
2. PDF pipeline: extract + manifest + chunk (testable offline).
3. Ingest + schema embedding column + semantic retrieve (with lexical fallback).
4. Offline digest generation + `queryRag` swap + `useChat` offline wiring.
