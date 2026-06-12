/**
 * Khumpai application state store (zustand + persist → sessionStorage).
 *
 * Initialized from SEED_STATE so the demo always has Carlos's 10 days of data.
 *
 * Non-React usage:
 *   import { useAppStore } from '@/store/appStore';
 *   const state = useAppStore.getState();        // read current state
 *   useAppStore.setState({ isOffline: true });   // write (rare, prefer actions)
 *   useAppStore.getState().actions.addLog(entry); // preferred: use actions
 *
 * React usage:
 *   const { logs, actions } = useAppStore();
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SEED_STATE } from '@/data/seed';
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
  /**
   * Append a new log entry to the store.
   * The caller is responsible for setting entry.confirmed and entry.source.
   */
  addLog: (entry: LogEntry) => void;

  /**
   * Set confirmed=true on the matching log entry.
   * IDEMPOTENT: calling twice on an already-confirmed entry is a no-op.
   */
  confirmLog: (id: string) => void;

  /**
   * Apply a partial update to a log entry, setting editedAt to now.
   * Type-safe: accepts a Partial<LogEntry> patch — fields that are present
   * overwrite the existing entry; absent fields are unchanged. Because LogEntry
   * is a discriminated union the caller must not change the `type` field; if
   * an unknown field is included it is ignored at runtime (TypeScript will
   * catch mismatches at compile time via the spread).
   */
  editLog: (id: string, patch: Partial<LogEntry>) => void;

  /** Append a doctor note. */
  addDoctorNote: (note: DoctorNote) => void;

  /**
   * Record a medication dose (taken or missed) for a given medication.
   * IDEMPOTENT on (date, scheduledTime): if a record already exists for that
   * slot, its `taken` field is updated rather than duplicating the record.
   */
  logMedicationTaken: (medicationId: string, record: AdherenceRecord) => void;

  /**
   * Replace an existing medication by id or append if new.
   */
  upsertMedication: (med: Medication) => void;

  /** Append a doctor visit record. */
  addDoctorVisit: (visit: DoctorVisit) => void;

  /** Toggle the offline flag. */
  setOffline: (isOffline: boolean) => void;

  /**
   * Flush the syncQueue into logs.
   * Merges queued entries with logs, sorts by timestamp ascending, then
   * clears the syncQueue. Entries already in logs (same id) are deduplicated.
   */
  flushSyncQueue: () => void;

  /** Merge a partial UserPrefs patch into existing prefs. */
  updatePrefs: (patch: Partial<UserPrefs>) => void;

  /**
   * Add an achievement.
   * IDEMPOTENT by id: if an achievement with the same id already exists it is
   * not duplicated.
   */
  addAchievement: (a: Achievement) => void;

  /**
   * Push a log entry to the syncQueue while offline.
   * Sets isOfflineCapture=true on the entry automatically.
   */
  enqueueOffline: (entry: LogEntry) => void;
}

// ---------------------------------------------------------------------------
// Compound store type (state + actions flattened for easy destructuring)
// ---------------------------------------------------------------------------

type KhumpaiStore = AppState & { actions: AppActions };

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useAppStore = create<KhumpaiStore>()(
  persist(
    (set, _get) => ({
      // Spread the full seed state as initial state
      ...SEED_STATE,

      // Actions are nested under `actions` to keep the store shape clean and
      // to prevent accidental overwrites of state keys.
      actions: {
        addLog: (entry) =>
          set((s) => ({ logs: [...s.logs, entry] })),

        confirmLog: (id) =>
          set((s) => ({
            logs: s.logs.map((log) =>
              log.id === id && !log.confirmed
                ? { ...log, confirmed: true }
                : log,
            ),
          })),

        editLog: (id, patch) =>
          set((s) => ({
            logs: s.logs.map((log) => {
              if (log.id !== id) return log;
              // Spread the patch; set editedAt to now.
              // We go through `unknown` first because LogEntry is a discriminated
              // union without an index signature, so direct spreading via
              // Record<string,unknown> is rejected by TypeScript. The guard
              // below ensures the discriminant (`type`) is never mutated.
              const merged = {
                ...(log as unknown as Record<string, unknown>),
                ...(patch as unknown as Record<string, unknown>),
                type: log.type, // guard: never allow type discriminant to change
                editedAt: new Date().toISOString(),
              };
              return merged as unknown as LogEntry;
            }),
          })),

        addDoctorNote: (note) =>
          set((s) => ({ doctorNotes: [...s.doctorNotes, note] })),

        logMedicationTaken: (medicationId, record) =>
          set((s) => ({
            medications: s.medications.map((med) => {
              if (med.id !== medicationId) return med;

              // Idempotent: update existing record if date+scheduledTime match
              const exists = med.adherenceLog.some(
                (r) =>
                  r.date === record.date &&
                  r.scheduledTime === record.scheduledTime,
              );
              if (exists) {
                return {
                  ...med,
                  adherenceLog: med.adherenceLog.map((r) =>
                    r.date === record.date &&
                    r.scheduledTime === record.scheduledTime
                      ? { ...r, taken: record.taken }
                      : r,
                  ),
                };
              }
              return {
                ...med,
                adherenceLog: [...med.adherenceLog, record],
              };
            }),
          })),

        upsertMedication: (med) =>
          set((s) => {
            const exists = s.medications.some((m) => m.id === med.id);
            if (exists) {
              return {
                medications: s.medications.map((m) =>
                  m.id === med.id ? med : m,
                ),
              };
            }
            return { medications: [...s.medications, med] };
          }),

        addDoctorVisit: (visit) =>
          set((s) => ({ doctorVisits: [...s.doctorVisits, visit] })),

        setOffline: (isOffline) => set({ isOffline }),

        flushSyncQueue: () =>
          set((s) => {
            if (s.syncQueue.length === 0) return {};

            // Build a set of existing log ids to deduplicate
            const existingIds = new Set(s.logs.map((l) => l.id));
            const newEntries = s.syncQueue.filter(
              (e) => !existingIds.has(e.id),
            );

            // Merge and sort by timestamp ascending
            const merged = [...s.logs, ...newEntries].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime(),
            );

            return { logs: merged, syncQueue: [] };
          }),

        updatePrefs: (patch) =>
          set((s) => ({ prefs: { ...s.prefs, ...patch } })),

        addAchievement: (a) =>
          set((s) => {
            if (s.achievements.some((ach) => ach.id === a.id)) return {};
            return { achievements: [...s.achievements, a] };
          }),

        enqueueOffline: (entry) =>
          set((s) => ({
            syncQueue: [
              ...s.syncQueue,
              { ...entry, isOfflineCapture: true },
            ],
          })),
      },
    }),
    {
      name: 'khumpai-app',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist state keys, not the actions object (functions are not
      // serializable and zustand persist skips them automatically).
    },
  ),
);
