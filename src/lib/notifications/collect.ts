// src/lib/notifications/collect.ts
/**
 * Runs every generator and concatenates the result. Dedup is NOT done here — it
 * is the notification store's push contract — so this can be called each tick.
 */
import { dueMedicationReminders } from './medication';
import { pendingRedFlagNotifications } from './redFlag';
import { caregiverAlerts } from './caregiver';
import { dueCheckinNudge } from './checkin';
import { occasionalAchievementReminder } from './achievement';
import type { NotificationContext } from './shared';
import type { AppNotification, AppState } from '@/types';

export function collectDueNotifications(
  state: AppState,
  now: Date,
  ctx: NotificationContext,
): AppNotification[] {
  return [
    ...dueMedicationReminders(state, now),
    ...pendingRedFlagNotifications(state, now),
    ...caregiverAlerts(state, now, ctx),
    ...dueCheckinNudge(state, now, ctx),
    ...occasionalAchievementReminder(state, now),
  ];
}
