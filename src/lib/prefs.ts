/**
 * Preference learning helpers — pure functions returning a NEW UserPrefs.
 *
 * No mutations, no side effects. All inputs are treated as immutable.
 * Inject state; return updated copies. The store owns persistence.
 */

import type { InputMode, UserPrefs } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of top active hours to surface in UserPrefs.activeHours. */
const TOP_ACTIVE_HOURS = 5;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Computes preferredInputMode as the InputMode with the highest count.
 * In case of a tie, the earlier key in iteration order wins (stable).
 */
function computePreferredInputMode(counts: Record<InputMode, number>): InputMode {
  const modes: InputMode[] = ['text', 'voice', 'quick_action'];
  return modes.reduce((best, mode) => (counts[mode] > counts[best] ? mode : best), modes[0]);
}

/**
 * Computes activeHours as the top TOP_ACTIVE_HOURS hours sorted by count descending.
 * Ties are broken by hour number ascending for stability.
 */
function computeActiveHours(counts: Record<string, number>): number[] {
  return Object.entries(counts)
    .map(([h, c]) => ({ hour: parseInt(h, 10), count: c }))
    .sort((a, b) => b.count - a.count || a.hour - b.hour)
    .slice(0, TOP_ACTIVE_HOURS)
    .map((e) => e.hour);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Records that the user used the given InputMode once.
 * Increments inputModeCounts[mode] and recomputes preferredInputMode.
 *
 * @param prefs - Current preferences (not mutated).
 * @param mode  - The input mode that was used.
 * @returns New UserPrefs with updated counts and preferredInputMode.
 */
export function recordInputMode(prefs: UserPrefs, mode: InputMode): UserPrefs {
  const updatedCounts: Record<InputMode, number> = {
    ...prefs.inputModeCounts,
    [mode]: (prefs.inputModeCounts[mode] ?? 0) + 1,
  };
  return {
    ...prefs,
    inputModeCounts: updatedCounts,
    preferredInputMode: computePreferredInputMode(updatedCounts),
  };
}

/**
 * Records that the user was active at the given hour of day (0-23).
 * Increments activeHourCounts[String(hour)] and recomputes activeHours.
 *
 * @param prefs - Current preferences (not mutated).
 * @param hour  - Hour of day (0-23).
 * @returns New UserPrefs with updated hour counts and activeHours list.
 */
export function recordActiveHour(prefs: UserPrefs, hour: number): UserPrefs {
  const key = String(hour);
  const updatedCounts: Record<string, number> = {
    ...prefs.activeHourCounts,
    [key]: (prefs.activeHourCounts[key] ?? 0) + 1,
  };
  return {
    ...prefs,
    activeHourCounts: updatedCounts,
    activeHours: computeActiveHours(updatedCounts),
  };
}

/**
 * Records that a suggestion of the given type was shown and either accepted
 * or rejected by the user. Increments the appropriate counter.
 *
 * @param prefs    - Current preferences (not mutated).
 * @param type     - Suggestion type key, e.g. "meal_logging".
 * @param accepted - True when the user accepted the suggestion.
 * @returns New UserPrefs with updated suggestion counters.
 */
export function recordSuggestion(prefs: UserPrefs, type: string, accepted: boolean): UserPrefs {
  if (accepted) {
    return {
      ...prefs,
      acceptedSuggestionTypes: {
        ...prefs.acceptedSuggestionTypes,
        [type]: (prefs.acceptedSuggestionTypes[type] ?? 0) + 1,
      },
    };
  }
  return {
    ...prefs,
    rejectedSuggestionTypes: {
      ...prefs.rejectedSuggestionTypes,
      [type]: (prefs.rejectedSuggestionTypes[type] ?? 0) + 1,
    },
  };
}

/**
 * Returns the suggestion type with the highest net score (accepted - rejected).
 *
 * This is the one externally visible preference used by anticipateRisk/actions.
 *
 * @param prefs - Current preferences.
 * @returns The suggestion type with the highest net score, or null if there
 *          are no accepted suggestions or all net scores are ≤ 0.
 */
export function getPreferredSuggestionType(prefs: UserPrefs): string | null {
  // Collect all known suggestion types from both maps.
  const allTypes = new Set([
    ...Object.keys(prefs.acceptedSuggestionTypes),
    ...Object.keys(prefs.rejectedSuggestionTypes),
  ]);

  if (allTypes.size === 0) return null;

  let bestType: string | null = null;
  let bestScore = 0; // must beat 0 to qualify

  for (const type of allTypes) {
    const accepted = prefs.acceptedSuggestionTypes[type] ?? 0;
    const rejected = prefs.rejectedSuggestionTypes[type] ?? 0;
    const score = accepted - rejected;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}
