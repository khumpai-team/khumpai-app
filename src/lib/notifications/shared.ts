// src/lib/notifications/shared.ts
/**
 * Shared building blocks for the notification generators: tunable constants,
 * the context the scheduler threads in (data that lives outside AppState), and
 * a small factory so every generator produces a consistent AppNotification.
 */
import { uid } from '@/lib/id';
import type {
  AppNotification,
  NotificationKind,
  NotificationSeverity,
} from '@/types';

/** Minutes after a scheduled dose time during which a reminder is still "due". */
export const WINDOW_MIN = 60;

/** Local hour from which the daily check-in nudge may appear. */
export const CHECKIN_HOUR = 9;

/**
 * Data the generators need that does not live in AppState. The scheduler reads
 * it from the sibling stores (pillbox, session) and passes it in, keeping the
 * generators pure and unit-testable.
 */
export interface NotificationContext {
  /** Remaining pills per medication id (usePillboxStore). */
  stock: Record<string, number>;
  /** Capacity per medication id (usePillboxStore). */
  capacity: Record<string, number>;
  /** YYYY-MM-DD of the last completed morning check-in (useSessionStore). */
  lastCheckinDate: string | null;
}

export function makeNotification(args: {
  kind: NotificationKind;
  title: string;
  body: string;
  severity: NotificationSeverity;
  dedupeKey: string;
  createdAt: string;
  relatedId?: string;
  personId?: string;
}): AppNotification {
  return { id: uid('notif'), status: 'pending', ...args };
}
