import { describe, it, expect } from 'vitest';
import { enqueue, flush, mergeIntoLogs } from '@/lib/syncQueue';
import type { LogEntry } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(id: string, timestamp: string, extra: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    personId: 'carlos',
    type: 'meal',
    timestamp,
    createdAt: timestamp,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { description: 'test meal', context: 'casa' },
    ...extra,
  } as LogEntry;
}

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

describe('enqueue', () => {
  it('marks isOfflineCapture true on the appended entry', () => {
    const original = makeEntry('e1', '2026-06-12T10:00:00Z', { isOfflineCapture: false });
    const result = enqueue([], original);
    expect(result).toHaveLength(1);
    expect(result[0].isOfflineCapture).toBe(true);
  });

  it('does not mutate the original entry', () => {
    const original = makeEntry('e1', '2026-06-12T10:00:00Z', { isOfflineCapture: false });
    enqueue([], original);
    expect(original.isOfflineCapture).toBe(false);
  });

  it('does not mutate the input queue', () => {
    const queue: LogEntry[] = [makeEntry('e0', '2026-06-12T09:00:00Z')];
    const original = Object.freeze([...queue]); // snapshot
    enqueue(queue, makeEntry('e1', '2026-06-12T10:00:00Z'));
    expect(queue).toHaveLength(1); // queue itself unchanged
    expect(queue[0].id).toBe('e0');
    void original;
  });

  it('appends the entry to the end of the queue', () => {
    const q1 = enqueue([], makeEntry('e1', '2026-06-12T09:00:00Z'));
    const q2 = enqueue(q1, makeEntry('e2', '2026-06-12T10:00:00Z'));
    expect(q2).toHaveLength(2);
    expect(q2[0].id).toBe('e1');
    expect(q2[1].id).toBe('e2');
  });
});

// ---------------------------------------------------------------------------
// flush
// ---------------------------------------------------------------------------

describe('flush', () => {
  it('sorts entries chronologically by timestamp ascending', () => {
    const queue = [
      makeEntry('later', '2026-06-12T12:00:00Z'),
      makeEntry('earliest', '2026-06-12T08:00:00Z'),
      makeEntry('middle', '2026-06-12T10:00:00Z'),
    ];
    const { flushed } = flush(queue);
    expect(flushed[0].id).toBe('earliest');
    expect(flushed[1].id).toBe('middle');
    expect(flushed[2].id).toBe('later');
  });

  it('remaining is always empty', () => {
    const queue = [
      makeEntry('a', '2026-06-12T09:00:00Z'),
      makeEntry('b', '2026-06-12T10:00:00Z'),
    ];
    const { remaining } = flush(queue);
    expect(remaining).toHaveLength(0);
  });

  it('flushed contains all entries from queue', () => {
    const queue = [
      makeEntry('a', '2026-06-12T09:00:00Z'),
      makeEntry('b', '2026-06-12T10:00:00Z'),
      makeEntry('c', '2026-06-12T11:00:00Z'),
    ];
    const { flushed } = flush(queue);
    expect(flushed).toHaveLength(3);
  });

  it('does not mutate the original queue', () => {
    const queue = [
      makeEntry('b', '2026-06-12T10:00:00Z'),
      makeEntry('a', '2026-06-12T09:00:00Z'),
    ];
    flush(queue);
    // Original order preserved
    expect(queue[0].id).toBe('b');
    expect(queue[1].id).toBe('a');
  });

  it('empty queue → empty flushed', () => {
    const { flushed, remaining } = flush([]);
    expect(flushed).toHaveLength(0);
    expect(remaining).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mergeIntoLogs
// ---------------------------------------------------------------------------

describe('mergeIntoLogs', () => {
  it('concatenates existing and flushed, sorted by timestamp ascending', () => {
    const existing = [
      makeEntry('e1', '2026-06-12T09:00:00Z'),
      makeEntry('e3', '2026-06-12T11:00:00Z'),
    ];
    const flushed = [
      makeEntry('e2', '2026-06-12T10:00:00Z'),
      makeEntry('e4', '2026-06-12T12:00:00Z'),
    ];
    const result = mergeIntoLogs(existing, flushed);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe('e1');
    expect(result[1].id).toBe('e2');
    expect(result[2].id).toBe('e3');
    expect(result[3].id).toBe('e4');
  });

  it('deduplicates by id — flushed copy wins on same id', () => {
    const existing = [
      makeEntry('dup', '2026-06-12T09:00:00Z', { confirmed: false }),
    ];
    // Flushed copy of same id with different confirmed status
    const flushed = [
      makeEntry('dup', '2026-06-12T09:00:00Z', { confirmed: true }),
    ];
    const result = mergeIntoLogs(existing, flushed);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dup');
    expect(result[0].confirmed).toBe(true); // flushed (later in array) wins
  });

  it('does not mutate existing array', () => {
    const existing = [makeEntry('e1', '2026-06-12T09:00:00Z')];
    const flushed = [makeEntry('e2', '2026-06-12T10:00:00Z')];
    mergeIntoLogs(existing, flushed);
    expect(existing).toHaveLength(1);
  });

  it('handles empty flushed', () => {
    const existing = [makeEntry('e1', '2026-06-12T09:00:00Z')];
    const result = mergeIntoLogs(existing, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('handles empty existing', () => {
    const flushed = [makeEntry('e1', '2026-06-12T09:00:00Z')];
    const result = mergeIntoLogs([], flushed);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });
});
