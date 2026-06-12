/**
 * registerEntry — build draft (unconfirmed) LogEntry objects from a parsed intent.
 *
 * NEVER persists. The user must confirm before anything is saved.
 */

import { uid } from '@/lib/id';
import type { LogEntry } from '@/types';
import type { ParsedIntent } from '@/agent/parse';
import { evaluateRedFlag } from './evaluateRedFlag';

// ---------------------------------------------------------------------------
// Re-exported public types
// ---------------------------------------------------------------------------

export interface DraftEntries {
  primary: LogEntry;
  secondary?: LogEntry;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DataIntent = Extract<
  ParsedIntent,
  { kind: 'meal' | 'glucose' | 'sleep' | 'medication' | 'symptom' }
>;

const nowIso = (): string => new Date().toISOString();

function base(personId: string) {
  const at = nowIso();
  return {
    id: uid('log'),
    personId,
    timestamp: at,
    createdAt: at,
    source: 'conversation' as const,
    confirmed: false,
    isOfflineCapture: false,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build draft (unsaved) log entries from a parsed intent, for the user to
 * confirm before they are committed to the store.
 */
export function buildDraftEntries(intent: DataIntent, personId: string): DraftEntries {
  switch (intent.kind) {
    case 'meal': {
      const meal: LogEntry = {
        ...base(personId),
        type: 'meal',
        payload: { description: intent.description, context: intent.context },
      };
      if (intent.glucose != null) {
        const glucose: LogEntry = {
          ...base(personId),
          type: 'glucose',
          payload: { value: intent.glucose, moment: intent.glucoseMoment ?? 'post-almuerzo' },
        };
        return { primary: meal, secondary: glucose };
      }
      return { primary: meal };
    }

    case 'glucose':
      return {
        primary: {
          ...base(personId),
          type: 'glucose',
          payload: { value: intent.value, moment: intent.moment },
        },
      };

    case 'sleep':
      return {
        primary: {
          ...base(personId),
          type: 'sleep',
          payload: { hours: intent.hours },
        },
      };

    case 'medication':
      return {
        primary: {
          ...base(personId),
          type: 'medication',
          payload: { name: intent.name, taken: intent.taken },
        },
      };

    case 'symptom': {
      const { level } = evaluateRedFlag(intent.description);
      return {
        primary: {
          ...base(personId),
          type: 'symptom',
          payload: {
            description: intent.description,
            redFlag: level === 'urgent' || level === 'emergency',
            level,
          },
        },
      };
    }
  }
}
