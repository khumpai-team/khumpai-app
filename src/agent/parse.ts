/**
 * Lightweight Spanish (Peruvian) intent parser for the mock agent.
 *
 * Deliberately forgiving: accents optional, word order loose. It's the stand-in
 * for what a real LLM will do via tool-calling, so it only needs to be good
 * enough to drive a convincing demo. Output maps onto the `@/types` payload
 * model (MealContext, GlucoseMoment, …).
 */

import type { GlucoseMoment, MealContext } from '@/types';
import { resolveRetroactiveTimestamp } from '@/lib/dateUtils';

/**
 * Optional third-person subject for data-bearing intents.
 * Absent means the entry is for the logged-in user (self).
 */
export type IntentSubject = 'self' | 'father' | 'mother';

export type ParsedIntent =
  | {
      kind: 'meal';
      context: MealContext;
      description: string;
      /** A glucose reading volunteered with the meal. */
      glucose?: number;
      /** The moment that paired glucose belongs to (derived from the verb). */
      glucoseMoment?: GlucoseMoment;
      /** Third-person subject when the patient is logging for a family member. */
      subject?: IntentSubject;
      /** ISO timestamp when the event retroactively happened (e.g. "ayer almorcé…"). */
      retroTimestamp?: string;
    }
  | {
      kind: 'glucose';
      value: number;
      moment: GlucoseMoment;
      subject?: IntentSubject;
      retroTimestamp?: string;
    }
  | {
      kind: 'sleep';
      hours: number;
      subject?: IntentSubject;
      retroTimestamp?: string;
    }
  | {
      kind: 'medication';
      taken: boolean;
      name: string;
      subject?: IntentSubject;
      retroTimestamp?: string;
    }
  | {
      kind: 'symptom';
      description: string;
      subject?: IntentSubject;
      retroTimestamp?: string;
    }
  | { kind: 'guardrail'; reason: 'dose' | 'diagnosis' | 'stop' | 'injection' }
  | { kind: 'unknown' };

/** Strip accents and lowercase, for matching only (not for display). */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// ---------------------------------------------------------------------------
// Subject detection — "mi papá / mi mamá / a mi padre" etc.
// ---------------------------------------------------------------------------

/**
 * Patterns that signal the patient is logging for a family member.
 * Must appear at the start of the message (with optional leading "a ").
 */
const SUBJECT_RE =
  /^(a\s+)?(mi\s+)?(papa|papá|padre|papa)\b/;
const MOTHER_RE =
  /^(a\s+)?(mi\s+)?(mama|mamá|madre)\b/;

/**
 * Detect a third-person subject prefix.
 * Returns the detected subject ('father'|'mother') and the text with the
 * subject phrase stripped, ready for the rest of the parsers.
 */
function detectSubject(text: string, n: string): { subject?: IntentSubject; stripped: string } {
  if (MOTHER_RE.test(n)) {
    const stripped = text.replace(/^(a\s+)?(mi\s+)?(mama|mamá|madre)\s*/i, '').trim();
    return { subject: 'mother', stripped };
  }
  if (SUBJECT_RE.test(n)) {
    const stripped = text.replace(/^(a\s+)?(mi\s+)?(papa|papá|padre)\s*/i, '').trim();
    return { subject: 'father', stripped };
  }
  return { stripped: text };
}

// ---------------------------------------------------------------------------
// Prompt-injection guardrail
// ---------------------------------------------------------------------------

/**
 * Detects common prompt-injection / jailbreak patterns in the user's message.
 * Returns true if the message looks like an attempt to override the agent's
 * instructions; caller should respond with a guardrail.
 */
const INJECTION_RE =
  /ignora|olvida\s+(tus|las)\s+(reglas|instrucciones)|act[uú]a\s+como|haz\s+de\s+cuenta|act\s+as|eres\s+un|eres\s+mi|pretende|finge|simula|sin\s+restricciones|a\s+partir\s+de\s+ahora\s+eres/i;

const GLUCOSE_RE = /\b(\d{2,3})\b/;

/** Pull a plausible glucose value (50–600 mg/dL) out of a phrase. */
const extractGlucose = (text: string): number | undefined => {
  const m = text.match(GLUCOSE_RE);
  if (!m) return undefined;
  const v = Number(m[1]);
  return v >= 50 && v <= 600 ? v : undefined;
};

const detectContext = (n: string): MealContext =>
  /\b(fuera|en la calle|restaurante|menu del dia|menu|polleria|chifa|huarique)\b/.test(n)
    ? 'fuera'
    : 'casa';

const MEAL_VERBS: { re: RegExp; moment: GlucoseMoment }[] = [
  { re: /desayun[eé]/, moment: 'post-desayuno' },
  { re: /almorc[eé]/, moment: 'post-almuerzo' },
  { re: /cen[eé]/, moment: 'post-cena' },
  { re: /com[ií]/, moment: 'post-almuerzo' },
];

/** Extract the food description: text after the verb, minus the glucose clause. */
const extractMealDescription = (raw: string): string => {
  let desc = raw.replace(
    /\s*[,;]?\s*(y\s+)?(me\s+)?(sali[oó]|marc[oó]|midi[oó]|fue|dio)\b.*$/i,
    '',
  );
  desc = desc.replace(/^.*?\b(desayun[eé]|almorc[eé]|cen[eé]|com[ií])\b\s*/i, '');
  return desc.trim().replace(/\s+/g, ' ');
};

/** Infer a glucose moment from free text (defaults to ayunas/post-almuerzo). */
const inferMoment = (n: string): GlucoseMoment => {
  if (/ayunas|ayuno|amanec|en la maniana|al despertar|antes de (comer|desayunar)/.test(n))
    return 'ayunas';
  if (/despu[eé]s de desayunar|post.?desayuno|del desayuno/.test(n)) return 'post-desayuno';
  if (/despu[eé]s de cenar|post.?cena|de la cena/.test(n)) return 'post-cena';
  if (/despu[eé]s de almorzar|post.?almuerzo|del almuerzo/.test(n)) return 'post-almuerzo';
  return 'ayunas';
};

export function parseMessage(raw: string): ParsedIntent {
  const text = raw.trim();
  if (!text) return { kind: 'unknown' };

  // 0. Prompt-injection guardrail — check before subject stripping so an
  //    attacker cannot bypass it by prefixing "mi papá".
  if (INJECTION_RE.test(text)) {
    return { kind: 'guardrail', reason: 'injection' };
  }

  // Detect and strip any third-person subject prefix ("mi papá", "mi mamá", …).
  const { subject, stripped } = detectSubject(text, norm(text));
  // Use the stripped text for the rest of parsing.
  const workText = stripped || text;
  const n = norm(workText);

  // Resolve retroactive timestamp from the ORIGINAL text (the cue is usually
  // in the prefix — "ayer almorcé…" — so we keep the full phrase).
  const retroRaw = resolveRetroactiveTimestamp(text);
  const retroTimestamp = retroRaw ?? undefined;

  // 1. Medication — "(ya) tomé / no tomé (la pastilla|metformina)"
  if (/\b(pastilla|metformina|medicina|medicamento|remedio)\b/.test(n)) {
    const didNotTake = /\bno\s+(la\s+|me\s+la\s+)?tom/.test(n);
    const tookIt = /\b(ya\s+)?tom[eé]\b/.test(n);
    if (didNotTake || tookIt) {
      // If the message also contains a dose-question cue (asking whether to take
      // another/more), fall through so the dose guardrail (step 7) can catch it.
      const hasDoseCue =
        /(otra|otro|m[aá]s|dos|cu[aá]nt|debo|puedo|deber[ií]a)/.test(n);
      if (!hasDoseCue) {
        return {
          kind: 'medication',
          taken: !didNotTake,
          name: 'Metformina',
          ...(subject && { subject }),
          ...(retroTimestamp && { retroTimestamp }),
        };
      }
    }
  }

  // 2. Sleep — "dormí N horas"
  // Matches first- and third-person forms: dormí, dormi, durmió, durmieron, duermo…
  const sleepMatch = n.match(/(?:dorm|durm|duerm)\w*.*?(\d{1,2}(?:[.,]\d)?)\s*(h|hora)/);
  if (sleepMatch) {
    const hours = Number(sleepMatch[1].replace(',', '.'));
    if (hours > 0 && hours <= 16) {
      return {
        kind: 'sleep',
        hours,
        ...(subject && { subject }),
        ...(retroTimestamp && { retroTimestamp }),
      };
    }
  }

  // 3. Meal — "desayuné/almorcé/cené/comí X [y me salió N]"
  for (const { re, moment } of MEAL_VERBS) {
    if (re.test(n)) {
      const description = extractMealDescription(workText) || 'Comida';
      const context = detectContext(n);
      const mentionsReading = /(sali[oó]|marc[oó]|midi[oó]|az[uú]car|gluco)/.test(n);
      const glucose = mentionsReading ? extractGlucose(workText) : undefined;
      return {
        kind: 'meal',
        context,
        description,
        glucose,
        glucoseMoment: glucose != null ? moment : undefined,
        ...(subject && { subject }),
        ...(retroTimestamp && { retroTimestamp }),
      };
    }
  }

  // 4. Glucose — "me salió/midió/marcó N"
  if (/(me\s+sali[oó]|midi[oó]|marc[oó]|az[uú]car|gluco)/.test(n)) {
    const value = extractGlucose(workText);
    if (value) {
      return {
        kind: 'glucose',
        value,
        moment: inferMoment(n),
        ...(subject && { subject }),
        ...(retroTimestamp && { retroTimestamp }),
      };
    }
  }

  // 5. Symptom — "me duele X / tengo una herida X / me siento mal / mareo / hormigueo …"
  if (/me duele\s+/.test(n) || /\bme\s+siento\s+(mal|mareado|cansado)\b/.test(n)) {
    return {
      kind: 'symptom',
      description: workText.trim(),
      ...(subject && { subject }),
      ...(retroTimestamp && { retroTimestamp }),
    };
  }
  if (
    /\b(herida|llaga|[uú]lcera|ampolla|hinchaz[oó]n|hinchad|mareo|n[aá]usea|v[oó]mito|visi[oó]n borrosa|hormigueo|adormecimiento|pie (negro|morado|frio)|ardor al orinar)\b/.test(
      n,
    )
  ) {
    return {
      kind: 'symptom',
      description: workText.trim(),
      ...(subject && { subject }),
      ...(retroTimestamp && { retroTimestamp }),
    };
  }

  // 6. Guardrail — stopping medication
  if (
    /(dej[eéoa]r?|suspend|par[oa]r?|ya no).*(pastilla|metformina|medic|tomar)/.test(n) ||
    /(no quiero|ya no)\s*(seguir|quiero)?\s*tom/.test(n)
  ) {
    return { kind: 'guardrail', reason: 'stop' };
  }

  // 7. Guardrail — dose questions (never advise on doses)
  if (
    /(cu[aá]nt[oa]s?|cu[aá]nta).*(pastilla|metformina|insulina|dosis|tomar)/.test(n) ||
    /(sub|baj|aument|reduc|reduzc|cambi)\w*.*(dosis|pastilla|metformina|insulina)/.test(n) ||
    /(debo|puedo|tengo que)\s+tomar\s+(m[aá]s|menos|otra|dos)/.test(n) ||
    // Catches "¿me tomo otra (pastilla)?", "¿me tomo más?" — implicit dose queries
    /me\s+tom[oa]\s+(otra|otro|m[aá]s|dos)\b/.test(n)
  ) {
    return { kind: 'guardrail', reason: 'dose' };
  }

  // 8. Guardrail — diagnosis questions (never diagnose)
  if (
    /(qu[eé]\s+tengo|qu[eé]\s+enfermedad|estoy\s+(grave|mal|enfermo)|es\s+grave|tengo\s+(diabetes|cancer|algo malo))/.test(
      n,
    ) ||
    /(ser[aá]\s+que tengo|me estar[eé] muriendo)/.test(n)
  ) {
    return { kind: 'guardrail', reason: 'diagnosis' };
  }

  return { kind: 'unknown' };
}
