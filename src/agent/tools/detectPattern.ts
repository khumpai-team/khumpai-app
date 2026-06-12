/**
 * detectPattern — surface precomputed insights and run the sleep-glucose
 * correlation on live log data.
 *
 * Honest about sample size: runPatternDetection returns null when confidence
 * is null (fewer than 2 matching pairs).
 */

import { SEED_INSIGHTS } from '@/data/seed';
import { detectSleepGlucoseCorrelation } from '@/lib/correlation';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { uid } from '@/lib/id';
import type { Insight, LogEntry } from '@/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a precomputed insight by pattern key in the seed insight list.
 *
 * @param pattern - Machine key, e.g. 'sleep_glucose'.
 * @returns The matching Insight or undefined.
 */
export function detectPattern(pattern: string): Insight | undefined {
  return SEED_INSIGHTS.find((i) => i.pattern === pattern);
}

/**
 * Run the sleep-glucose correlation over a set of live log entries and build
 * a fresh Insight if enough data exists.
 *
 * Returns null HONESTLY when confidence is null (<2 matching pairs) — the
 * caller must not present a pattern that isn't supported by the data.
 *
 * @param logs      - Log entries (typically from the store or seed).
 * @param personId  - Person whose insight this is (defaults to 'carlos').
 */
export function runPatternDetection(
  logs: LogEntry[],
  personId = 'carlos',
): Insight | null {
  const result = detectSleepGlucoseCorrelation(logs);

  if (result.confidence === null) {
    // Not enough data — HONEST: do not invent a pattern.
    return null;
  }

  const text =
    AGENT_ES.insights.sleepGlucosePattern +
    ' ' +
    AGENT_ES.insights.disclaimer;

  return {
    id: uid('ins'),
    personId,
    pattern: 'sleep_glucose',
    confidence: result.confidence,
    basedOnCount: result.matchingCount,
    text,
    chartData: result.chartData,
  };
}
