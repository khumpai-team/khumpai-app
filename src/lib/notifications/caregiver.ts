// src/lib/notifications/caregiver.ts
/**
 * Caregiver alerts: high glucose today and low pill stock. The condition logic
 * is shared with CaregiverDashboard so the dashboard banner and the
 * notification never disagree.
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification, type NotificationContext } from './shared';
import type { AppNotification, AppState, GlucoseLog, LogEntry } from '@/types';

const STOCK_FLOOR = 6;
const DEFAULT_CAPACITY = 30;

export function caregiverAlertConditions(
  logs: LogEntry[],
  personId: string,
  now: Date,
  stock: { remaining: number | null; capacity: number },
): { highToday: number | null; stockLow: boolean } {
  const today = dateKey(now.toISOString());
  const latest = logs
    .filter((l) => l.personId === personId)
    .filter((l): l is GlucoseLog => l.type === 'glucose')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const highToday =
    latest && latest.payload.value >= 180 && dateKey(latest.timestamp) === today
      ? latest.payload.value
      : null;
  const stockLow =
    stock.remaining != null
      ? stock.remaining <= Math.max(STOCK_FLOOR, stock.capacity * 0.2)
      : false;
  return { highToday, stockLow };
}

export function caregiverAlerts(
  state: AppState,
  now: Date,
  ctx: NotificationContext,
): AppNotification[] {
  const pid = state.currentPersonId;
  const medId = state.medications.find((m) => m.personId === pid)?.id;
  const capacity = medId != null ? ctx.capacity[medId] ?? DEFAULT_CAPACITY : DEFAULT_CAPACITY;
  const remaining =
    medId != null ? ctx.stock[medId] ?? ctx.capacity[medId] ?? DEFAULT_CAPACITY : null;

  const { highToday, stockLow } = caregiverAlertConditions(state.logs, pid, now, {
    remaining,
    capacity,
  });
  const today = dateKey(now.toISOString());
  const out: AppNotification[] = [];

  if (highToday != null) {
    out.push(
      makeNotification({
        kind: 'caregiver',
        title: es.notifications.caregiverTitle,
        body: es.caregiver.alertHigh(highToday),
        severity: 'warn',
        dedupeKey: `caregiver:high:${pid}:${today}`,
        createdAt: now.toISOString(),
        personId: pid,
      }),
    );
  }
  if (stockLow) {
    out.push(
      makeNotification({
        kind: 'caregiver',
        title: es.notifications.caregiverTitle,
        body: es.caregiver.alertStock,
        severity: 'warn',
        dedupeKey: `caregiver:stock:${pid}:${today}`,
        createdAt: now.toISOString(),
        personId: pid,
      }),
    );
  }
  return out;
}
