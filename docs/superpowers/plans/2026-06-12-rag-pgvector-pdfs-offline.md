# RAG from PDFs (pgvector) + Offline Knowledge Digest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 18 diabetes PDFs in `docs/rag-docs/` into the app's real knowledge base — semantic pgvector retrieval online, and a bundled curated digest offline.

**Architecture:** A dev-time pipeline extracts PDF text (`unpdf`) → chunks (~600 tokens) → embeds via Azure `text-embedding-3-small` → stores in Postgres `knowledge.embedding vector(1536)` (pgvector). `retrieve()` embeds the query and does cosine search, falling back to the existing lexical FTS when embeddings are unconfigured. A separate curated digest distilled from the same PDFs ships in the SPA (`knowledge-offline.ts`) and answers education questions offline via the existing `queryRag` keyword matcher.

**Tech Stack:** Node/Express, Drizzle ORM (postgres-js), PostgreSQL + pgvector, Azure OpenAI embeddings, `unpdf`, Vitest. Front-end: React, Zustand, Vitest.

---

## Critical conventions (read first)

- **Subagent git rules:** scoped `git add <files>` only — never `git add -A`, never `git stash/reset/checkout/rebase/branch`, never docker/destructive psql. Commit on the current branch (`feat/notifications`).
- **pgvector DDL lives outside drizzle-kit.** drizzle-kit can't model the `vector` type, the `vector` extension, or HNSW indexes. We apply that DDL through an idempotent `ensureVectorSchema()` and read/write the vector column with **raw SQL** (`db.execute(sql\`…\`)`), exactly like the existing `retrieve.ts`. The drizzle `knowledge` table simply gains a `docId` text column; the `embedding` column is unmanaged by drizzle (extra columns are ignored by the ORM).
- **Embeddings are optional at runtime.** If `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` is unset, `embedOne/embedMany` return `null` and `retrieve()` falls back to lexical FTS. This keeps the current test suite green without an embedding deployment.
- **Local DB needs pgvector.** The compose image becomes `pgvector/pgvector:pg16`. After changing it you must recreate the container (a human step — subagents must NOT run docker): `docker compose down && docker compose up -d`.
- **Typecheck commands:** front-end `npx tsc --noEmit` (NOT `tsc -b`); server `cd server && npx tsc --noEmit`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/package.json` | Modify | Add `unpdf` dependency |
| `docker-compose.yml` | Modify | DB image → `pgvector/pgvector:pg16` |
| `server/src/env.ts` | Modify | Add `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` |
| `server/.env.example` | Modify | Document the new env var |
| `server/src/rag/ensureSchema.ts` | Create | Idempotent pgvector DDL (extension + column + HNSW index) |
| `server/src/rag/manifest.ts` | Create | Filename → `{ source, sourceUrl?, topic }` for all 18 PDFs |
| `server/src/rag/pdf/extract.ts` | Create | PDF → text via `unpdf`, with char-count guard |
| `server/src/rag/pdf/chunk.ts` | Create | Token-ish chunker (~600 words, ~80 overlap) |
| `server/src/rag/embed.ts` | Create | Azure embeddings client (`embedOne`, `embedMany`) |
| `server/src/rag/ingest.ts` | Rewrite | extract → chunk → embed → raw-SQL upsert |
| `server/src/rag/retrieve.ts` | Modify | Semantic (embed query → pgvector) + lexical fallback |
| `server/src/db/schema.ts` | Modify | Add `docId` to `knowledge` |
| `server/test/manifest.test.ts` | Create | All 18 files mapped |
| `server/test/chunk.test.ts` | Create | Chunk sizes/overlap/boundaries |
| `server/test/extract.test.ts` | Create | Real-PDF extraction smoke (char count) |
| `server/test/embed.test.ts` | Create | Returns null when unconfigured |
| `src/data/knowledge-offline.ts` | Create | ~40–60 curated Spanish snippets from the PDFs |
| `src/agent/tools/queryRag.ts` | Modify | Source KB from `knowledge-offline.ts` |
| `tests/queryRagOffline.test.ts` | Create | Digest lookups for common questions |
| `src/app/useChat.ts` | Modify | Offline education branch via `queryRag` |
| `tests/offlineEducation.test.ts` | Create | Offline education answer + non-education ack |

---

## SUBSYSTEM A — Online semantic RAG

### Task 1: Infra — deps, pgvector image, env, vector DDL

**Files:**
- Modify: `server/package.json`
- Modify: `docker-compose.yml`
- Modify: `server/src/env.ts`
- Modify: `server/.env.example`
- Create: `server/src/rag/ensureSchema.ts`

- [ ] **Step 1: Install unpdf**

Run (from `server/`): `npm install unpdf@^0.12.0`
Expected: `unpdf` appears in `server/package.json` dependencies; lockfile updated.

- [ ] **Step 2: Switch the DB image to pgvector**

In `docker-compose.yml`, change the postgres service image line:
```yaml
    image: pgvector/pgvector:pg16
```
(Leave the env, `POSTGRES_HOST_AUTH_METHOD: trust`, and `"5433:5432"` port mapping unchanged.)

- [ ] **Step 3: Add the embedding env var**

In `server/src/env.ts`, add to the `Env` object (after `AZURE_OPENAI_API_VERSION`):
```ts
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: z.string().optional(),
```

In `server/.env.example`, add a line:
```
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
```

- [ ] **Step 4: Create the idempotent pgvector DDL helper**

Create `server/src/rag/ensureSchema.ts`:
```ts
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

/**
 * Apply the pgvector schema additions idempotently. Kept OUTSIDE drizzle-kit
 * because it can't model the `vector` type, the extension, or HNSW indexes.
 * Safe to call repeatedly (every clause is IF NOT EXISTS).
 */
export async function ensureVectorSchema(): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await db.execute(sql`ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS doc_id text`);
  await db.execute(sql`ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS embedding vector(1536)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS knowledge_embedding_idx
        ON knowledge USING hnsw (embedding vector_cosine_ops)`,
  );
}
```

- [ ] **Step 5: Add `docId` to the drizzle schema**

In `server/src/db/schema.ts`, extend the `knowledge` table definition:
```ts
export const knowledge = pgTable('knowledge', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  content: text('content').notNull(),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
  docId: text('doc_id'),
});
```
(The `embedding` column is intentionally absent from the drizzle schema — it's managed by `ensureVectorSchema` and accessed via raw SQL.)

- [ ] **Step 6: Verify it compiles**

Run (from `server/`): `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json docker-compose.yml server/src/env.ts server/.env.example server/src/rag/ensureSchema.ts server/src/db/schema.ts
git commit -m "feat(rag): pgvector infra — unpdf, pgvector image, embedding env, vector DDL"
```

---

### Task 2: Document manifest (filename → source + topic)

**Files:**
- Create: `server/src/rag/manifest.ts`
- Test: `server/test/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MANIFEST, manifestFor } from '../src/rag/manifest.js';

const DOCS_DIR = resolve(__dirname, '../../docs/rag-docs');

describe('rag manifest', () => {
  it('has an entry for every PDF in docs/rag-docs', () => {
    const pdfs = readdirSync(DOCS_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
    expect(pdfs.length).toBeGreaterThan(0);
    for (const f of pdfs) {
      const m = manifestFor(f);
      expect(m, `missing manifest for ${f}`).toBeDefined();
      expect(m!.source.length).toBeGreaterThan(0);
      expect(m!.topic.length).toBeGreaterThan(0);
    }
  });

  it('marks the detailed food-composition table as online-only', () => {
    const entry = MANIFEST.find((m) => m.topic === 'composicion-alimentos');
    expect(entry).toBeDefined();
    expect(entry!.offline).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx vitest run test/manifest.test.ts`
Expected: FAIL (cannot find `../src/rag/manifest.js`).

- [ ] **Step 3: Implement the manifest**

Create `server/src/rag/manifest.ts`. Map each of the 18 actual filenames. Use exact filenames as keys (copy them verbatim from `docs/rag-docs/`):
```ts
export interface ManifestEntry {
  /** Exact PDF filename in docs/rag-docs/. */
  file: string;
  /** Stable short id used as the chunk id prefix and doc_id. */
  docId: string;
  /** Human source label shown in citations. */
  source: string;
  sourceUrl?: string;
  /** Topic tag (kebab-case). */
  topic: string;
  /** Whether this doc may feed the offline digest (false = too detailed/online-only). */
  offline: boolean;
}

export const MANIFEST: ManifestEntry[] = [
  { file: 'Metodo del plato (SEGUN LA ADA, american diabetes association).pdf', docId: 'plato-ada', source: 'ADA — Método del plato', topic: 'metodo-plato', offline: true },
  { file: 'Planificación de comidas para personas con diabetes (METODO DEL PLATO, lo primordial si se cocina).pdf', docId: 'planif-comidas', source: 'ADA — Planificación de comidas', topic: 'metodo-plato', offline: true },
  { file: 'Recomendaciones para carbohidratos buenos (mejorar su dieta).pdf', docId: 'carbohidratos', source: 'Guías de diabetes', topic: 'carbohidratos', offline: true },
  { file: 'Recomendaciones para comer fibra (carbohidrato que ayuda a manejar la diabetes).pdf', docId: 'fibra', source: 'Guías de diabetes', topic: 'fibra', offline: true },
  { file: 'Cómo identificar azúcares ocultos en los alimentos comunes.pdf', docId: 'azucares-ocultos', source: 'Guías de diabetes', topic: 'azucares-ocultos', offline: true },
  { file: 'Recomendaciones para comer en un buffet (si puede, solo hay que enseñarle como).pdf', docId: 'buffet', source: 'Guías de diabetes', topic: 'comer-fuera', offline: true },
  { file: 'Recomendaciones para comer fuera de casa.pdf', docId: 'comer-fuera', source: 'Guías de diabetes', topic: 'comer-fuera', offline: true },
  { file: 'Recomendaciones para comer postres en diabeticos.pdf', docId: 'postres', source: 'Guías de diabetes', topic: 'postres', offline: true },
  { file: 'Alimentacion en diabetes en fiestas, navidad, año nuevo.pdf', docId: 'fiestas', source: 'Guías de diabetes', topic: 'fiestas', offline: true },
  { file: 'Recomendaciones de actividad fisica en diabetes OPS.pdf', docId: 'actividad-ops', source: 'OPS — Actividad física', topic: 'actividad-fisica', offline: true },
  { file: 'Recomendaciones sobre actividad fisica en edad avanzada.pdf', docId: 'actividad-edad', source: 'OPS — Actividad física (edad avanzada)', topic: 'actividad-fisica', offline: true },
  { file: 'Recomendaciones para el autocuidado de los pies - OPS.pdf', docId: 'pies-ops', source: 'OPS — Cuidado de los pies', topic: 'cuidado-pies', offline: true },
  { file: 'Recomendaciones sobre sus medicamentos para la diabetes _ Diabetes _ CDC.pdf', docId: 'medicamentos-cdc', source: 'CDC — Medicamentos', topic: 'medicamentos', offline: true },
  { file: 'Recomendaciones para el cuidado de su diabetes (citas con el medico, complicaciones).pdf', docId: 'cuidado-diabetes', source: 'Guías de diabetes', topic: 'cuidado-general', offline: true },
  { file: 'Recomendaciones para evitar las complicaciones.pdf', docId: 'complicaciones', source: 'Guías de diabetes', topic: 'complicaciones', offline: true },
  { file: 'Guia diagnostico, clinico y tratamiento (recomendaciones alimentarias).pdf', docId: 'guia-clinica', source: 'Guía clínica (MINSA)', topic: 'recomendaciones-alimentarias', offline: true },
  { file: 'Guias alimentarias en la poblacion peruana (de aca se saca los alimentos que hay en el peru, no la información de alimentacion de la diabetes).pdf', docId: 'guias-peru', source: 'Guías alimentarias peruanas', topic: 'alimentos-peru', offline: true },
  { file: 'Tablas peruanas de composición de alimentos (alimentos peruanos al detallado, su energia, kcal, etc, opcional, mas detallado).pdf', docId: 'tablas-composicion', source: 'Tablas peruanas de composición', topic: 'composicion-alimentos', offline: false },
];

export function manifestFor(file: string): ManifestEntry | undefined {
  return MANIFEST.find((m) => m.file === file);
}
```
**Note for the engineer:** verify each `file` string EXACTLY matches a filename in `docs/rag-docs/` (run `ls docs/rag-docs`). Accents and parentheses must match byte-for-byte or `manifestFor` returns undefined and the test fails.

- [ ] **Step 4: Run to verify it passes**

Run (from `server/`): `npx vitest run test/manifest.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/rag/manifest.ts server/test/manifest.test.ts
git commit -m "feat(rag): document manifest mapping the 18 PDFs to source + topic"
```

---

### Task 3: PDF text extraction

**Files:**
- Create: `server/src/rag/pdf/extract.ts`
- Test: `server/test/extract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/extract.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { extractPdf } from '../src/rag/pdf/extract.js';

const DOCS_DIR = resolve(__dirname, '../../docs/rag-docs');

describe('extractPdf', () => {
  it('extracts a meaningful amount of text from a text-based PDF', async () => {
    const file = 'Recomendaciones para el autocuidado de los pies - OPS.pdf';
    const res = await extractPdf(resolve(DOCS_DIR, file));
    expect(res.charCount).toBeGreaterThan(200);
    expect(res.text.toLowerCase()).toContain('pie');
  }, 30000);
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx vitest run test/extract.test.ts`
Expected: FAIL (cannot find `extract.js`).

- [ ] **Step 3: Implement extraction**

Create `server/src/rag/pdf/extract.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

export interface ExtractResult {
  text: string;
  charCount: number;
}

/** Read a PDF and return its merged text (whitespace collapsed). */
export async function extractPdf(path: string): Promise<ExtractResult> {
  const buf = await readFile(path);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = (Array.isArray(text) ? text.join('\n') : text)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: merged, charCount: merged.length };
}
```

- [ ] **Step 4: Run to verify it passes**

Run (from `server/`): `npx vitest run test/extract.test.ts`
Expected: PASS.
**If it fails with low charCount:** that PDF is image-only/scanned. Pick another text-based PDF for the assertion and note the scanned one (it will be skipped at ingest by the char-count guard in Task 6).

- [ ] **Step 5: Commit**

```bash
git add server/src/rag/pdf/extract.ts server/test/extract.test.ts
git commit -m "feat(rag): PDF text extraction via unpdf"
```

---

### Task 4: Chunker

**Files:**
- Create: `server/src/rag/pdf/chunk.ts`
- Test: `server/test/chunk.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/chunk.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { chunkText } from '../src/rag/pdf/chunk.js';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const chunks = chunkText('hola mundo', { maxWords: 600, overlapWords: 80 });
    expect(chunks).toEqual(['hola mundo']);
  });

  it('splits long text into overlapping chunks', () => {
    const words = Array.from({ length: 1300 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(words, { maxWords: 600, overlapWords: 80 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Each chunk no longer than maxWords
    for (const c of chunks) expect(c.split(/\s+/).length).toBeLessThanOrEqual(600);
    // Overlap: the start of chunk 2 repeats the tail of chunk 1
    const tail1 = chunks[0].split(/\s+/).slice(-80);
    const head2 = chunks[1].split(/\s+/).slice(0, 80);
    expect(head2).toEqual(tail1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx vitest run test/chunk.test.ts`
Expected: FAIL (cannot find `chunk.js`).

- [ ] **Step 3: Implement the chunker**

Create `server/src/rag/pdf/chunk.ts`:
```ts
export interface ChunkOptions {
  maxWords: number;
  overlapWords: number;
}

/**
 * Split text into word-windowed chunks with a fixed overlap. Word-based (not
 * token-based) for determinism and zero deps; ~600 words ≈ ~800 tokens.
 */
export function chunkText(text: string, opts: ChunkOptions): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= opts.maxWords) return [words.join(' ')];

  const chunks: string[] = [];
  const step = Math.max(1, opts.maxWords - opts.overlapWords);
  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + opts.maxWords).join(' '));
    if (start + opts.maxWords >= words.length) break;
  }
  return chunks;
}
```

- [ ] **Step 4: Run to verify it passes**

Run (from `server/`): `npx vitest run test/chunk.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/rag/pdf/chunk.ts server/test/chunk.test.ts
git commit -m "feat(rag): word-windowed chunker with overlap"
```

---

### Task 5: Azure embeddings client

**Files:**
- Create: `server/src/rag/embed.ts`
- Test: `server/test/embed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/embed.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { embedMany } from '../src/rag/embed.js';

describe('embedMany', () => {
  it('returns null when no embedding deployment is configured', async () => {
    // env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT is unset in the test environment.
    const result = await embedMany(['hola']);
    expect(result).toBeNull();
  });
});
```
**Note:** ensure the test env has no `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`. The existing tests run without it, so this holds.

- [ ] **Step 2: Run to verify it fails**

Run (from `server/`): `npx vitest run test/embed.test.ts`
Expected: FAIL (cannot find `embed.js`).

- [ ] **Step 3: Implement the embeddings client**

Create `server/src/rag/embed.ts`:
```ts
import { AzureOpenAI } from 'openai';
import { env } from '../env.js';

function client(): AzureOpenAI | null {
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY || !env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT) {
    return null;
  }
  return new AzureOpenAI({
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    apiKey: env.AZURE_OPENAI_API_KEY,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
    deployment: env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
  });
}

/** Embed many texts. Returns null when embeddings are unconfigured. */
export async function embedMany(texts: string[]): Promise<number[][] | null> {
  const c = client();
  if (!c) return null;
  const res = await c.embeddings.create({
    model: env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    input: texts,
  });
  return res.data.map((d) => d.embedding as number[]);
}

/** Embed a single text. Returns null when embeddings are unconfigured. */
export async function embedOne(text: string): Promise<number[] | null> {
  const out = await embedMany([text]);
  return out ? out[0] : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run (from `server/`): `npx vitest run test/embed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/rag/embed.ts server/test/embed.test.ts
git commit -m "feat(rag): Azure embeddings client (null when unconfigured)"
```

---

### Task 6: Rewrite ingest (extract → chunk → embed → upsert)

**Files:**
- Rewrite: `server/src/rag/ingest.ts`

This is a script, verified by running it (not a unit test). It must be idempotent.

- [ ] **Step 1: Rewrite the ingest script**

Replace the contents of `server/src/rag/ingest.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ensureVectorSchema } from './ensureSchema.js';
import { MANIFEST } from './manifest.js';
import { extractPdf } from './pdf/extract.js';
import { chunkText } from './pdf/chunk.js';
import { embedMany } from './embed.js';

const DOCS_DIR = resolve(import.meta.dirname, '../../../docs/rag-docs');
const MIN_CHARS = 200; // below this a PDF is treated as scanned/image-only
const MAX_WORDS = 600;
const OVERLAP_WORDS = 80;

interface Chunk { id: string; docId: string; source: string; sourceUrl: string | null; topic: string; content: string; }

async function buildChunks(): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  for (const m of MANIFEST) {
    let text: string;
    let charCount: number;
    try {
      ({ text, charCount } = await extractPdf(resolve(DOCS_DIR, m.file)));
    } catch (err) {
      console.warn(`[ingest] SKIP ${m.file} — extract failed: ${String(err)}`);
      continue;
    }
    if (charCount < MIN_CHARS) {
      console.warn(`[ingest] SKIP ${m.file} — only ${charCount} chars (likely scanned)`);
      continue;
    }
    const parts = chunkText(text, { maxWords: MAX_WORDS, overlapWords: OVERLAP_WORDS });
    parts.forEach((content, i) => {
      chunks.push({
        id: `${m.docId}-${i}`,
        docId: m.docId,
        source: m.source,
        sourceUrl: m.sourceUrl ?? null,
        topic: m.topic,
        content,
      });
    });
    console.log(`[ingest] ${m.file} → ${parts.length} chunks (${charCount} chars)`);
  }
  return chunks;
}

async function upsert(chunk: Chunk, embedding: number[] | null): Promise<void> {
  const vec = embedding ? `[${embedding.join(',')}]` : null;
  await db.execute(sql`
    INSERT INTO knowledge (id, topic, content, source, source_url, doc_id, embedding)
    VALUES (${chunk.id}, ${chunk.topic}, ${chunk.content}, ${chunk.source}, ${chunk.sourceUrl}, ${chunk.docId},
            ${vec === null ? sql`NULL` : sql`${vec}::vector`})
    ON CONFLICT (id) DO UPDATE SET
      topic = EXCLUDED.topic, content = EXCLUDED.content, source = EXCLUDED.source,
      source_url = EXCLUDED.source_url, doc_id = EXCLUDED.doc_id, embedding = EXCLUDED.embedding
  `);
}

export async function ingest(): Promise<{ chunks: number; embedded: boolean }> {
  await ensureVectorSchema();
  const chunks = await buildChunks();

  // Embed in batches of 64 (one Azure call each). embedMany returns null when
  // embeddings are unconfigured — then we store chunks with NULL embeddings and
  // retrieval falls back to lexical FTS.
  let embedded = true;
  const BATCH = 64;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vecs = await embedMany(batch.map((c) => c.content));
    if (vecs === null) {
      embedded = false;
      for (const c of batch) await upsert(c, null);
    } else {
      for (let j = 0; j < batch.length; j++) await upsert(batch[j], vecs[j]);
    }
  }
  return { chunks: chunks.length, embedded };
}

const result = await ingest();
console.log(`[ingest] done — ${result.chunks} chunks, embeddings=${result.embedded ? 'yes' : 'NO (lexical fallback)'}`);
process.exit(0);
```

- [ ] **Step 2: Recreate the DB container with pgvector (HUMAN step)**

A human runs (subagents must not run docker):
```bash
docker compose down && docker compose up -d
cd server && npm run db:migrate
```
Expected: postgres up on 5433 with the `vector` extension available.

- [ ] **Step 3: Run ingest**

Run (from `server/`): `npm run db:ingest`
Expected: per-doc chunk logs, a final `done — N chunks, embeddings=yes` (if the embedding deployment is configured) or `embeddings=NO (lexical fallback)` otherwise. Note any `SKIP` lines (scanned PDFs).

- [ ] **Step 4: Verify rows landed**

Run (from `server/`): `npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {sql}=await import('drizzle-orm');const r=await db.execute(sql\`SELECT count(*)::int AS n, count(embedding)::int AS e FROM knowledge\`);console.log(r);process.exit(0)})"`
Expected: `n` > 40 (chunks), `e` equals `n` when embeddings ran (else 0).

- [ ] **Step 5: Commit**

```bash
git add server/src/rag/ingest.ts
git commit -m "feat(rag): ingest PDFs — extract, chunk, embed, upsert (idempotent)"
```

---

### Task 7: Semantic retrieval with lexical fallback

**Files:**
- Modify: `server/src/rag/retrieve.ts`
- Test: `server/test/retrieve.test.ts` (existing — keep green)

- [ ] **Step 1: Add the semantic path (keep the lexical fallback intact)**

In `server/src/rag/retrieve.ts`, add an import at the top:
```ts
import { embedOne } from './embed.js';
```
Then at the START of the `retrieve` function body (before the existing FTS query), insert:
```ts
  // Semantic path: when embeddings are configured, embed the query and do a
  // pgvector cosine search. Falls through to lexical FTS on null/empty/error.
  try {
    const qvec = await embedOne(query);
    if (qvec) {
      const lit = `[${qvec.join(',')}]`;
      const rows = await db.execute<{
        content: string; source: string; sourceUrl: string | null; score: number;
      }>(sql`
        SELECT content, source, source_url AS "sourceUrl",
               1 - (embedding <=> ${lit}::vector) AS score
        FROM knowledge
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${lit}::vector
        LIMIT ${k}
      `);
      if (rows.length > 0) {
        return rows.map((r) => ({
          content: r.content,
          source: r.source,
          sourceUrl: r.sourceUrl ?? undefined,
          score: Number(r.score),
        }));
      }
    }
  } catch (err) {
    console.warn(`[retrieve] semantic path failed, falling back to lexical: ${String(err)}`);
  }
```
(The existing FTS + ILIKE code stays exactly as-is below this block.)

- [ ] **Step 2: Verify the lexical fallback still passes**

Run (from `server/`): `npx vitest run test/retrieve.test.ts`
Expected: PASS — with no embedding deployment in the test env, `embedOne` returns null and the function uses the unchanged FTS/ILIKE path. (If `retrieve.test.ts` seeds the old hardcoded `knowledge.ts` rows, leave that seeding as-is; lexical search over them is unaffected.)

- [ ] **Step 3: Typecheck**

Run (from `server/`): `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/src/rag/retrieve.ts
git commit -m "feat(rag): semantic pgvector retrieval with lexical fallback"
```

---

## SUBSYSTEM B — Offline curated digest

### Task 8: Author the offline digest data file

**Files:**
- Create: `src/data/knowledge-offline.ts`

This is curated content distilled from the PDFs. The engineer reads the extracted
text (re-use Task 3's `extractPdf`, or read the PDFs) and writes paraphrased,
plain-Peruvian-Spanish snippets — **no doses, no diagnosis**. Cover the `offline:true`
topics from the manifest. Target 40–60 entries.

- [ ] **Step 1: Create the data file with the type + seed entries**

Create `src/data/knowledge-offline.ts`:
```ts
/**
 * Offline knowledge digest — concise, paraphrased Spanish snippets distilled
 * from the curated PDFs (docs/rag-docs/). Bundled in the SPA so education
 * questions get a real, cited answer with no signal. Never doses/diagnosis.
 *
 * Each entry: keywords are lowercase, accent-free tokens used for matching.
 */
export interface OfflineKnowledgeEntry {
  id: string;
  topic: string;
  keywords: string[];
  content: string;
  source: string;
}

export const KNOWLEDGE_OFFLINE: OfflineKnowledgeEntry[] = [
  {
    id: 'off-plato',
    topic: 'método del plato',
    keywords: ['plato', 'metodo del plato', 'porcion', 'porciones', 'cuanto servir', 'como servir'],
    content:
      'El método del plato es una forma sencilla de servir: llena la mitad del plato con verduras, un cuarto con una proteína (pollo, pescado, huevo, menestras) y un cuarto con carbohidrato (arroz, papa, camote, fideos). Así controlas la cantidad sin pesar la comida.',
    source: 'ADA — Método del plato',
  },
  {
    id: 'off-fibra',
    topic: 'fibra',
    keywords: ['fibra', 'integral', 'avena', 'menestra', 'frejol', 'lenteja', 'verdura', 'quinua'],
    content:
      'Los alimentos con fibra —avena, menestras, verduras, quinua, pan integral— hacen que el azúcar suba más despacio después de comer. Incluye algo de fibra en cada comida.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-pies',
    topic: 'cuidado de los pies',
    keywords: ['pie', 'pies', 'herida', 'ampolla', 'unas', 'zapatos', 'callo', 'revisar pies'],
    content:
      'Revisa tus pies todos los días buscando heridas, ampollas o cambios de color. Lávalos y sécalos bien, sobre todo entre los dedos, y usa zapatos cómodos que no aprieten. Si ves una herida que no sana, consulta a tu médico ese mismo día.',
    source: 'OPS — Cuidado de los pies',
  },
  // … continue to 40–60 entries covering: azúcares ocultos, comer fuera de casa,
  // buffet, postres, fiestas/navidad, actividad física (general y edad avanzada),
  // carbohidratos buenos, medicamentos (recordatorios, NUNCA dosis), complicaciones,
  // citas con el médico, y alimentos peruanos (qué comer/sustituir). One entry per
  // distinct sub-topic; keep each ≤ ~70 words; every entry MUST have a `source`.
];
```

- [ ] **Step 2: Author the remaining entries from the PDFs**

Read each `offline:true` PDF's text and add entries (paraphrased, ≤~70 words, with
`source` from the manifest). Do NOT copy text verbatim. Do NOT include the
`composicion-alimentos` doc. Ensure keyword coverage for likely questions
(e.g. "puedo comer postre", "como como en una fiesta", "que ejercicio puedo hacer",
"azucar escondida en productos", "puedo comer fuera de casa").

- [ ] **Step 3: Typecheck**

Run (from repo root): `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/data/knowledge-offline.ts
git commit -m "feat(rag): offline knowledge digest distilled from the PDFs"
```

---

### Task 9: Point `queryRag` at the offline digest

**Files:**
- Modify: `src/agent/tools/queryRag.ts`
- Create: `tests/queryRagOffline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/queryRagOffline.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { queryRag } from '@/agent/tools/queryRag';

describe('queryRag — offline digest', () => {
  it('answers the plate-method question from the digest', () => {
    const r = queryRag('cómo sirvo mi plato');
    expect(r).not.toBeNull();
    expect(r!.content.toLowerCase()).toMatch(/mitad|verduras|plato/);
    expect(r!.source.length).toBeGreaterThan(0);
  });

  it('answers a foot-care question', () => {
    const r = queryRag('cómo cuido mis pies');
    expect(r).not.toBeNull();
    expect(r!.content.toLowerCase()).toContain('pie');
  });

  it('returns null for an unrelated question', () => {
    expect(queryRag('quién ganó el partido')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify current behavior**

Run (from repo root): `npx vitest run tests/queryRagOffline.test.ts`
Expected: the plate-method test likely FAILS against the old 15-entry KB (no plate-method entry).

- [ ] **Step 3: Swap the KB source**

In `src/agent/tools/queryRag.ts`:
1. Remove the inline `KNOWLEDGE_BASE` array and the `KnowledgeEntry` interface.
2. Import the digest: `import { KNOWLEDGE_OFFLINE } from '@/data/knowledge-offline';`
3. In `matchesKnowledgeBase`, iterate `KNOWLEDGE_OFFLINE` instead of `KNOWLEDGE_BASE` (the entry shape is identical: `keywords`, `topic`, `content`, `source`).

The `findFood` priority-1 path and the `queryRag` signature/return type stay unchanged.

- [ ] **Step 4: Run to verify it passes**

Run (from repo root): `npx vitest run tests/queryRagOffline.test.ts tests/queryRag.test.ts`
Expected: PASS (new digest tests + the existing `queryRag.test.ts` food-lookup tests, which rely on `findFood`, unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/agent/tools/queryRag.ts tests/queryRagOffline.test.ts
git commit -m "feat(rag): queryRag sources the offline digest"
```

---

### Task 10: Wire offline education into useChat

**Files:**
- Modify: `src/app/useChat.ts`
- Test: `tests/offlineEducation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/offlineEducation.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChat } from '@/app/useChat';
import { useChatStore } from '@/store/useChatStore';
import { useAppStore } from '@/store/appStore';

beforeEach(() => {
  useChatStore.getState().clear();
});

describe('offline education answers from the digest', () => {
  it('answers an education question locally when offline', async () => {
    useAppStore.setState({ isOffline: true });
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.sendUserMessage('¿cómo cuido mis pies?');
    });
    const msgs = useChatStore.getState().items.filter((i) => i.kind === 'message' && i.role === 'khumpi');
    const last = msgs[msgs.length - 1] as { text: string; sources?: { source: string }[] };
    expect(last.text.toLowerCase()).toContain('pie');
    expect(last.sources && last.sources.length).toBeGreaterThan(0);
  });
});
```
**Note:** match the project's existing hook-test style — check `tests/` for an existing `renderHook`/`act` example (e.g. a useChat or store test) and mirror its imports/setup. If the repo has no React hook-test harness, instead unit-test a small extracted helper `offlineEducationAnswer(text, name)` that returns `{ text, sources } | null`, and assert on that.

- [ ] **Step 2: Run to verify it fails**

Run (from repo root): `npx vitest run tests/offlineEducation.test.ts`
Expected: FAIL (offline branch currently returns a warm ack, no `pie` content / no sources).

- [ ] **Step 3: Add the offline education branch**

In `src/app/useChat.ts`, inside `sendUserMessage`, in the `if (offline) { … }` block,
BEFORE the existing data-intent/offline-rules handling, add:
```ts
        // Offline education: answer from the bundled digest (no network).
        if (isEducationQuestion(trimmed)) {
          const hit = queryRag(trimmed);
          chat.setThinking(true);
          await sleep(450);
          if (hit) {
            const id = uid('msg');
            chat.setThinking(false);
            chat.addMessage({ id, kind: 'message', role: 'khumpi', text: '', streaming: true });
            const body = `Sin conexión, pero esto es lo que sé: ${hit.content}`;
            for (const w of body.split(/(\s+)/)) {
              chat.appendDelta(id, w);
              if (w.trim()) await sleep(18);
            }
            chat.attachSources(id, [{ source: hit.source }]);
          } else {
            await streamSay(getOfflineResponse(intent, app.user.name));
          }
          return;
        }
```
Add the import at the top of the file (next to the other `@/agent` imports):
```ts
import { queryRag } from '@/agent/tools/queryRag';
```
(`isEducationQuestion`, `getOfflineResponse`, `uid`, `sleep`, `streamSay`, `chat.attachSources` are all already imported/available in this file.)

- [ ] **Step 4: Run to verify it passes**

Run (from repo root): `npx vitest run tests/offlineEducation.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full front-end suite + typecheck**

Run (from repo root): `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/useChat.ts tests/offlineEducation.test.ts
git commit -m "feat(rag): offline education answers from the digest in useChat"
```

---

## Final verification

- [ ] **Server:** `cd server && npx tsc --noEmit && npx vitest run` — tsc 0; tests pass (DB tests need Postgres up).
- [ ] **Front-end:** `npx tsc --noEmit && npx vitest run` — tsc 0; all tests pass.
- [ ] **Online smoke (DB + embedding configured):** `curl -N -X POST localhost:8787/api/rag/ask -H 'Content-Type: application/json' -d '{"question":"¿cómo organizo mi plato?"}'` → streamed answer grounded in the plate-method chunks + a `sources` event.
- [ ] **Offline smoke:** in the app, toggle offline, ask "¿cómo cuido mis pies?" → a digest answer with a source chip (no network call).

## Spec coverage check
- PDF extraction + attribution → Tasks 2, 3. Chunking → Task 4. Embedding → Task 5.
  pgvector storage + DDL → Tasks 1, 6. Semantic retrieve + lexical fallback → Task 7.
  Offline digest → Task 8. queryRag swap → Task 9. Offline wiring → Task 10.
  Scanned-PDF guard → Task 6 (MIN_CHARS). Env/infra → Task 1.
