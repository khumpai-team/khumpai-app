/**
 * getDoctorNotes — pure filter over a DoctorNote array.  No store access.
 */

import { z } from 'zod';
import type { DoctorNote } from '@/types';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetDoctorNotesOpts = z.object({
  personId: z.string().optional(),
  forQuestion: z.boolean().optional(),
});

export type GetDoctorNotesOpts = z.infer<typeof GetDoctorNotesOpts>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter DoctorNote records by optional person and forQuestion flag.
 *
 * @param notes - Full array of doctor notes (from store or seed).
 * @param opts  - Optional filter options.
 * @returns Matching notes sorted by timestamp descending.
 */
export function getDoctorNotes(
  notes: DoctorNote[],
  opts?: GetDoctorNotesOpts,
): DoctorNote[] {
  if (opts) {
    GetDoctorNotesOpts.parse(opts);
  }

  const { personId, forQuestion } = opts ?? {};

  return notes
    .filter((note) => {
      if (personId != null && note.personId !== personId) return false;
      if (forQuestion != null && note.forQuestion !== forQuestion) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}
