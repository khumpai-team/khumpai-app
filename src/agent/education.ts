/**
 * isEducationQuestion — detects diabetes-education / general-knowledge questions
 * ("¿por qué me sube el azúcar?", "¿el camote es bueno?", "¿cómo cuido mis
 * pies?") so the chat can route them to the grounded knowledge base
 * (POST /api/rag/ask) instead of letting the open model answer ungrounded.
 *
 * It runs AFTER the deterministic data / arc / triage / guardrail checks in
 * useChat, so dose and diagnosis questions never reach it. A false negative
 * simply falls through to a normal model turn, so this errs toward PRECISION:
 * fire only when the message both looks like a question AND names a topic the
 * knowledge base can speak to.
 */

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// A question cue: interrogative punctuation, an interrogative word, an
// advice/permission verb, or a "tell me / explain" opener.
const QUESTION_RE =
  /[¿?]|\b(que|qu[eé]|por\s*qu[eé]|c[oó]mo|cuando|cu[aá]ndo|cu[aá]l|cu[aá]nt[oa]s?)\b|\b(sirve|sirven|es\s+bueno|es\s+malo|es\s+cierto|es\s+verdad|puedo|se\s+puede|deber[ií]a|debo|conviene|recomien\w*|ayuda\w*|pasa\s+si|explica\w*|expl[ií]ca\w*|cu[eé]ntame|dime)\b/;

// A diabetes / lifestyle / food topic the knowledge base covers. Note: the bare
// question word "como" is deliberately NOT a topic (so "¿cómo estás?" is not an
// education question); food is matched via "comer/comida/aliment…".
const TOPIC_RE =
  /az[uú]car|gluc\w*|diabet\w*|hemoglobina|hba1c|a1c|insulin\w*|metformin\w*|\bcomer\b|\bcomida\b|\bcomidas\b|aliment\w*|dieta|fruta|verdura|arroz|\bpan\b|fideo|\bpapa\b|camote|yuca|mazamorra|gaseosa|dulce|ejercicio|camin\w*|deporte|\bpeso\b|adelgaz\w*|\bpie\b|\bpies\b|vista|\bojos?\b|ri[ñn][oó]n\w*|presi[oó]n|coraz[oó]n|dorm\w*|sue[ñn]o|estr[eé]s|neuropat\w*|circulaci[oó]n|colesterol|ayunas|\bagua\b|\bsal\b|fibra|alcohol|cerveza|vino/;

export function isEducationQuestion(text: string): boolean {
  const n = norm(text);
  return QUESTION_RE.test(n) && TOPIC_RE.test(n);
}
