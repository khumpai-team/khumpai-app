/**
 * guardrailRedirect — refuse out-of-scope requests (diagnosis, dose changes,
 * stopping medication, prompt injection) and optionally build a DoctorNote for
 * reasons that should be tracked for the physician.
 *
 * Return shape:
 *   { message: string; doctorNote?: DoctorNote }
 *
 * Backward-compatible: existing callers doing `const { message } = guardrailRedirect(...)` continue to work.
 */

import { AGENT_ES } from '@/data/i18n/agent-es';
import { uid } from '@/lib/id';
import type { DoctorNote } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardrailReason = 'dose' | 'diagnosis' | 'stop' | 'injection';

export interface GuardrailResult {
  message: string;
  doctorNote?: DoctorNote;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildDoctorNote(
  reason: Exclude<GuardrailReason, 'injection'>,
  personId: string,
): DoctorNote {
  const textByReason: Record<Exclude<GuardrailReason, 'injection'>, string> = {
    dose: '¿Puede revisar mi dosis actual y decirme si necesita ajustarse?',
    diagnosis: '¿Qué podría estar causando los síntomas que he estado anotando?',
    stop: '¿Es seguro hacer algún cambio en mi medicación actual?',
  };

  return {
    id: uid('dn'),
    personId,
    text: textByReason[reason],
    timestamp: new Date().toISOString(),
    source: 'guardrail',
    forQuestion: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return a safety message refusing the out-of-scope request.
 * For 'dose', 'diagnosis', and 'stop', also builds a DoctorNote question
 * so the topic is tracked for the physician's visit.
 * For 'injection', returns only a message (no doctor note needed).
 *
 * @param reason    - The type of guardrail triggered.
 * @param personId  - The person this session is for (defaults to 'carlos').
 */
export function guardrailRedirect(
  reason: GuardrailReason,
  personId = 'carlos',
): GuardrailResult {
  if (reason === 'injection') {
    return { message: AGENT_ES.guardrails.promptInjection };
  }

  const messageByReason: Record<Exclude<GuardrailReason, 'injection'>, string> = {
    dose: AGENT_ES.guardrails.doseQuestion,
    diagnosis: AGENT_ES.guardrails.diagnosis,
    stop: AGENT_ES.guardrails.stopMedication,
  };

  return {
    message: messageByReason[reason],
    doctorNote: buildDoctorNote(reason, personId),
  };
}
