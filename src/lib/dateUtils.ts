/**
 * Pure date/time helpers for day pairing and relative labels.
 *
 * All "day" operations work in LOCAL time (not UTC), because patients log
 * events in their local timezone (Peru: UTC-5, no DST).
 *
 * No side effects, no imports, fully tree-shakeable.
 */

// ---------------------------------------------------------------------------
// Basic construction
// ---------------------------------------------------------------------------

/**
 * Parse an ISO 8601 string into a Date.
 * Works with both "2026-06-04T07:00:00" (no offset) and offset variants.
 */
export function toDate(iso: string): Date {
  return new Date(iso);
}

// ---------------------------------------------------------------------------
// Day-bucketing helpers
// ---------------------------------------------------------------------------

/**
 * Returns the "YYYY-MM-DD" string for the LOCAL calendar date of an ISO
 * timestamp. Used everywhere as the canonical day key for bucketing.
 *
 * Example: "2026-06-04T01:30:00" in UTC-5 → local date "2026-06-03".
 */
export function dateKey(iso: string): string {
  const d = toDate(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * True when two ISO timestamps fall on the same LOCAL calendar date.
 */
export function isSameDay(a: string, b: string): boolean {
  return dateKey(a) === dateKey(b);
}

/**
 * Whole calendar-day distance between two ISO timestamps (local time).
 * Always non-negative: |floor(a_days) - floor(b_days)|.
 *
 * Example: "2026-06-04T23:59" vs "2026-06-06T00:01" → 2.
 */
export function daysBetween(aIso: string, bIso: string): number {
  const MS_PER_DAY = 86_400_000;
  const a = toDate(aIso);
  const b = toDate(bIso);

  // Truncate both to midnight LOCAL to avoid DST edge cases near 00:00.
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.abs(Math.round((bDay - aDay) / MS_PER_DAY));
}

// ---------------------------------------------------------------------------
// Relative labels (Peruvian Spanish)
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable Peruvian Spanish label for a date relative to now.
 *   0 days ago → "hoy"
 *   1 day ago  → "ayer"
 *   2 days ago → "anteayer"
 *   3+ days ago → "hace N días"
 *
 * @param iso  - ISO timestamp of the event.
 * @param now  - Inject a reference Date for testability (defaults to Date.now).
 */
export function relativeDayLabel(iso: string, now?: Date): string {
  const ref = now ?? new Date();
  const refIso = ref.toISOString();
  const delta = daysBetween(iso, refIso);

  if (delta === 0) return 'hoy';
  if (delta === 1) return 'ayer';
  if (delta === 2) return 'anteayer';
  return `hace ${delta} días`;
}

// ---------------------------------------------------------------------------
// Retroactive timestamp detection
// ---------------------------------------------------------------------------

/**
 * Given a free-text message from the patient, detect retroactive time cues
 * and return the ISO timestamp for when the event HAPPENED, or null if no
 * cue is found (caller should use current time).
 *
 * Recognised cues (case/accent-insensitive):
 *   "ayer"       → same clock time as `now`, but yesterday
 *   "anoche"     → yesterday at ~22:00
 *   "esta mañana"→ today at ~08:00
 *   "anteayer"   → 2 days ago, same clock time
 *   "hace N días"→ N whole days ago, same clock time
 *
 * @param text - Patient message text.
 * @param now  - Inject a reference Date for testability (defaults to Date.now).
 * @returns Adjusted ISO string, or null if no cue detected.
 */
export function resolveRetroactiveTimestamp(text: string, now?: Date): string | null {
  const ref = now ?? new Date();

  // Normalise: strip combining diacritics then fold to lower-case ASCII
  // so "ayer", "Ayer", "AYER" all match without needing accent variants.
  const normalise = (s: string): string =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip accents
      .toLowerCase();

  const norm = normalise(text);

  // Helper: clone ref, shift by N days, overwrite hours/minutes if given.
  const shifted = (daysBack: number, hour?: number, minute = 0): string => {
    const d = new Date(ref);
    d.setDate(d.getDate() - daysBack);
    if (hour !== undefined) {
      d.setHours(hour, minute, 0, 0);
    }
    return d.toISOString();
  };

  // "esta mañana" — must be checked before "ayer" to avoid partial overlap.
  if (/esta\s+ma[ñn]ana/.test(norm)) {
    return shifted(0, 8);
  }

  // "anteayer"
  if (/anteayer/.test(norm)) {
    return shifted(2);
  }

  // "anoche"
  if (/anoche/.test(norm)) {
    return shifted(1, 22);
  }

  // "ayer"
  if (/\bayer\b/.test(norm)) {
    return shifted(1);
  }

  // "hace N días" — match integer N.
  const haceMatch = norm.match(/\bhace\s+(\d+)\s+d[ií]as?\b/);
  if (haceMatch) {
    const n = parseInt(haceMatch[1], 10);
    return shifted(n);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Morning normalisation
// ---------------------------------------------------------------------------

/**
 * Returns an ISO timestamp at 07:00 LOCAL on the same calendar date as `iso`.
 * Used to normalise morning fasting readings to a canonical hour so that
 * day-bucketing comparisons are stable regardless of exact wake-up time.
 */
export function morningOf(iso: string): string {
  const d = toDate(iso);
  const normalised = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7, 0, 0, 0);
  return normalised.toISOString();
}

// ---------------------------------------------------------------------------
// Prior-night pairing key
// ---------------------------------------------------------------------------

/**
 * Returns the dateKey (YYYY-MM-DD) of the BEDTIME NIGHT that preceded a given
 * morning timestamp.
 *
 * CONVENTION (must be consistent across the entire app and seed data):
 * ─────────────────────────────────────────────────────────────────────
 * A sleep log's `timestamp` records the BEDTIME of the night, which falls on
 * calendar date D.  That sleep session ends on the MORNING of calendar date
 * D+1.  Therefore, a glucose "ayunas" reading on calendar date M was preceded
 * by a sleep session whose bedtime date is M-1.
 *
 * Concretely:
 *   sleep bedtime on Jun 3 (date D)   → wakes up on Jun 4 (date D+1)
 *   glucose "ayunas" on Jun 4 morning → priorNightKey = "2026-06-03"
 *
 * Usage:
 *   const key = priorNightKey(glucoseLog.timestamp);
 *   const matchingSleep = sleepLogs.find(s => dateKey(s.timestamp) === key);
 *
 * @param morningIso - ISO timestamp of a morning (glucose) reading.
 * @returns dateKey string for the BEDTIME calendar date (morning date − 1 day).
 */
export function priorNightKey(morningIso: string): string {
  const d = toDate(morningIso);
  // Subtract one calendar day at the LOCAL date level.
  const prevDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  const y = prevDay.getFullYear();
  const m = String(prevDay.getMonth() + 1).padStart(2, '0');
  const day = String(prevDay.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
