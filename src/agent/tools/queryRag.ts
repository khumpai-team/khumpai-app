/**
 * queryRag — pure retrieval from a hardcoded knowledge base.
 *
 * Interface is designed for easy swap to Azure AI Search or a vector database
 * in Phase 2 — just replace KNOWLEDGE_BASE and the match logic while keeping
 * the same function signature.
 *
 * Every answer MUST include a source (MINSA, ADA, or "Tabla de alimentos").
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
