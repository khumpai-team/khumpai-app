/**
 * looksLikeFoodLog — offline-only heuristic for logging a bare food/drink.
 *
 * The regex parser only recognizes a meal when there's a verb ("comí…",
 * "desayuné…"). Offline (no model), people also type the food alone —
 * "pan con palta", "arroz con pollo" — and expect it logged. This detects that:
 * a known Peruvian food mentioned as a STATEMENT (not a question).
 *
 * It must NOT fire on questions ("¿puedo comer arroz?", "el camote es bueno")
 * — those should be answered from the digest, not logged. isEducationQuestion
 * carries the question/topic cues, so we use it as the negative gate.
 *
 * Returns the food description to log, or null.
 */

import { findFood } from '@/data/peruvian-foods';
import { isEducationQuestion } from '@/agent/education';

export function looksLikeFoodLog(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (isEducationQuestion(trimmed)) return null; // it's a question, not a log
  return findFood(trimmed) ? trimmed : null;
}
