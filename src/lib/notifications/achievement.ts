// src/lib/notifications/achievement.ts
/**
 * Occasional achievement nudge: a warm, celebratory reminder, rate-limited to
 * at most one per day via its date-scoped dedupeKey. Celebration only — no
 * streak / consecutive-day logic (matches evaluateAchievements' design).
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification } from './shared';
import type { AppNotification, AppState } from '@/types';

export function occasionalAchievementReminder(state: AppState, now: Date): AppNotification[] {
  if (state.achievements.length === 0) return [];
  const today = dateKey(now.toISOString());
  return [
    makeNotification({
      kind: 'achievement',
      title: es.notifications.achievementTitle,
      body: es.notifications.achievementBody,
      severity: 'info',
      dedupeKey: `achievement:${today}`,
      createdAt: now.toISOString(),
    }),
  ];
}
