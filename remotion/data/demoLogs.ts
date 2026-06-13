/**
 * A fuller "today" for the bitácora segment, layered on top of the seed. It
 * makes the timeline read like a real day AND closes the loop with the chat:
 * the lomo saltado + 142 mg/dL the user logged by talking show up here.
 *
 * Render date is fixed (Remotion mocks the clock), so "today" = 2026-06-13.
 */

import { SEED_LOGS } from '@/data/seed';
import type { AppState, LogEntry } from '@/types';

const T = (hm: string) => `2026-06-13T${hm}:00`;

const BASE = {
  personId: 'carlos',
  confirmed: true as const,
  isOfflineCapture: false as const,
};

const TODAY: LogEntry[] = [
  {
    ...BASE,
    id: 'demo-today-glu-ayunas',
    type: 'glucose',
    timestamp: T('07:15'),
    createdAt: T('07:16'),
    source: 'quick_action',
    payload: { value: 118, moment: 'ayunas' },
  },
  {
    ...BASE,
    id: 'demo-today-meal-desayuno',
    type: 'meal',
    timestamp: T('08:00'),
    createdAt: T('08:01'),
    source: 'conversation',
    payload: { description: 'Pan con palta y café', context: 'casa' },
  },
  {
    ...BASE,
    id: 'demo-today-med-am',
    type: 'medication',
    timestamp: T('08:05'),
    createdAt: T('08:06'),
    source: 'quick_action',
    payload: { name: 'Metformina', taken: true },
  },
  {
    ...BASE,
    id: 'demo-today-meal-almuerzo',
    type: 'meal',
    timestamp: T('13:30'),
    createdAt: T('13:31'),
    source: 'conversation',
    payload: { description: 'Lomo saltado con arroz', context: 'fuera' },
  },
  {
    ...BASE,
    id: 'demo-today-glu-almuerzo',
    type: 'glucose',
    timestamp: T('15:00'),
    createdAt: T('15:01'),
    source: 'conversation',
    payload: { value: 142, moment: 'post-almuerzo' },
  },
];

export const JOURNAL_PATCH: Partial<AppState> = {
  logs: [...SEED_LOGS, ...TODAY],
};
