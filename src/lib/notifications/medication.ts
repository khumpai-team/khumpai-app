// src/lib/notifications/medication.ts
/**
 * Medication reminders: for each of the current person's medications and each
 * HH:mm in its schedule, emit a reminder while now is within the dose window,
 * unless that dose is already marked taken today.
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification, WINDOW_MIN } from './shared';
import type { AdherenceRecord, AppNotification, AppState } from '@/types';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Doses scheduled earlier today whose reminder window has FULLY passed and that
 * are still not marked taken — i.e. the patient forgot them. Distinct from
 * `dueMedicationReminders` (which fires DURING the window): a dose is only
 * "forgotten" once now is past `scheduledTime + WINDOW_MIN`, so the gentle
 * in-window reminder and the caregiver "forgot" alert never fire at once.
 */
export function forgottenDosesToday(med: { schedule: string[]; adherenceLog: AdherenceRecord[] }, now: Date): string[] {
  const today = dateKey(now.toISOString());
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return med.schedule.filter((time) => {
    const passed = nowMin >= toMinutes(time) + WINDOW_MIN;
    if (!passed) return false;
    const taken = med.adherenceLog.some(
      (r) => r.date === today && r.scheduledTime === time && r.taken,
    );
    return !taken;
  });
}

export function dueMedicationReminders(state: AppState, now: Date): AppNotification[] {
  const today = dateKey(now.toISOString());
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const meds = state.medications.filter((m) => m.personId === state.currentPersonId);
  const out: AppNotification[] = [];

  for (const med of meds) {
    for (const time of med.schedule) {
      const t = toMinutes(time);
      const due = nowMin >= t && nowMin < t + WINDOW_MIN;
      if (!due) continue;
      const taken = med.adherenceLog.some(
        (r) => r.date === today && r.scheduledTime === time && r.taken,
      );
      if (taken) continue;
      out.push(
        makeNotification({
          kind: 'medication',
          title: es.notifications.medicationTitle,
          body: es.notifications.medicationBody(med.name),
          severity: 'info',
          dedupeKey: `med:${med.id}:${today}:${time}`,
          createdAt: now.toISOString(),
          relatedId: med.id,
        }),
      );
    }
  }
  return out;
}
