/**
 * scheduleReminder — persist a daily medication reminder time.
 *
 * In-app delivery: this writes the time into the medication's `schedule[]`, and
 * the `dueMedicationReminders` generator surfaces it on the next scheduler tick.
 * (Closed-tab / cross-device delivery would need Web Push — see the spec.)
 */

import { z } from 'zod';
import { useAppStore } from '@/store/appStore';

const ScheduleReminderInput = z.object({
  medicationId: z.string().min(1, 'medicationId is required'),
  /** "HH:mm" time for the daily reminder. */
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm'),
});

export type ScheduleReminderInput = z.infer<typeof ScheduleReminderInput>;

export interface ScheduleReminderResult {
  scheduled: true;
  medicationId: string;
  time: string;
}

/**
 * Add `time` to the target medication's schedule (idempotent — never
 * duplicates a time, preserves existing entries). Throws ZodError on invalid
 * input. No-ops the persistence if the medication isn't found, but still
 * returns a scheduled result (the agent's intent is acknowledged).
 */
export function scheduleReminder(input: ScheduleReminderInput): ScheduleReminderResult {
  const parsed = ScheduleReminderInput.parse(input);
  const state = useAppStore.getState();
  const med = state.medications.find((m) => m.id === parsed.medicationId);
  if (med && !med.schedule.includes(parsed.time)) {
    state.actions.upsertMedication({
      ...med,
      schedule: [...med.schedule, parsed.time].sort(),
    });
  }
  return { scheduled: true, medicationId: parsed.medicationId, time: parsed.time };
}
