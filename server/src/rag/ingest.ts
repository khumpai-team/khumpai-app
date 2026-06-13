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
