import { z } from 'zod';

export const LogEntryBody = z.object({
  id: z.string(),
  personId: z.string(),
  type: z.enum(['meal', 'glucose', 'medication', 'symptom', 'sleep', 'mood', 'stress', 'activity']),
  timestamp: z.string(),
  createdAt: z.string(),
  editedAt: z.string().optional(),
  source: z.enum(['conversation', 'quick_action', 'notification', 'seed']),
  confirmed: z.boolean(),
  isOfflineCapture: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
});

export const BatchBody = z.object({ entries: z.array(LogEntryBody) });
