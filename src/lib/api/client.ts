/**
 * Typed client for the Khumpai backend API (the Express server behind Vite's
 * /api proxy). All write methods are BEST-EFFORT and never throw: if the server
 * is down or offline, the in-memory store still updates and the offline
 * syncQueue provides durability on the next flush. The server (Postgres) is the
 * source of truth; the client store is an in-memory cache hydrated on load.
 */
import type {
  AppState,
  LogEntry,
  DoctorNote,
  DoctorVisit,
  UserPrefs,
  Achievement,
  AdherenceRecord,
} from '@/types';

const BASE = '/api';

async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    /* best-effort write-through; durability covered by the offline syncQueue */
  }
}

async function patch(path: string, body: unknown): Promise<void> {
  try {
    await fetch(BASE + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    /* best-effort */
  }
}

export const api = {
  /** Bootstrap the full AppState for the demo user. Returns null if unavailable. */
  async fetchState(): Promise<AppState | null> {
    try {
      const res = await fetch(BASE + '/state');
      if (!res.ok) return null;
      return (await res.json()) as AppState;
    } catch {
      return null;
    }
  },
  createLog: (e: LogEntry) => post('/logs', e),
  confirmLog: (id: string) => post(`/logs/${id}/confirm`, {}),
  editLog: (id: string, p: Partial<LogEntry>) => patch(`/logs/${id}`, p),
  flushBatch: (entries: LogEntry[]) => post('/logs/batch', { entries }),
  addDoctorNote: (n: DoctorNote) => post('/doctor-notes', n),
  addDoctorVisit: (v: DoctorVisit) => post('/doctor-visits', v),
  logAdherence: (medId: string, r: AdherenceRecord) => post(`/medications/${medId}/adherence`, r),
  updatePrefs: (p: UserPrefs) => patch('/prefs', p),
  addAchievement: (a: Achievement) => post('/achievements', a),
};
