/**
 * Khumpai application state store (zustand).
 *
 * The SERVER (Postgres via the /api backend) is the source of truth. This store
 * is an in-memory cache: it is initialized from SEED_STATE for instant first
 * paint, hydrated from `GET /api/state` on app load (see hydrateFromServer),
 * and every mutating action write-throughs to the API (best-effort; the offline
 * syncQueue covers durability when the server is unreachable). `sessionStorage`
 * persistence is kept only as a fast cold-start cache — never authoritative.
 *
 * Non-React usage:
 *   import { useAppStore } from '@/store/appStore';
 *   useAppStore.getState().actions.addLog(entry);
 *
 * React usage:
 *   const { logs, actions } = useAppStore();
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SEED_STATE } from '@/data/seed';
import { api } from '@/lib/api/client';
import type {
  AppState,
  LogEntry,
  DoctorNote,
  DoctorVisit,
  Medication,
  AdherenceRecord,
  UserPrefs,
  Achievement,
} from '@/types';

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

interface AppActions {
  /** Append a new log entry. Write-throughs to POST /api/logs. */
  addLog: (entry: LogEntry) => void;
  /** Set confirmed=true on the matching entry (idempotent). Write-throughs. */
  confirmLog: (id: string) => void;
  /** Apply a partial update, setting editedAt to now. Write-throughs (PATCH). */
  editLog: (id: string, patch: Partial<LogEntry>) => void;
  /** Append a doctor note. Write-throughs. */
  addDoctorNote: (note: DoctorNote) => void;
  /** Record a dose (idempotent on date+time). Write-throughs. */
  logMedicationTaken: (medicationId: string, record: AdherenceRecord) => void;
  /** Replace/append a medication (local only — no server endpoint yet). */
  upsertMedication: (med: Medication) => void;
  /** Append a doctor visit. Write-throughs. */
  addDoctorVisit: (visit: DoctorVisit) => void;
  /** Toggle the offline flag (local only). */
  setOffline: (isOffline: boolean) => void;
  /** Flush the syncQueue into logs and batch-POST them to the server. */
  flushSyncQueue: () => void;
  /** Merge a partial UserPrefs patch. Write-throughs the merged prefs. */
  updatePrefs: (patch: Partial<UserPrefs>) => void;
  /** Add an achievement (idempotent by id). Write-throughs. */
  addAchievement: (a: Achievement) => void;
  /** Queue a log while offline (local; flushed on reconnect). */
  enqueueOffline: (entry: LogEntry) => void;
}

type KhumpaiStore = AppState & { actions: AppActions };

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useAppStore = create<KhumpaiStore>()(
  persist(
    (set, get) => ({
      ...SEED_STATE,

      actions: {
        addLog: (entry) => {
          set((s) => ({ logs: [...s.logs, entry] }));
          void api.createLog(entry);
        },

        confirmLog: (id) => {
          set((s) => ({
            logs: s.logs.map((log) =>
              log.id === id && !log.confirmed ? { ...log, confirmed: true } : log,
            ),
          }));
          void api.confirmLog(id);
        },

        editLog: (id, patch) => {
          set((s) => ({
            logs: s.logs.map((log) => {
              if (log.id !== id) return log;
              const merged = {
                ...(log as unknown as Record<string, unknown>),
                ...(patch as unknown as Record<string, unknown>),
                type: log.type, // guard: never mutate the discriminant
                editedAt: new Date().toISOString(),
              };
              return merged as unknown as LogEntry;
            }),
          }));
          void api.editLog(id, patch);
        },

        addDoctorNote: (note) => {
          set((s) => ({ doctorNotes: [...s.doctorNotes, note] }));
          void api.addDoctorNote(note);
        },

        logMedicationTaken: (medicationId, record) => {
          set((s) => ({
            medications: s.medications.map((med) => {
              if (med.id !== medicationId) return med;
              const exists = med.adherenceLog.some(
                (r) => r.date === record.date && r.scheduledTime === record.scheduledTime,
              );
              if (exists) {
                return {
                  ...med,
                  adherenceLog: med.adherenceLog.map((r) =>
                    r.date === record.date && r.scheduledTime === record.scheduledTime
                      ? { ...r, taken: record.taken }
                      : r,
                  ),
                };
              }
              return { ...med, adherenceLog: [...med.adherenceLog, record] };
            }),
          }));
          void api.logAdherence(medicationId, record);
        },

        upsertMedication: (med) =>
          set((s) => {
            const exists = s.medications.some((m) => m.id === med.id);
            if (exists) {
              return { medications: s.medications.map((m) => (m.id === med.id ? med : m)) };
            }
            return { medications: [...s.medications, med] };
          }),

        addDoctorVisit: (visit) => {
          set((s) => ({ doctorVisits: [...s.doctorVisits, visit] }));
          void api.addDoctorVisit(visit);
        },

        setOffline: (isOffline) => set({ isOffline }),

        flushSyncQueue: () => {
          const queued = get().syncQueue;
          set((s) => {
            if (s.syncQueue.length === 0) return {};
            const existingIds = new Set(s.logs.map((l) => l.id));
            const newEntries = s.syncQueue.filter((e) => !existingIds.has(e.id));
            const merged = [...s.logs, ...newEntries].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            );
            return { logs: merged, syncQueue: [] };
          });
          if (queued.length > 0) void api.flushBatch(queued);
        },

        updatePrefs: (patch) => {
          set((s) => ({ prefs: { ...s.prefs, ...patch } }));
          void api.updatePrefs(get().prefs);
        },

        addAchievement: (a) => {
          let added = false;
          set((s) => {
            if (s.achievements.some((ach) => ach.id === a.id)) return {};
            added = true;
            return { achievements: [...s.achievements, a] };
          });
          if (added) void api.addAchievement(a);
        },

        enqueueOffline: (entry) =>
          set((s) => ({
            syncQueue: [...s.syncQueue, { ...entry, isOfflineCapture: true }],
          })),
      },
    }),
    {
      name: 'khumpai-app',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

// ---------------------------------------------------------------------------
// Server hydration — the server (Postgres) is authoritative.
// ---------------------------------------------------------------------------

/**
 * Fetch the full AppState from the backend and replace the in-memory cache.
 * Best-effort: if the server is unreachable, the store keeps its seed/cached
 * state so the app still works offline / without the backend running.
 */
export async function hydrateFromServer(): Promise<void> {
  const state = await api.fetchState();
  if (!state) return;
  // Preserve the `actions` object; replace only the data slices.
  useAppStore.setState({ ...state });
}
