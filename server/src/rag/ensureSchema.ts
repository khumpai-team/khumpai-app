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
