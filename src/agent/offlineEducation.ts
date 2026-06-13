/**
 * offlineEducationAnswer — pure helper that looks up a question in the bundled
 * offline digest (the pre-charged diabetes knowledge that ships in the app).
 *
 * Returns the streamed body text + source, or null when the digest has no
 * relevant entry. `queryRag` is the relevance gate: it matches against the
 * curated snippets + the Peruvian-food table and returns null on no match — so
 * any answerable question gets an answer offline, not just ones that pass a
 * strict "is this a question?" classifier.
 *
 * IMPORTANT: callers must handle data entries (glucose/meal/symptom/…) and
 * dose/diagnosis guardrails BEFORE calling this, so a loggable statement or an
 * unsafe question is never answered with a general snippet.
 *
 * Extracted as a pure function so it can be unit-tested without React.
 */

import { queryRag } from '@/agent/tools/queryRag';

export interface OfflineEducationResult {
  /** Full reply body, prefixed with the offline notice. */
  body: string;
  /** Source label for the source chip. */
  source: string;
}

/**
 * If the offline digest has a match for `text`, returns the answer body +
 * source. Otherwise returns null.
 */
export function offlineEducationAnswer(text: string): OfflineEducationResult | null {
  const hit = queryRag(text);
  if (!hit) return null;
  return {
    body: `Sin conexión, pero esto es lo que sé: ${hit.content}`,
    source: hit.source,
  };
}
