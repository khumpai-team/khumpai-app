/**
 * Deterministic offline rules evaluated without AI or network.
 *
 * Priority order (highest to lowest — first match wins, return null if none):
 *   1. glucose_low       — latest glucose < 70     → emergency
 *   2. glucose_high      — latest glucose > 250    → urgent
 *   3. sleep_short       — most recent sleep < 5h  → warning
 *   4. medication_overdue — a scheduled dose today is past now with no record  → info
 *
 * All functions are pure; inject `now` for deterministic testing.
 */

import type { AppState, GlucoseLog, OfflineResponse, SleepLog } from '@/types';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { dateKey } from '@/lib/dateUtils';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns the glucose log with the maximum timestamp for the given person, or undefined. */
function latestGlucoseLog(state: AppState): GlucoseLog | undefined {
  const logs = state.logs.filter(
    (l): l is GlucoseLog => l.type === 'glucose' && l.personId === state.currentPersonId,
  );
  if (logs.length === 0) return undefined;
  return logs.reduce((best, cur) =>
    cur.timestamp > best.timestamp ? cur : best,
  );
}

/** Returns the sleep log with the maximum timestamp for the given person, or undefined. */
function latestSleepLog(state: AppState): SleepLog | undefined {
  const logs = state.logs.filter(
    (l): l is SleepLog => l.type === 'sleep' && l.personId === state.currentPersonId,
  );
  if (logs.length === 0) return undefined;
  return logs.reduce((best, cur) =>
    cur.timestamp > best.timestamp ? cur : best,
  );
}

/**
 * Converts "HH:mm" into a Date on the given calendar date (local time).
 * Used to compare a scheduled dose time against the reference time.
 */
function scheduledDateTime(dateStr: string, time: string): Date {
  // dateStr is "YYYY-MM-DD", time is "HH:mm"
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  // Construct using local-time components matching how dateKey works.
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate deterministic local rules over the current AppState.
 *
 * Returns the single highest-priority OfflineResponse that matches, or null
 * if no rule fires.
 *
 * @param state - Current application state.
 * @param now   - Reference time (injectable for testing). Defaults to new Date().
 */
export function evaluateOfflineRules(state: AppState, now?: Date): OfflineResponse | null {
  const reference = now ?? new Date();

  // -----------------------------------------------------------------------
  // Priority 1 — glucose_low (< 70 mg/dL) — EMERGENCY
  // -----------------------------------------------------------------------
  const latestGlucose = latestGlucoseLog(state);
  // Only apply glucose rules when the reading is within the last 12 hours;
  // a stale reading from a previous day must not keep triggering an emergency.
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  const glucoseIsRecent =
    latestGlucose !== undefined &&
    reference.getTime() - new Date(latestGlucose.timestamp).getTime() <= TWELVE_HOURS_MS;

  if (latestGlucose !== undefined && glucoseIsRecent) {
    const v = latestGlucose.payload.value;

    if (v < 70) {
      return {
        severity: 'emergency',
        message: AGENT_ES.offline.glucoseLow(v),
        rule: 'glucose_low',
        showEmergencyContact: true,
      };
    }

    // -----------------------------------------------------------------------
    // Priority 2 — glucose_high (> 250 mg/dL) — URGENT
    // Calm tone: suggests contacting doctor + emergency contact.
    // -----------------------------------------------------------------------
    if (v > 250) {
      return {
        severity: 'urgent',
        message: AGENT_ES.offline.glucoseVeryHigh(v),
        rule: 'glucose_high',
        showEmergencyContact: true,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Priority 3 — sleep_short (most recent sleep < 5h) — WARNING
  // -----------------------------------------------------------------------
  const latestSleep = latestSleepLog(state);
  if (latestSleep !== undefined && latestSleep.payload.hours < 5) {
    return {
      severity: 'warning',
      message: AGENT_ES.offline.sleepShort(latestSleep.payload.hours),
      rule: 'sleep_short',
      showEmergencyContact: false,
    };
  }

  // -----------------------------------------------------------------------
  // Priority 4 — medication_overdue — INFO
  // A scheduled dose for TODAY is past `now` with no matching taken AdherenceRecord.
  // -----------------------------------------------------------------------
  const todayKey = dateKey(reference.toISOString());
  const personMeds = state.medications.filter(
    (m) => m.personId === state.currentPersonId,
  );

  for (const med of personMeds) {
    for (const schedTime of med.schedule) {
      const doseDateTime = scheduledDateTime(todayKey, schedTime);

      // Only consider doses whose scheduled time has already passed.
      if (doseDateTime > reference) continue;

      // Check if there is a taken adherence record for today at this time.
      const taken = med.adherenceLog.some(
        (rec) =>
          rec.date === todayKey &&
          rec.scheduledTime === schedTime &&
          rec.taken === true,
      );

      if (!taken) {
        return {
          severity: 'info',
          message: AGENT_ES.offline.medicationOverdue(med.name, schedTime),
          rule: 'medication_overdue',
          showEmergencyContact: false,
        };
      }
    }
  }

  return null;
}
