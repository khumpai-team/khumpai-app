// src/lib/notifications/redFlag.ts
/**
 * Red-flag alerts: scan today's symptom and glucose logs for EVERY person the
 * account follows; emit an urgent notification for any that the red-flag
 * evaluators classify urgent or emergency. (In the patient front there is only
 * `self`, so this is unchanged there; in the caregiver front it surfaces a
 * concerning reading for any patient, not just the one being viewed.)
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { evaluateRedFlag, evaluateGlucoseRedFlag } from '@/agent/tools/evaluateRedFlag';
import { makeNotification } from './shared';
import type { AppNotification, AppState, GlucoseLog, RedFlagLevel, SymptomLog } from '@/types';

export function pendingRedFlagNotifications(state: AppState, now: Date): AppNotification[] {
  const today = dateKey(now.toISOString());
  const out: AppNotification[] = [];

  for (const log of state.logs) {
    if (dateKey(log.timestamp) !== today) continue;

    let level: RedFlagLevel = 'ok';
    let message = '';
    if (log.type === 'symptom') {
      const r = evaluateRedFlag((log as SymptomLog).payload.description);
      level = r.level;
      message = r.message;
    } else if (log.type === 'glucose') {
      const r = evaluateGlucoseRedFlag((log as GlucoseLog).payload.value);
      level = r.level;
      message = r.message;
    } else {
      continue;
    }

    if (level !== 'urgent' && level !== 'emergency') continue;

    out.push(
      makeNotification({
        kind: 'red_flag',
        title: es.notifications.redFlagTitle(level),
        body: message,
        severity: 'urgent',
        dedupeKey: `redflag:${log.id}`,
        createdAt: now.toISOString(),
        relatedId: log.id,
      }),
    );
  }
  return out;
}
