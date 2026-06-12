/**
 * upsertMedication — add or update a medication in the store.
 */

import { z } from 'zod';
import { useAppStore } from '@/store/appStore';
import type { Medication } from '@/types';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const AdherenceRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'scheduledTime must be HH:mm'),
  taken: z.boolean(),
});

const MedicationSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  name: z.string().min(1),
  dose: z.string().min(1),
  frequency: z.string().min(1),
  schedule: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'schedule time must be HH:mm')),
  adherenceLog: z.array(AdherenceRecordSchema),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert or replace a medication in the store.  Uses the medication's `id`
 * as the upsert key: if a medication with this id exists, it is fully replaced;
 * otherwise it is appended.
 *
 * Throws ZodError on invalid input.
 */
export function upsertMedication(med: Medication): { ok: boolean } {
  MedicationSchema.parse(med);
  useAppStore.getState().actions.upsertMedication(med);
  return { ok: true };
}
