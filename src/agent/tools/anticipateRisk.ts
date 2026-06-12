/**
 * anticipateRisk — proactive, gentle heads-up about patterns from the current
 * application state.
 *
 * Non-alarmist: uses "te sugiero", never "vas a tener un pico".
 */

import type { AppState, SleepLog } from '@/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Passthrough: wrap any free-text message in the standard tool return shape.
 * Preserved for backward compatibility — used by MockAgentProvider today.
 */
export function anticipateRisk(message: string): { message: string } {
  return { message };
}

/**
 * Examine the most recent sleep log in state and, if the person slept fewer
 * than 6 hours AND a clear sleep-glucose insight already exists, return a
 * gentle, non-alarmist proactive message.  Returns null otherwise.
 *
 * The caller should check the result before surfacing it to the user so that
 * the message is only shown when it adds value.
 */
export function anticipateRiskFromContext(
  state: AppState,
): { message: string } | null {
  // Find the most recent sleep log for the current person.
  const sleepLogs = state.logs
    .filter(
      (l): l is SleepLog =>
        l.type === 'sleep' && l.personId === state.currentPersonId,
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

  if (sleepLogs.length === 0) return null;

  const latest = sleepLogs[0];
  if (latest.payload.hours >= 6) return null;

  // Check whether a clear sleep-glucose insight already exists.
  const clearInsight = state.insights.find(
    (i) =>
      i.pattern === 'sleep_glucose' &&
      i.confidence === 'clear' &&
      i.personId === state.currentPersonId,
  );

  if (!clearInsight) return null;

  const hours = latest.payload.hours;

  // Non-alarmist, actionable message in Peruvian Spanish.
  const message =
    `Dormiste ${hours} horas anoche. Te sugiero tomar agua esta mañana y estar atento a cómo te sientes — no hay que alarmarse, pero cuando descansamos poco, a veces el azúcar de la mañana sale un poco más alta. Nada que no se pueda manejar.`;

  return { message };
}
