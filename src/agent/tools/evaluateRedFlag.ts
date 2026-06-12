/**
 * evaluateRedFlag — assess patient-reported symptoms and glucose values for
 * escalation level.  Pure, no side effects.
 */

import { AGENT_ES } from '@/data/i18n/agent-es';
import type { RedFlagLevel } from '@/types';

// ---------------------------------------------------------------------------
// Regex classifiers for symptom descriptions (Peruvian Spanish)
// Covers the key red-flag phrases required by the safety spec.
// ---------------------------------------------------------------------------

const EMERGENCY_RE =
  /(dolor\s+(en\s+el\s+)?pecho|pecho\s+apretado|no\s+puedo\s+respirar|me\s+falta\s+el\s+aire|desmay|p[eé]rdida\s+de\s+(conocimiento|sensibilidad)|confusi[oó]n|pie\s+(negro|morado)|herida\s+que\s+no\s+(sana|cierra)|[uú]lcera|llaga)/i;

const URGENT_RE =
  /(herida\s+que\s+no\s+(sana|cicatriz)|[uú]lcera|llaga|fiebre\s+alta|v[oó]mito|visi[oó]n\s+borrosa|no\s+veo\s+bien|mareo\s+fuerte|me\s+desmayi)/i;

const WATCH_RE =
  /(herida|ampolla|hinchaz[oó]n|hinchad|mareo|maread|n[aá]usea|hormigueo|ardor\s+al\s+orinar|mucha\s+sed|no\s+siento\s+(los|las)?\s*(pies|piernas|manos)|p[eé]rdida\s+de\s+sensibilidad)/i;

// ---------------------------------------------------------------------------
// Symptom evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate a free-text symptom description and return an escalation level
 * with a Peruvian Spanish message.
 *
 * Emergency covers: chest pain, can't breathe, fainting, non-healing wound,
 *   ulcer, sore, vision problems.
 * Urgent covers: wound not healing, high fever, vomiting, blurry vision.
 * Watch covers: wound, blister, swelling, dizziness, nausea, tingling, burning
 *   when urinating, extreme thirst.
 */
export function evaluateRedFlag(description: string): {
  level: RedFlagLevel;
  message: string;
} {
  if (EMERGENCY_RE.test(description))
    return { level: 'emergency', message: AGENT_ES.redFlags.emergency(description) };
  if (URGENT_RE.test(description))
    return { level: 'urgent', message: AGENT_ES.redFlags.urgent(description) };
  if (WATCH_RE.test(description))
    return { level: 'watch', message: AGENT_ES.redFlags.watch(description) };
  return { level: 'ok', message: AGENT_ES.confirmations.savedSymptom };
}

// ---------------------------------------------------------------------------
// Numeric glucose evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate a numeric blood-glucose reading (mg/dL) and return an escalation
 * level with a contextual message.
 *
 *   < 60          → 'emergency'  (severely low, act now)
 *   > 300         → 'emergency'  (dangerously high, seek help)
 *   250 … 300     → 'urgent'
 *   180 … < 250   → 'watch'
 *   else          → 'ok'
 */
export function evaluateGlucoseRedFlag(value: number): {
  level: RedFlagLevel;
  message: string;
} {
  if (value < 60) {
    return {
      level: 'emergency',
      message: AGENT_ES.glucose.low(value),
    };
  }
  if (value > 300) {
    return {
      level: 'emergency',
      message: AGENT_ES.glucose.veryHigh(value),
    };
  }
  if (value > 250) {
    // 250 < value <= 300
    return {
      level: 'urgent',
      message: AGENT_ES.glucose.veryHigh(value),
    };
  }
  if (value >= 180) {
    // 180 <= value <= 250
    return {
      level: 'watch',
      message: AGENT_ES.glucose.high(value),
    };
  }
  return {
    level: 'ok',
    message: AGENT_ES.glucose.ok(value),
  };
}
