/**
 * queryRag — pure, offline retrieval from the bundled knowledge digest.
 *
 * This is the OFFLINE path (no network): it matches against KNOWLEDGE_OFFLINE
 * (distilled from the source PDFs, see src/data/knowledge-offline.ts) plus the
 * Peruvian food table. The ONLINE path is the server's semantic pgvector search
 * at POST /api/rag/ask. Same signature, so callers don't care which ran.
 *
 * Every answer MUST include a source.
 */

import { z } from 'zod';
import { findFood } from '@/data/peruvian-foods';
import { KNOWLEDGE_OFFLINE } from '@/data/knowledge-offline';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const QueryRagInput = z.object({
  query: z.string().min(1, 'query must not be empty'),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesKnowledgeBase(
  normalizedQuery: string,
) {
  return KNOWLEDGE_OFFLINE.find(
    (entry) =>
      entry.keywords.some((kw) => normalizedQuery.includes(normalize(kw))) ||
      normalize(entry.topic).split(' ').some((word) => word.length >= 4 && normalizedQuery.includes(word)),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RagResult {
  content: string;
  source: string;
}

/**
 * Retrieve the most relevant answer for a free-text health question.
 *
 * Matching priority:
 *   1. If the query names a Peruvian food (via findFood), return that food's note
 *      with source "Tabla de alimentos".
 *   2. Otherwise, match against KNOWLEDGE_OFFLINE keywords and topics.
 *   3. Returns null if no match is found.
 *
 * Every returned answer includes a source field.
 *
 * Throws ZodError on invalid (empty) query.
 */
export function queryRag(query: string): RagResult | null {
  QueryRagInput.parse({ query });

  const normQuery = normalize(query);

  // Priority 1: Peruvian food lookup
  const food = findFood(query);
  if (food) {
    return {
      content: food.note,
      source: 'Tabla de alimentos',
    };
  }

  // Priority 2: knowledge base keyword/topic match
  const entry = matchesKnowledgeBase(normQuery);
  if (entry) {
    return {
      content: entry.content,
      source: entry.source,
    };
  }

  return null;
}
