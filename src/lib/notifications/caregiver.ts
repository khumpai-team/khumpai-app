// src/lib/notifications/caregiver.ts
/**
 * Caregiver alerts and per-patient status.
 *
 * `caregiverPatientStatus` is the single source of truth for "how is this
 * person doing right now" — it powers BOTH the portfolio card chips/badges and
 * the per-patient dashboard banner, so the two can never disagree.
 * `caregiverAlerts` reuses the same conditions to emit notifications for EVERY
 * patient the carer follows (not just the one currently selected).
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { evaluateRedFlag } from '@/agent/tools/evaluateRedFlag';
import { forgottenDosesToday } from './medication';
import { makeNotification, type NotificationContext } from './shared';
import type {
  AppNotification,
  AppState,
  GlucoseLog,
  LogEntry,
  Medication,
  SymptomLog,
} from '@/types';

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

// ---------------------------------------------------------------------------
// Per-patient status — shared by the portfolio and the dashboard banner.
// ---------------------------------------------------------------------------

export type CaregiverSeverity = 'calm' | 'warn' | 'urgent';
export type CaregiverAlertKind = 'redFlag' | 'high' | 'forgotPill' | 'stock';

export interface CaregiverAlert {
  kind: CaregiverAlertKind;
  text: string;
}

export interface CaregiverPatientStatus {
  severity: CaregiverSeverity;
  alerts: CaregiverAlert[];
}

/** Per-medication remaining/capacity for one person, read from the pillbox ctx. */
function stockFor(meds: Medication[], ctx: NotificationContext): { remaining: number | null; capacity: number } {
  const med = meds[0];
  if (!med) return { remaining: null, capacity: DEFAULT_CAPACITY };
  const capacity = ctx.capacity[med.id] ?? DEFAULT_CAPACITY;
  const remaining = ctx.stock[med.id] ?? ctx.capacity[med.id] ?? DEFAULT_CAPACITY;
  return { remaining, capacity };
}

/**
 * Evaluate everything we monitor for one patient and fold it into a severity +
 * an ordered alert list (most urgent first). Conditions:
 *   - redFlag    → a symptom logged today that the evaluator rates urgent/emergency
 *   - high       → latest glucose today >= 180
 *   - forgotPill → a dose whose window has fully passed, still not taken
 *   - stock      → remaining pills at/under the low-stock floor
 */
export function caregiverPatientStatus(
  logs: LogEntry[],
  medications: Medication[],
  personId: string,
  now: Date,
  ctx: NotificationContext,
): CaregiverPatientStatus {
  const today = dateKey(now.toISOString());
  const meds = medications.filter((m) => m.personId === personId);
  const alerts: CaregiverAlert[] = [];

  // Red flag — a concerning symptom reported today ("bad action").
  const symptomToday = logs
    .filter((l): l is SymptomLog => l.type === 'symptom' && l.personId === personId)
    .filter((l) => dateKey(l.timestamp) === today)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (symptomToday) {
    const r = evaluateRedFlag(symptomToday.payload.description);
    if (r.level === 'urgent' || r.level === 'emergency') {
      alerts.push({ kind: 'redFlag', text: r.message });
    }
  }

  const { highToday, stockLow } = caregiverAlertConditions(logs, personId, now, stockFor(meds, ctx));
  if (highToday != null) alerts.push({ kind: 'high', text: es.caregiver.alertHigh(highToday) });

  // Forgot pills — report the first forgotten med by name.
  const forgotMed = meds.find((m) => forgottenDosesToday(m, now).length > 0);
  if (forgotMed) alerts.push({ kind: 'forgotPill', text: es.caregiver.alertForgotPill(forgotMed.name) });

  if (stockLow) alerts.push({ kind: 'stock', text: es.caregiver.alertStock });

  const severity: CaregiverSeverity = alerts.some((a) => a.kind === 'redFlag')
    ? 'urgent'
    : alerts.length
      ? 'warn'
      : 'calm';

  return { severity, alerts };
}

// ---------------------------------------------------------------------------
// Notifications — emitted for EVERY patient the carer follows.
// ---------------------------------------------------------------------------

export function caregiverAlerts(
  state: AppState,
  now: Date,
  ctx: NotificationContext,
): AppNotification[] {
  const today = dateKey(now.toISOString());
  const out: AppNotification[] = [];

  for (const person of state.persons) {
    const pid = person.id;
    const status = caregiverPatientStatus(state.logs, state.medications, pid, now, ctx);
    for (const alert of status.alerts) {
      // Red flags are emitted by the dedicated red-flag generator already.
      if (alert.kind === 'redFlag') continue;
      out.push(
        makeNotification({
          kind: 'caregiver',
          title: es.notifications.caregiverTitle,
          body: alert.text,
          severity: 'warn',
          dedupeKey: `caregiver:${alert.kind}:${pid}:${today}`,
          createdAt: now.toISOString(),
          personId: pid,
        }),
      );
    }
  }
  return out;
}
