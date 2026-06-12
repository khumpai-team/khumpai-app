/**
 * queryHistory — pure filter over a LogEntry array.  No store access.
 */

import { z } from 'zod';
import type { LogEntry, LogType } from '@/types';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const LOG_TYPES: [LogType, ...LogType[]] = [
  'meal',
  'glucose',
  'medication',
  'symptom',
  'sleep',
  'mood',
  'stress',
  'activity',
];

const QueryHistoryOpts = z.object({
  personId: z.string().optional(),
  type: z.enum(LOG_TYPES).optional(),
  daysBack: z.number().int().positive().optional(),
});

export type QueryHistoryOpts = z.infer<typeof QueryHistoryOpts>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter log entries by optional person, type, and recency window.
 *
 * @param logs    - Full log array (from store or seed).
 * @param opts    - Zod-validated filter options.
 * @returns Matching entries sorted by timestamp descending (most recent first).
 */
export function queryHistory(logs: LogEntry[], opts: QueryHistoryOpts): LogEntry[] {
  QueryHistoryOpts.parse(opts); // throws ZodError on invalid opts

  const { personId, type, daysBack } = opts;
  const now = Date.now();
  const cutoff = daysBack != null ? now - daysBack * 86_400_000 : null;

  return logs
    .filter((entry) => {
      if (personId != null && entry.personId !== personId) return false;
      if (type != null && entry.type !== type) return false;
      if (cutoff != null && new Date(entry.timestamp).getTime() < cutoff) return false;
      return true;
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}
