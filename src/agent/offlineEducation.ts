/**
 * offlineEducationAnswer — pure helper that looks up a diabetes-education
 * question in the bundled offline digest.
 *
 * Returns the streamed body text + source, or null when:
 *  - the text is not an education question, OR
 *  - the digest has no matching entry.
 *
 * Extracted as a pure function so it can be unit-tested without React.
 * useChat's offline branch calls this and then streams the result.
 */

import { isEducationQuestion } from '@/agent/education';
import { queryRag } from '@/agent/tools/queryRag';

export interface OfflineEducationResult {
  /** Full reply body, prefixed with the offline notice. */
  body: string;
  /** Source label for the source chip. */
  source: string;
}

/**
 * If `text` is an education question AND the offline digest has a match,
 * returns the answer body + source. Otherwise returns null.
 */
export function offlineEducationAnswer(text: string): OfflineEducationResult | null {
  if (!isEducationQuestion(text)) return null;
  const hit = queryRag(text);
  if (!hit) return null;
  return {
    body: `Sin conexión, pero esto es lo que sé: ${hit.content}`,
    source: hit.source,
  };
}
