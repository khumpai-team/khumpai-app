/**
 * confirmEntry — idempotently mark a draft log entry as confirmed in the store.
 */

import { z } from 'zod';
import { useAppStore } from '@/store/appStore';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ConfirmEntryInput = z.object({
  entryId: z.string().min(1, 'entryId is required'),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ConfirmEntryResult {
  ok: boolean;
  alreadyConfirmed: boolean;
}

/**
 * Mark an existing log entry as confirmed. Idempotent: if the entry is already
 * confirmed, returns { ok: true, alreadyConfirmed: true } without error.
 *
 * Throws if entryId is empty.
 * Returns { ok: false, alreadyConfirmed: false } if the entry does not exist.
 */
export function confirmEntry(entryId: string): ConfirmEntryResult {
  ConfirmEntryInput.parse({ entryId });

  const state = useAppStore.getState();
  const existing = state.logs.find((l) => l.id === entryId);

  if (!existing) {
    return { ok: false, alreadyConfirmed: false };
  }

  if (existing.confirmed) {
    return { ok: true, alreadyConfirmed: true };
  }

  state.actions.confirmLog(entryId);
  return { ok: true, alreadyConfirmed: false };
}
