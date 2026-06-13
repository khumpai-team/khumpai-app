import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { embedOne } from './embed.js';

export interface RetrieveResult {
  content: string;
  source: string;
  sourceUrl?: string;
  score: number;
}

export async function retrieve(query: string, k = 4): Promise<RetrieveResult[]> {
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

  // Primary: Postgres full-text search with Spanish dictionary
  const ftsRows = await db.execute<{
    content: string;
    source: string;
    sourceUrl: string | null;
    score: number;
  }>(sql`
    SELECT content, source, source_url AS "sourceUrl",
           ts_rank(
             to_tsvector('spanish', topic || ' ' || content),
             plainto_tsquery('spanish', ${query})
           ) AS score
    FROM knowledge
    WHERE to_tsvector('spanish', topic || ' ' || content)
          @@ plainto_tsquery('spanish', ${query})
    ORDER BY score DESC
    LIMIT ${k}
  `);

  if (ftsRows.length > 0) {
    return ftsRows.map((r) => ({
      content: r.content,
      source: r.source,
      sourceUrl: r.sourceUrl ?? undefined,
      score: Number(r.score),
    }));
  }

  // Fallback: ILIKE on topic + content for short/odd queries.
  // Score each row by how many query words (len > 3) appear in topic+content,
  // then return top-k by score so the most relevant rows surface first.
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // If no significant words, try the full query as a single pattern
  const searchTerms = words.length > 0 ? words : [query];

  const ilikeRows = await db.execute<{
    content: string;
    source: string;
    sourceUrl: string | null;
    matchScore: string;
  }>(sql`
    SELECT content, source, source_url AS "sourceUrl",
           (${sql.raw(
             searchTerms
               .map(
                 (w) =>
                   `(CASE WHEN lower(topic || ' ' || content) LIKE lower('%${w.replace(/'/g, "''")}%') THEN 1 ELSE 0 END)`,
               )
               .join(' + '),
           )})::text AS "matchScore"
    FROM knowledge
    WHERE ${sql.raw(
      searchTerms
        .map(
          (w) =>
            `(topic ILIKE '%${w.replace(/'/g, "''")}%' OR content ILIKE '%${w.replace(/'/g, "''")}%')`,
        )
        .join(' OR '),
    )}
    ORDER BY "matchScore" DESC
    LIMIT ${k}
  `);

  if (ilikeRows.length > 0) {
    return ilikeRows.map((r) => ({
      content: r.content,
      source: r.source,
      sourceUrl: r.sourceUrl ?? undefined,
      score: Number(r.matchScore) / searchTerms.length,
    }));
  }

  return [];
}
