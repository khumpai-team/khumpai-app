/**
 * ack.ts — the single source of truth for the warm acknowledgement Khumpi
 * speaks AFTER the user confirms a drafted health entry.
 *
 * This logic was previously duplicated in MockAgentProvider (`ackFor`) and
 * useChat (`localAck`). Centralizing it keeps every confirm path — Mock, local
 * caregiver/attachment cards, and the Foundry fallback — in lockstep.
 */

import { AGENT_ES } from '@/data/i18n/agent-es';
import { evaluateRedFlag } from '@/agent/tools';
import type { LogEntry } from '@/types';

/** Range-aware acknowledgement for a glucose value. */
export function glucoseMessage(v: number): string {
  if (v < 70) return AGENT_ES.glucose.low(v);
  if (v < 180) return AGENT_ES.glucose.ok(v);
  if (v < 250) return AGENT_ES.glucose.high(v);
  return AGENT_ES.glucose.veryHigh(v);
}

/**
 * Warm Peruvian-Spanish acknowledgement for a confirmed entry.
 *
 * Accepts a loose (primary, secondary?) pair so it serves both DraftEntries
 * (draft.primary / draft.secondary) and savedEntries ([0] / [1]).
 */
export function ackForEntries(primary: LogEntry, secondary?: LogEntry): string {
  switch (primary.type) {
    case 'glucose':
      return glucoseMessage(primary.payload.value);
    case 'meal':
      return secondary?.type === 'glucose'
        ? glucoseMessage(secondary.payload.value)
        : AGENT_ES.confirmations.savedMeal;
    case 'sleep':
      return primary.payload.hours < 6
        ? AGENT_ES.offline.sleepShort(primary.payload.hours)
        : AGENT_ES.confirmations.savedSleep;
    case 'medication':
      return AGENT_ES.confirmations.savedMedication;
    case 'symptom':
      return evaluateRedFlag(primary.payload.description).message;
    default:
      return AGENT_ES.confirmations.savedLong;
  }
}
