/**
 * getSummary — pure summary aggregation over log arrays.
 *
 * Computes glucose stats, meal count, sleep average, and medication adherence
 * for a given period (day / week / month).  No store access.
 */

import type { LogEntry, GlucoseLog, SleepLog, Medication, AdherenceRecord } from '@/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SummaryPeriod = 'day' | 'week' | 'month' | '3months';

export interface GlucoseSummary {
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface Summary {
  period: SummaryPeriod;
  glucose: GlucoseSummary;
  /** Number of meal log entries in the period. */
  meals: number;
  /** Average sleep hours in the period, or null if no sleep logs. */
  sleepAvg: number | null;
  /**
   * Medication adherence percentage (0-100), or null if no medications / no
   * scheduled doses in the period.
   */
  adherencePct: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function periodMs(period: SummaryPeriod): number {
  switch (period) {
    case 'day':     return 86_400_000;
    case 'week':    return 7 * 86_400_000;
    case 'month':   return 30 * 86_400_000;
    case '3months': return 90 * 86_400_000;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Summarise log data for the chosen period ending at refDate (defaults to now).
 *
 * @param logs         - All log entries for the person.
 * @param period       - Time window: 'day' = 24h, 'week' = 7d, 'month' = 30d.
 * @param medications  - Optional medication list to compute adherence.
 * @param refDate      - Reference end-of-window date (defaults to now).
 */
export function getSummary(
  logs: LogEntry[],
  period: SummaryPeriod,
  medications?: Medication[],
  refDate?: Date,
): Summary {
  const ref = refDate ?? new Date();
  const windowMs = periodMs(period);
  const cutoff = ref.getTime() - windowMs;

  const refMs = ref.getTime();
  const inWindow = (entry: LogEntry): boolean => {
    const t = new Date(entry.timestamp).getTime();
    return t >= cutoff && t <= refMs;
  };

  // Glucose
  const glucoseLogs = logs.filter(
    (l): l is GlucoseLog => l.type === 'glucose' && inWindow(l),
  );
  const values = glucoseLogs.map((g) => g.payload.value);
  const glucoseSummary: GlucoseSummary =
    values.length === 0
      ? { count: 0, avg: null, min: null, max: null }
      : {
          count: values.length,
          avg: round1(values.reduce((s, v) => s + v, 0) / values.length),
          min: Math.min(...values),
          max: Math.max(...values),
        };

  // Meals
  const meals = logs.filter((l) => l.type === 'meal' && inWindow(l)).length;

  // Sleep average
  const sleepLogs = logs.filter(
    (l): l is SleepLog => l.type === 'sleep' && inWindow(l),
  );
  const sleepAvg =
    sleepLogs.length === 0
      ? null
      : round1(
          sleepLogs.reduce((s, l) => s + l.payload.hours, 0) / sleepLogs.length,
        );

  // Adherence — only count doses scheduled within the window
  let adherencePct: number | null = null;
  if (medications && medications.length > 0) {
    const cutoffDate = new Date(cutoff);
    const refDateStr = ref.toISOString().slice(0, 10);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10);

    const allRecords: AdherenceRecord[] = medications.flatMap((m) =>
      m.adherenceLog.filter(
        (r) => r.date >= cutoffDateStr && r.date <= refDateStr,
      ),
    );

    if (allRecords.length > 0) {
      const taken = allRecords.filter((r) => r.taken).length;
      adherencePct = Math.round((taken / allRecords.length) * 100);
    }
  }

  return { period, glucose: glucoseSummary, meals, sleepAvg, adherencePct };
}
