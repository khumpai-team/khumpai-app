/**
 * Precomputed package generator — assembles the offline / fast morning payload
 * from current AppState, Peruvian food data, and AGENT_ES strings.
 *
 * Pure: all inputs are injected; `now` is injectable for deterministic tests.
 * No AI, no network — deterministic business logic only.
 */

import type { AppState, PrecomputedPackage } from '@/types';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { PERUVIAN_FOODS } from '@/data/peruvian-foods';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Finds the current person's display name from state.persons (falls back to state.user.name). */
function personName(state: AppState): string {
  const person = state.persons.find((p) => p.id === state.currentPersonId);
  return person?.name ?? state.user.name;
}

/** Returns the hour (0-23) from a Date in local time. */
function localHour(d: Date): number {
  return d.getHours();
}

/**
 * Checks whether there is a clear sleep_glucose insight active for the current person.
 * Returns true when at least one 'sleep_glucose' insight with confidence 'clear'
 * exists for the current person.
 */
function hasClearSleepGlucoseInsight(state: AppState): boolean {
  return state.insights.some(
    (ins) =>
      ins.personId === state.currentPersonId &&
      ins.pattern === 'sleep_glucose' &&
      ins.confidence === 'clear',
  );
}

/**
 * Derives meal guidance based on user patterns and the Peruvian foods table.
 *
 * Strategy:
 * 1. If a clear sleep_glucose insight exists, weave a gentle sleep-care suggestion
 *    into the breakfast guidance.
 * 2. Always suggest a specific low-GI Peruvian breakfast food from the table.
 * 3. Fall back to AGENT_ES.morningCheckin.mealGuidance if nothing else applies.
 */
function deriveMealGuidance(state: AppState): string {
  // Pick a low-GI breakfast-friendly food from the table.
  const lowGiBreakfastFoods = PERUVIAN_FOODS.filter(
    (f) => f.glycemicIndex === 'bajo' || f.glycemicIndex === 'medio',
  );

  // Prefer foods that are classically breakfast (avena, pan con palta, emoliente).
  const breakfastPreferred = ['avena', 'pan con palta', 'emoliente', 'quinua'];
  const chosen =
    lowGiBreakfastFoods.find((f) => breakfastPreferred.some((bp) => f.name.includes(bp))) ??
    lowGiBreakfastFoods[0];

  const foodNote = chosen
    ? `${chosen.name.charAt(0).toUpperCase() + chosen.name.slice(1)}: ${chosen.note}`
    : AGENT_ES.morningCheckin.mealGuidance;

  if (hasClearSleepGlucoseInsight(state)) {
    // Weave in a gentle sleep tip when the pattern is confirmed.
    return `${AGENT_ES.insights.sleepGlucosePattern} Para el desayuno, te sugerimos: ${foodNote}`;
  }

  return `${AGENT_ES.morningCheckin.mealGuidance} Una buena opción: ${foodNote}`;
}

/**
 * Generates a time-of-day-aware morning greeting.
 * Uses AGENT_ES.morningCheckin.greeting for mornings, greetings.* otherwise.
 */
function buildMorningGreeting(name: string, now: Date): string {
  const hour = localHour(now);

  if (hour >= 5 && hour < 12) {
    return AGENT_ES.morningCheckin.greeting(name);
  }
  if (hour >= 12 && hour < 14) {
    return AGENT_ES.greetings.midday(name);
  }
  if (hour >= 14 && hour < 20) {
    return AGENT_ES.greetings.afternoon(name);
  }
  return AGENT_ES.greetings.evening(name);
}

/**
 * Builds the education snippet from AGENT_ES insights / education lines.
 * Prefers the sleep-glucose insight text when that pattern is clear, otherwise
 * falls back to a generic insulin-resistance note. Source is always 'MINSA'.
 */
function buildEducationSnippet(state: AppState): { content: string; source: string } {
  if (hasClearSleepGlucoseInsight(state)) {
    return {
      content: AGENT_ES.insights.sleepGlucosePattern,
      source: 'MINSA',
    };
  }

  // Generic fallback: a useful general diabetes education note from AGENT_ES.
  return {
    content:
      'Llevar un registro diario de tu azúcar, comidas y cómo te sientes ayuda a tu médico a ajustar tu tratamiento. ' +
      AGENT_ES.insights.disclaimer,
    source: 'MINSA',
  };
}

/**
 * Constructs red-flag reminders from AGENT_ES.offline and AGENT_ES.redFlags phrasing.
 */
function buildRedFlagReminders(): string[] {
  return [
    AGENT_ES.offline.glucoseVeryHigh(250),
    AGENT_ES.offline.glucoseLow(69),
    AGENT_ES.redFlags.urgent('visión borrosa, mucha sed o mareo fuerte'),
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a PrecomputedPackage from the current AppState.
 *
 * @param state - Current application state.
 * @param now   - Reference time (injectable for testing). Defaults to new Date().
 * @returns A complete PrecomputedPackage valid for 12 hours from `now`.
 */
export function generatePrecomputedPackage(state: AppState, now?: Date): PrecomputedPackage {
  const reference = now ?? new Date();
  const name = personName(state);

  // validUntil = now + 12 hours
  const validUntilDate = new Date(reference.getTime() + 12 * 60 * 60 * 1000);

  const morningGreeting = buildMorningGreeting(name, reference);
  const morningCheckin = AGENT_ES.morningCheckin.checkin;
  const mealGuidance = deriveMealGuidance(state);
  const motivationalMessage = AGENT_ES.morningCheckin.motivational;
  const educationSnippet = buildEducationSnippet(state);
  const redFlagReminders = buildRedFlagReminders();

  return {
    generatedAt: reference.toISOString(),
    validUntil: validUntilDate.toISOString(),
    morningGreeting,
    morningCheckin,
    mealGuidance,
    motivationalMessage,
    educationSnippet,
    redFlagReminders,
  };
}
