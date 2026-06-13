/**
 * offlineResponses — the hardcoded warm replies Khumpi speaks while offline.
 *
 * When there's no signal we NEVER call the LLM and we NEVER give medical advice.
 * The registration flow still works locally (parser → ConfirmationCard → save),
 * but the spoken reply is just a warm acknowledgement: "lo tengo guardado, lo
 * analizo a fondo cuando vuelva la señal". Pure function, no network, no state.
 *
 * Keyed by the detected intent (meal · glucose · medication · sleep · generic).
 */

import type { ParsedIntent } from '@/agent/parse';

/**
 * Warm, short, Peruvian-Spanish acknowledgement for an offline turn.
 *
 * @param intent - The locally-parsed intent of the user's message.
 * @param name   - The patient's first name, woven in when available (optional).
 * @returns The hardcoded reply Khumpi should speak — never medical advice.
 */
export function getOfflineResponse(intent: ParsedIntent, name = ''): string {
  const who = name ? `, ${name}` : '';

  switch (intent.kind) {
    case 'meal':
    case 'glucose':
      return `Anotado${who} 💚 Sin señal no puedo analizar a fondo, pero lo tengo guardado. Cuando vuelva la señal lo revisamos juntos.`;

    case 'medication':
      return `Anotado${who} 💚 Tu medicación queda guardada aquí. Cuando vuelva la señal lo reviso todo contigo.`;

    case 'sleep':
      return `Anotado${who} 💚 Lo tengo guardado. Cuando vuelva la señal vemos cómo va tu descanso, sin prisa.`;

    // symptom / guardrail / unknown → generic warm acknowledgement.
    default:
      return 'Te escucho. Lo guardo aquí y lo sincronizo apenas vuelva la señal.';
  }
}
