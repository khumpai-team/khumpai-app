/**
 * Offline queue helpers — pure functions over LogEntry arrays.
 *
 * These functions do NOT couple to the Zustand store; the store owns its own
 * flush trigger. This module provides reusable, testable queue logic.
 *
 * All functions are pure (no mutations, no side effects).
 */

import type { LogEntry } from '@/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Appends a new entry to the offline queue.
 *
 * The entry is marked `isOfflineCapture: true`; `confirmed` is left as-is
 * (caller controls confirmation status).
 *
 * @param queue - Existing offline queue (not mutated).
 * @param entry - New log entry to append.
 * @returns New array with the entry appended and `isOfflineCapture` set to true.
 */
export function enqueue(queue: LogEntry[], entry: LogEntry): LogEntry[] {
  const marked: LogEntry = { ...entry, isOfflineCapture: true };
  return [...queue, marked];
}

/**
 * Flushes all entries from the offline queue.
 *
 * Entries in `flushed` are sorted CHRONOLOGICALLY by `timestamp` ascending
 * to preserve event ordering. Equal timestamps preserve relative insertion
 * order (stable sort).
 *
 * @param queue - Offline queue to flush (not mutated).
 * @returns `{ flushed, remaining }` where remaining is always empty.
 */
export function flush(queue: LogEntry[]): { flushed: LogEntry[]; remaining: LogEntry[] } {
  // Stable sort ascending by ISO timestamp string (lexicographic == chronological for ISO 8601).
  const flushed = [...queue].sort((a, b) => {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0; // stable: equal timestamps preserve original order
  });

  return { flushed, remaining: [] };
}

/**
 * Merges flushed offline entries into the main log array.
 *
 * Steps:
 *   1. Concatenate existing + flushed.
 *   2. Sort by timestamp ascending.
 *   3. Deduplicate by `id` — if two entries share the same id, the LATER one
 *      in the sorted array wins (i.e., the one that appeared further right
 *      in the concatenated array, which after stable sort is the flushed copy).
 *
 * @param existing - Current main log array (not mutated).
 * @param flushed  - Entries returned by `flush()` (not mutated).
 * @returns New merged, sorted, deduplicated array.
 */
export function mergeIntoLogs(existing: LogEntry[], flushed: LogEntry[]): LogEntry[] {
  // Concat and stable-sort ascending by timestamp.
  const combined = [...existing, ...flushed].sort((a, b) => {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;
    return 0;
  });

  // Deduplicate: traverse in order, later wins (last write wins for equal ids).
  const seen = new Map<string, LogEntry>();
  for (const entry of combined) {
    seen.set(entry.id, entry); // overwrite — later in sorted order wins
  }

  return Array.from(seen.values());
}
