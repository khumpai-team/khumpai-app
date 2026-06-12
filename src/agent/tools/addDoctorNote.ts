/**
 * addDoctorNote — build and persist a DoctorNote via the store.
 */

import { z } from 'zod';
import { useAppStore } from '@/store/appStore';
import { uid } from '@/lib/id';
import type { DoctorNote, DoctorNoteSource } from '@/types';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const DOCTOR_NOTE_SOURCES: [DoctorNoteSource, ...DoctorNoteSource[]] = [
  'guardrail',
  'user',
  'khumpi',
  'pattern',
];

const AddDoctorNoteInput = z.object({
  personId: z.string().min(1, 'personId is required'),
  text: z.string().min(1, 'text is required'),
  source: z.enum(DOCTOR_NOTE_SOURCES).optional().default('khumpi'),
  forQuestion: z.boolean().optional().default(false),
});

export type AddDoctorNoteInput = z.infer<typeof AddDoctorNoteInput>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a DoctorNote and persist it to the store.
 *
 * @returns The newly created DoctorNote (with generated id and timestamp).
 * Throws ZodError on invalid input.
 */
export function addDoctorNote(input: AddDoctorNoteInput): DoctorNote {
  const parsed = AddDoctorNoteInput.parse(input);

  const note: DoctorNote = {
    id: uid('dn'),
    personId: parsed.personId,
    text: parsed.text,
    timestamp: new Date().toISOString(),
    source: parsed.source,
    forQuestion: parsed.forQuestion,
  };

  useAppStore.getState().actions.addDoctorNote(note);

  return note;
}
