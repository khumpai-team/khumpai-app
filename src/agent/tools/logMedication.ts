/**
 * logMedication — persist a medication taken/missed record via the store.
 * Idempotent on (medicationId, date, scheduledTime).
 */

import { z } from 'zod';
import { useAppStore } from '@/store/appStore';
import type { AdherenceRecord } from '@/types';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const LogMedicationInput = z.object({
  medicationId: z.string().min(1, 'medicationId is required'),
  taken: z.boolean(),
  /** ISO date (YYYY-MM-DD). Defaults to today. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  /** "HH:mm" scheduled time. Required for idempotency keying. */
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'scheduledTime must be HH:mm')
    .optional(),
});

export type LogMedicationInput = z.infer<typeof LogMedicationInput>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LogMedicationResult {
  ok: boolean;
  record: AdherenceRecord;
}

/**
 * Log that a medication dose was taken or missed.
 *
 * Idempotent: if a record with the same (date, scheduledTime) already exists
 * for this medication, its `taken` value is updated rather than duplicated.
 *
 * Throws ZodError on invalid input.
 */
export function logMedication(input: LogMedicationInput): LogMedicationResult {
  const parsed = LogMedicationInput.parse(input);

  const today = new Date().toISOString().slice(0, 10);
  const record: AdherenceRecord = {
    date: parsed.date ?? today,
    scheduledTime: parsed.scheduledTime ?? '08:00',
    taken: parsed.taken,
  };

  useAppStore.getState().actions.logMedicationTaken(parsed.medicationId, record);

  return { ok: true, record };
}
