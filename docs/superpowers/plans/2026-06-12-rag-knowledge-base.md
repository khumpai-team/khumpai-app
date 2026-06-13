# RAG Education Feature (Server-Side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Postgres full-text (Spanish, lexical) diabetes knowledge base with a grounded SSE `/api/rag/ask` endpoint — no embeddings, no extra Azure deployment.

**Architecture:** Curated knowledge entries live in `server/src/data/knowledge.ts` and are upserted into a `knowledge` Postgres table. At query time, `retrieve()` does Spanish FTS with ILIKE fallback. The `/api/rag/ask` route retrieves hits, calls Azure OpenAI with a strict system prompt, streams text deltas, and emits a `sources` event at the end.

**Tech Stack:** Drizzle ORM (postgres-js), Express SSE pattern (mirrors agent.route.ts), Azure OpenAI streaming, Vitest, Supertest.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/src/db/schema.ts` | Modify | Add `knowledge` table definition |
| `server/drizzle/*` | Generated | Migration SQL for new table |
| `server/src/data/knowledge.ts` | Create | 40-entry curated Peruvian-Spanish corpus |
| `server/src/rag/ingest.ts` | Create | Upsert all KNOWLEDGE rows, exit(0) |
| `server/src/rag/retrieve.ts` | Create | FTS + ILIKE fallback retrieve() |
| `server/src/http/rag.route.ts` | Create | POST /api/rag/ask SSE endpoint |
| `server/src/index.ts` | Modify | Mount ragRoute |
| `server/package.json` | Modify | Add db:ingest script |
| `server/test/retrieve.test.ts` | Create | Real-DB retrieve() tests |
| `server/test/rag.route.test.ts` | Create | Hermetic SSE error-path test |

