/**
 * scheduleReminder — STUB for Phase 2 device notification integration.
 *
 * TODO Phase 2: integrate device notifications (e.g. Web Push API, React Native
 * PushNotificationIOS / Notifications, or a backend scheduled job via Supabase
 * Edge Functions).  For now this returns a confirmation immediately without
 * actually scheduling anything.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ScheduleReminderInput = z.object({
  medicationId: z.string().min(1, 'medicationId is required'),
  /** "HH:mm" time for the daily reminder. */
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm'),
});

export type ScheduleReminderInput = z.infer<typeof ScheduleReminderInput>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScheduleReminderResult {
  scheduled: true;
  medicationId: string;
  time: string;
}

/**
 * Stub: acknowledge a reminder request without actually scheduling it.
 * Throws ZodError on invalid input.
 */
export function scheduleReminder(input: ScheduleReminderInput): ScheduleReminderResult {
  const parsed = ScheduleReminderInput.parse(input);
  // TODO Phase 2: integrate device notifications
  return {
    scheduled: true,
    medicationId: parsed.medicationId,
    time: parsed.time,
  };
}
