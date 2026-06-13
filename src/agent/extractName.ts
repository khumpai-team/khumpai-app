/**
 * extractPersonName — pull the actual name out of a conversational reply.
 *
 * Onboarding asks "¿Cómo te llamas?" and people answer naturally:
 * "hola me llamo lucio", "soy la señora Rosa Quispe", "mi papá se llama Juan".
 * We must store "Lucio" / "Rosa Quispe" / "Juan" — not the whole sentence.
 *
 * Deterministic on purpose: this runs in a scripted, offline-capable flow, so it
 * must be instant and reliable (no LLM round-trip, no "¡Hola Lucio!" surprises).
 * Returns '' when nothing name-like remains (caller re-asks).
 */

/** Lowercase + strip diacritics, for matching only (output keeps original casing). */
const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Leading filler tokens to peel off the front: greetings, self-intros,
// honorifics, possessives, and "se llama"-style lead-ins. Accent-free forms.
const LEAD_FILLERS = new Set([
  'hola', 'ola', 'hey', 'buenas', 'buenos', 'buen', 'dia', 'dias', 'tardes', 'noches',
  'que', 'tal', 'pues', 'bueno', 'este',
  'me', 'llamo', 'llaman', 'llaman', 'dicen', 'dice', 'se', 'llama',
  'mi', 'nombre', 'es', 'soy', 'yo', 'el', 'la',
  'papa', 'mama', 'padre', 'madre', 'esposo', 'esposa', 'hijo', 'hija', 'familiar',
  'don', 'dona', 'senor', 'senora', 'sr', 'sra', 'srta', 'doctor', 'doctora',
  'puedes', 'puede', 'decir', 'decirme', 'llamame', 'llamarme',
]);

// Tokens that end the name (a sentence continuing past it).
const STOP_TOKENS = new Set([
  'y', 'e', 'pero', 'porque', 'que', 'tengo', 'vivo', 'gracias', 'mucho', 'gusto',
  'de', // only as a stop when it's trailing; handled as connector mid-name below
]);

// Connectors that stay lowercase inside a compound name.
const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

const MAX_NAME_TOKENS = 4;

function titleCaseToken(orig: string, normToken: string, index: number): string {
  if (index > 0 && CONNECTORS.has(normToken)) return normToken; // "de", "los"…
  const first = orig.charAt(0).toUpperCase();
  return first + orig.slice(1).toLowerCase();
}

export function extractPersonName(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';

  // Tokenize original + normalized in lockstep (same split → aligned indices).
  const origWords = trimmed.split(/\s+/);
  const normWords = origWords.map(norm);

  // 1) Peel leading filler tokens (greetings/intros/honorifics).
  let start = 0;
  while (start < normWords.length) {
    // Strip surrounding punctuation from the normalized token for matching.
    const tok = normWords[start].replace(/[^a-z0-9]/g, '');
    if (tok === '' || LEAD_FILLERS.has(tok)) start += 1;
    else break;
  }

  // 2) Collect name tokens until a stop token / digit / cap.
  const nameOrig: string[] = [];
  const nameNorm: string[] = [];
  for (let i = start; i < normWords.length && nameOrig.length < MAX_NAME_TOKENS; i++) {
    const cleanNorm = normWords[i].replace(/[^a-z0-9]/g, '');
    if (cleanNorm === '') continue;
    // A trailing connector/stop ends the name (but a connector BETWEEN name
    // parts is kept — we only stop if no name token follows it).
    if (STOP_TOKENS.has(cleanNorm) && !CONNECTORS.has(cleanNorm)) break;
    if (/^\d+$/.test(cleanNorm)) continue; // drop stray numbers
    // Keep only letter-ish tokens (allow accents, hyphen, apostrophe).
    const cleanOrig = origWords[i].replace(/[^\p{L}\p{M}'-]/gu, '');
    if (!cleanOrig) continue;
    nameOrig.push(cleanOrig);
    nameNorm.push(cleanNorm);
  }

  // 3) Drop trailing connectors (e.g. accidental "Lucio de").
  while (nameNorm.length && CONNECTORS.has(nameNorm[nameNorm.length - 1])) {
    nameOrig.pop();
    nameNorm.pop();
  }

  if (nameOrig.length === 0) return '';
  return nameOrig.map((w, i) => titleCaseToken(w, nameNorm[i], i)).join(' ');
}
