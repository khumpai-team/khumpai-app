import { KHUMPI_SYSTEM_PROMPT, DIARY_FEWSHOTS } from '../../../src/agent/foundryConfig';

export interface ChatMsg {
  role: string;
  content: string | null;
}

/**
 * STABLE prefix (cacheable): system prompt + few-shots, byte-identical every
 * turn. Keep ALL dynamic content (datetime, patient context, history) out of
 * this message so Azure automatic prompt caching keeps hitting.
 */
export const SYSTEM_PREFIX: ChatMsg = {
  role: 'system',
  content: `${KHUMPI_SYSTEM_PROMPT}\n\n${DIARY_FEWSHOTS}`,
};

/**
 * Assemble the request messages: stable prefix → dynamic context (datetime +
 * patient) → bounded recent history. The patient/datetime block is a SEPARATE
 * message so the prefix stays cacheable.
 */
export function buildAgentMessages(opts: {
  history: ChatMsg[];
  patientContext: string;
  nowIso: string;
  windowTurns?: number;
}): ChatMsg[] {
  const { history, patientContext, nowIso, windowTurns = 6 } = opts;
  const context: ChatMsg = {
    role: 'system',
    content: `## Contexto actual\nFecha y hora: ${nowIso}\n${patientContext}`,
  };
  const recent = history.slice(-windowTurns);
  return [SYSTEM_PREFIX, context, ...recent];
}
