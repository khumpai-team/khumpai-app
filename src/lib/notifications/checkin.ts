// src/lib/notifications/checkin.ts
/**
 * Daily check-in nudge: one gentle reminder to log, shown after CHECKIN_HOUR
 * when the morning check-in has not run and nothing has been logged today.
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification, CHECKIN_HOUR, type NotificationContext } from './shared';
import type { AppNotification, AppState } from '@/types';

export function dueCheckinNudge(
  state: AppState,
  now: Date,
  ctx: NotificationContext,
): AppNotification[] {
  if (now.getHours() < CHECKIN_HOUR) return [];
  const today = dateKey(now.toISOString());
  if (ctx.lastCheckinDate === today) return [];

  const loggedToday = state.logs.some(
    (l) => l.personId === state.currentPersonId && dateKey(l.timestamp) === today,
  );
  if (loggedToday) return [];

  return [
    makeNotification({
      kind: 'checkin',
      title: es.notifications.checkinTitle,
      body: es.notifications.checkinBody,
      severity: 'info',
      dedupeKey: `checkin:${today}`,
      createdAt: now.toISOString(),
    }),
  ];
}
