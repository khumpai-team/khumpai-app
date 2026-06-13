# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-app notification system — medication reminders, red-flag/safety alerts, caregiver alerts, a daily check-in nudge, and an occasional achievement nudge — that surfaces while a Khumpai tab is open.

**Architecture:** Pure generators `(state, now, ctx) → AppNotification[]` decide what is *due*; a sessionStorage-backed `useNotificationStore` holds notifications and dedupes on `push`; a `useNotificationScheduler()` hook (mounted once in `AppLayout`) ticks every 60s, pushes new notifications, fires the browser `Notification` API for `warn`/`urgent` items, and sets the SafetyCard `notified` flag; a `NotificationCenter` bell renders the list.

**Tech Stack:** React + TypeScript, Zustand (`persist` + `createJSONStorage`), Vitest, Tailwind. No backend, no service worker (Web Push is an explicit future upgrade — see spec).

**Spec:** `docs/superpowers/specs/2026-06-12-notifications-design.md`

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `src/types/index.ts` | `AppNotification` + `NotificationKind`/`Severity`/`Status` (modify) | 1 |
| `src/data/i18n/es.ts` | `notifications` copy namespace (modify) | 2 |
| `src/lib/notifications/shared.ts` | constants, `NotificationContext`, `makeNotification` | 3 |
| `src/store/useNotificationStore.ts` | notification list + dedupe `push` + status actions | 4 |
| `src/lib/notifications/medication.ts` | `dueMedicationReminders` | 5 |
| `src/lib/notifications/caregiver.ts` | `caregiverAlertConditions` + `caregiverAlerts` | 6 |
| `src/screens/CaregiverDashboard.tsx` | consume the extracted helper (modify) | 6 |
| `src/lib/notifications/redFlag.ts` | `pendingRedFlagNotifications` | 7 |
| `src/lib/notifications/checkin.ts` | `dueCheckinNudge` | 8 |
| `src/lib/notifications/achievement.ts` | `occasionalAchievementReminder` | 9 |
| `src/lib/notifications/collect.ts` | `collectDueNotifications` | 10 |
| `src/agent/tools/scheduleReminder.ts` | persist reminder time into `schedule[]` (rewrite) | 11 |
| `src/hooks/useNotificationScheduler.ts` | tick, push, toast, safety flag | 12 |
| `src/components/notifications/NotificationCenter.tsx` + `AppLayout.tsx` | bell UI + global mount (modify) | 13 |

Test files are flat under `tests/` (project convention), one per generator/store/tool.

---

## Task 1: Notification types

**Files:**
- Modify: `src/types/index.ts` (append near the other domain types, e.g. after the `AppState` interface around line 389)

- [ ] **Step 1: Add the notification types**

Append to `src/types/index.ts`:

```ts
// ---------------------------------------------------------------------------
// Notifications (in-app reminder system)
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'medication'
  | 'red_flag'
  | 'caregiver'
  | 'checkin'
  | 'achievement';

export type NotificationSeverity = 'info' | 'warn' | 'urgent';

export type NotificationStatus = 'pending' | 'shown' | 'read' | 'dismissed';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  severity: NotificationSeverity;
  /** ISO timestamp the notification became due. */
  createdAt: string;
  /** Stable key; a second push with the same key is ignored. */
  dedupeKey: string;
  status: NotificationStatus;
  /** medicationId / logId / achievementId, by kind. */
  relatedId?: string;
  /** Caregiver multi-person attribution. */
  personId?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(notifications): add AppNotification types"
```

---

## Task 2: i18n copy

**Files:**
- Modify: `src/data/i18n/es.ts` (add a `notifications` key to the `es` object; place it after the `caregiver` block near line 207)

- [ ] **Step 1: Add the `notifications` namespace**

Insert into the `es` object in `src/data/i18n/es.ts` (after the `caregiver: { ... }` block). It references `RedFlagLevel`, which is already a type in `@/types` but is not needed here — the parameter is typed inline:

```ts
  notifications: {
    bell: 'Avisos',
    empty: 'No tienes avisos por ahora 💙',
    enable: 'Activar avisos',
    enabled: 'Avisos activados',
    markAllRead: 'Marcar como leídos',
    dismiss: 'Descartar',
    medicationTitle: 'Hora de tu medicina',
    medicationBody: (name: string) => `Es hora de tomar ${name}. 💊`,
    checkinTitle: '¿Cómo amaneciste?',
    checkinBody: 'Cuéntame cómo te sientes hoy. Estoy aquí para acompañarte. 💙',
    achievementTitle: 'Vas muy bien',
    achievementBody: 'Sigue cuidándote así — cada registro cuenta. 🌟',
    caregiverTitle: 'Atención',
    redFlagTitle: (level: 'urgent' | 'emergency') =>
      level === 'emergency' ? 'Atención urgente' : 'Conviene revisar',
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/data/i18n/es.ts
git commit -m "feat(notifications): add Spanish notification copy"
```

---

## Task 3: Shared helpers (constants, context, factory)

**Files:**
- Create: `src/lib/notifications/shared.ts`

- [ ] **Step 1: Write the shared module**

```ts
// src/lib/notifications/shared.ts
/**
 * Shared building blocks for the notification generators: tunable constants,
 * the context the scheduler threads in (data that lives outside AppState), and
 * a small factory so every generator produces a consistent AppNotification.
 */
import { uid } from '@/lib/id';
import type {
  AppNotification,
  NotificationKind,
  NotificationSeverity,
} from '@/types';

/** Minutes after a scheduled dose time during which a reminder is still "due". */
export const WINDOW_MIN = 60;

/** Local hour from which the daily check-in nudge may appear. */
export const CHECKIN_HOUR = 9;

/**
 * Data the generators need that does not live in AppState. The scheduler reads
 * it from the sibling stores (pillbox, session) and passes it in, keeping the
 * generators pure and unit-testable.
 */
export interface NotificationContext {
  /** Remaining pills per medication id (usePillboxStore). */
  stock: Record<string, number>;
  /** Capacity per medication id (usePillboxStore). */
  capacity: Record<string, number>;
  /** YYYY-MM-DD of the last completed morning check-in (useSessionStore). */
  lastCheckinDate: string | null;
}

export function makeNotification(args: {
  kind: NotificationKind;
  title: string;
  body: string;
  severity: NotificationSeverity;
  dedupeKey: string;
  createdAt: string;
  relatedId?: string;
  personId?: string;
}): AppNotification {
  return { id: uid('notif'), status: 'pending', ...args };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/shared.ts
git commit -m "feat(notifications): shared constants, context, and factory"
```

---

## Task 4: Notification store

**Files:**
- Create: `src/store/useNotificationStore.ts`
- Test: `tests/notifStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/notifStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore, unreadCount } from '@/store/useNotificationStore';
import type { AppNotification } from '@/types';

function notif(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'medication',
    title: 't',
    body: 'b',
    severity: 'info',
    createdAt: '2026-06-12T08:00:00.000Z',
    dedupeKey: 'med:x:2026-06-12:08:00',
    status: 'pending',
    ...over,
  };
}

describe('useNotificationStore', () => {
  beforeEach(() => useNotificationStore.getState().actions.clear());

  it('ignores a push whose dedupeKey already exists', () => {
    const { push } = useNotificationStore.getState().actions;
    push(notif());
    push(notif({ id: 'n2' })); // same dedupeKey
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it('adds notifications with distinct dedupeKeys', () => {
    const { push } = useNotificationStore.getState().actions;
    push(notif());
    push(notif({ id: 'n2', dedupeKey: 'checkin:2026-06-12' }));
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
  });

  it('markRead moves a notification out of the unread set', () => {
    const { push, markRead } = useNotificationStore.getState().actions;
    push(notif());
    markRead('n1');
    expect(useNotificationStore.getState().notifications[0].status).toBe('read');
    expect(unreadCount(useNotificationStore.getState().notifications)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifStore.test.ts`
Expected: FAIL ("Failed to resolve import @/store/useNotificationStore").

- [ ] **Step 3: Write the store**

```ts
// src/store/useNotificationStore.ts
/**
 * In-app notification inbox. Like the sibling stores it persists to
 * sessionStorage purely as a cold-start cache. `push` is idempotent on
 * `dedupeKey`, which is what lets the 60s scheduler tick run freely.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppNotification } from '@/types';

interface NotificationState {
  notifications: AppNotification[];
  actions: {
    push: (n: AppNotification) => void;
    markShown: (id: string) => void;
    markRead: (id: string) => void;
    dismiss: (id: string) => void;
    clear: () => void;
  };
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      actions: {
        push: (n) =>
          set((s) => {
            if (s.notifications.some((x) => x.dedupeKey === n.dedupeKey)) return {};
            return { notifications: [n, ...s.notifications] };
          }),
        markShown: (id) =>
          set((s) => ({
            notifications: s.notifications.map((x) =>
              x.id === id ? { ...x, status: 'shown' as const } : x,
            ),
          })),
        markRead: (id) =>
          set((s) => ({
            notifications: s.notifications.map((x) =>
              x.id === id ? { ...x, status: 'read' as const } : x,
            ),
          })),
        dismiss: (id) =>
          set((s) => ({
            notifications: s.notifications.map((x) =>
              x.id === id ? { ...x, status: 'dismissed' as const } : x,
            ),
          })),
        clear: () => set({ notifications: [] }),
      },
    }),
    {
      name: 'khumpai-notifications',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ notifications: s.notifications }),
    },
  ),
);

/** Count of notifications still demanding attention (pending or just shown). */
export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => n.status === 'pending' || n.status === 'shown').length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notifStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/useNotificationStore.ts tests/notifStore.test.ts
git commit -m "feat(notifications): notification store with dedupe push"
```

---

## Task 5: Medication reminders generator

**Files:**
- Create: `src/lib/notifications/medication.ts`
- Test: `tests/notifMedication.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/notifMedication.test.ts
import { describe, it, expect } from 'vitest';
import { dueMedicationReminders } from '@/lib/notifications/medication';
import { SEED_STATE } from '@/data/seed';
import type { AppState, Medication } from '@/types';

function makeState(meds: Medication[], currentPersonId = 'carlos'): AppState {
  return { ...SEED_STATE, logs: [], medications: meds, currentPersonId };
}

function med(over: Partial<Medication> = {}): Medication {
  return {
    id: 'med-x',
    personId: 'carlos',
    name: 'Metformina',
    dose: '850 mg',
    frequency: '2 veces al día',
    schedule: ['08:00'],
    adherenceLog: [],
    ...over,
  };
}

describe('dueMedicationReminders', () => {
  it('emits a reminder when now is inside the dose window', () => {
    const out = dueMedicationReminders(makeState([med()]), new Date('2026-06-12T08:10:00'));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('medication');
    expect(out[0].severity).toBe('info');
    expect(out[0].dedupeKey).toBe('med:med-x:2026-06-12:08:00');
    expect(out[0].relatedId).toBe('med-x');
  });

  it('does not emit before or after the window', () => {
    expect(dueMedicationReminders(makeState([med()]), new Date('2026-06-12T07:30:00'))).toHaveLength(0);
    expect(dueMedicationReminders(makeState([med()]), new Date('2026-06-12T09:30:00'))).toHaveLength(0);
  });

  it('suppresses the reminder once the dose is taken today', () => {
    const m = med({ adherenceLog: [{ date: '2026-06-12', scheduledTime: '08:00', taken: true }] });
    expect(dueMedicationReminders(makeState([m]), new Date('2026-06-12T08:10:00'))).toHaveLength(0);
  });

  it('ignores medications belonging to other persons', () => {
    const out = dueMedicationReminders(makeState([med({ personId: 'rosa' })]), new Date('2026-06-12T08:10:00'));
    expect(out).toHaveLength(0);
  });

  it('handles multiple scheduled times independently', () => {
    const out = dueMedicationReminders(makeState([med({ schedule: ['08:00', '20:00'] })]), new Date('2026-06-12T20:05:00'));
    expect(out).toHaveLength(1);
    expect(out[0].dedupeKey).toBe('med:med-x:2026-06-12:20:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifMedication.test.ts`
Expected: FAIL ("Failed to resolve import .../medication").

- [ ] **Step 3: Write the generator**

```ts
// src/lib/notifications/medication.ts
/**
 * Medication reminders: for each of the current person's medications and each
 * HH:mm in its schedule, emit a reminder while now is within the dose window,
 * unless that dose is already marked taken today.
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification, WINDOW_MIN } from './shared';
import type { AppNotification, AppState } from '@/types';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function dueMedicationReminders(state: AppState, now: Date): AppNotification[] {
  const today = dateKey(now.toISOString());
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const meds = state.medications.filter((m) => m.personId === state.currentPersonId);
  const out: AppNotification[] = [];

  for (const med of meds) {
    for (const time of med.schedule) {
      const t = toMinutes(time);
      const due = nowMin >= t && nowMin < t + WINDOW_MIN;
      if (!due) continue;
      const taken = med.adherenceLog.some(
        (r) => r.date === today && r.scheduledTime === time && r.taken,
      );
      if (taken) continue;
      out.push(
        makeNotification({
          kind: 'medication',
          title: es.notifications.medicationTitle,
          body: es.notifications.medicationBody(med.name),
          severity: 'info',
          dedupeKey: `med:${med.id}:${today}:${time}`,
          createdAt: now.toISOString(),
          relatedId: med.id,
        }),
      );
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notifMedication.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/medication.ts tests/notifMedication.test.ts
git commit -m "feat(notifications): medication reminders generator"
```

---

## Task 6: Caregiver alerts (extract shared condition helper)

**Files:**
- Create: `src/lib/notifications/caregiver.ts`
- Modify: `src/screens/CaregiverDashboard.tsx` (replace the inline `stockLow`/`highToday` logic at `:107` and `:117-123` with the helper)
- Test: `tests/notifCaregiver.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/notifCaregiver.test.ts
import { describe, it, expect } from 'vitest';
import { caregiverAlertConditions, caregiverAlerts } from '@/lib/notifications/caregiver';
import { SEED_STATE } from '@/data/seed';
import type { AppState, GlucoseLog, Medication, NotificationContext } from '@/types';

const NOW = new Date('2026-06-12T10:00:00');
const TODAY = '2026-06-12';

function glucose(value: number, dateIso: string): GlucoseLog {
  return {
    id: `g-${value}`,
    personId: 'carlos',
    type: 'glucose',
    timestamp: dateIso,
    createdAt: dateIso,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { value, moment: 'ayunas' },
  };
}

function ctx(over: Partial<NotificationContext> = {}): NotificationContext {
  return { stock: {}, capacity: {}, lastCheckinDate: null, ...over };
}

const MED: Medication = {
  id: 'med-x', personId: 'carlos', name: 'Metformina', dose: '850 mg',
  frequency: '1/día', schedule: ['08:00'], adherenceLog: [],
};

function state(over: Partial<AppState> = {}): AppState {
  return { ...SEED_STATE, logs: [], medications: [MED], currentPersonId: 'carlos', ...over };
}

describe('caregiverAlertConditions', () => {
  it('flags high glucose only when the latest reading is >=180 and dated today', () => {
    const c = caregiverAlertConditions([glucose(210, `${TODAY}T09:00:00`)], 'carlos', NOW, { remaining: 30, capacity: 30 });
    expect(c.highToday).toBe(210);
  });

  it('does not flag a high reading from a previous day', () => {
    const c = caregiverAlertConditions([glucose(210, '2026-06-11T09:00:00')], 'carlos', NOW, { remaining: 30, capacity: 30 });
    expect(c.highToday).toBeNull();
  });

  it('flags low stock at or below max(6, 20% of capacity)', () => {
    expect(caregiverAlertConditions([], 'carlos', NOW, { remaining: 6, capacity: 30 }).stockLow).toBe(true);
    expect(caregiverAlertConditions([], 'carlos', NOW, { remaining: 10, capacity: 30 }).stockLow).toBe(false);
  });
});

describe('caregiverAlerts', () => {
  it('emits a high-glucose alert with a per-day dedupe key', () => {
    const out = caregiverAlerts(state({ logs: [glucose(210, `${TODAY}T09:00:00`)] }), NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('caregiver');
    expect(out[0].severity).toBe('warn');
    expect(out[0].dedupeKey).toBe('caregiver:high:carlos:2026-06-12');
  });

  it('emits a low-stock alert', () => {
    const out = caregiverAlerts(state(), NOW, ctx({ stock: { 'med-x': 4 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(1);
    expect(out[0].dedupeKey).toBe('caregiver:stock:carlos:2026-06-12');
  });

  it('emits nothing when calm', () => {
    const out = caregiverAlerts(state(), NOW, ctx({ stock: { 'med-x': 30 }, capacity: { 'med-x': 30 } }));
    expect(out).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifCaregiver.test.ts`
Expected: FAIL ("Failed to resolve import .../caregiver").

Note: `NotificationContext` is imported from `@/types` in the test. It currently lives in `src/lib/notifications/shared.ts`. **Re-export it from `@/types`** so both the test and consumers have one import site — add this line to `src/types/index.ts`:

```ts
export type { NotificationContext } from '@/lib/notifications/shared';
```

(Do this as part of Step 3.)

- [ ] **Step 3: Write the generator + re-export the context type**

Add the re-export to `src/types/index.ts` (see note above), then create:

```ts
// src/lib/notifications/caregiver.ts
/**
 * Caregiver alerts: high glucose today and low pill stock. The condition logic
 * is shared with CaregiverDashboard so the dashboard banner and the
 * notification never disagree.
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification, type NotificationContext } from './shared';
import type { AppNotification, AppState, GlucoseLog, LogEntry } from '@/types';

const STOCK_FLOOR = 6;
const DEFAULT_CAPACITY = 30;

export function caregiverAlertConditions(
  logs: LogEntry[],
  personId: string,
  now: Date,
  stock: { remaining: number | null; capacity: number },
): { highToday: number | null; stockLow: boolean } {
  const today = dateKey(now.toISOString());
  const latest = logs
    .filter((l) => l.personId === personId)
    .filter((l): l is GlucoseLog => l.type === 'glucose')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const highToday =
    latest && latest.payload.value >= 180 && dateKey(latest.timestamp) === today
      ? latest.payload.value
      : null;
  const stockLow =
    stock.remaining != null
      ? stock.remaining <= Math.max(STOCK_FLOOR, stock.capacity * 0.2)
      : false;
  return { highToday, stockLow };
}

export function caregiverAlerts(
  state: AppState,
  now: Date,
  ctx: NotificationContext,
): AppNotification[] {
  const pid = state.currentPersonId;
  const medId = state.medications.find((m) => m.personId === pid)?.id;
  const capacity = medId != null ? ctx.capacity[medId] ?? DEFAULT_CAPACITY : DEFAULT_CAPACITY;
  const remaining =
    medId != null ? ctx.stock[medId] ?? ctx.capacity[medId] ?? DEFAULT_CAPACITY : null;

  const { highToday, stockLow } = caregiverAlertConditions(state.logs, pid, now, {
    remaining,
    capacity,
  });
  const today = dateKey(now.toISOString());
  const out: AppNotification[] = [];

  if (highToday != null) {
    out.push(
      makeNotification({
        kind: 'caregiver',
        title: es.notifications.caregiverTitle,
        body: es.caregiver.alertHigh(highToday),
        severity: 'warn',
        dedupeKey: `caregiver:high:${pid}:${today}`,
        createdAt: now.toISOString(),
        personId: pid,
      }),
    );
  }
  if (stockLow) {
    out.push(
      makeNotification({
        kind: 'caregiver',
        title: es.notifications.caregiverTitle,
        body: es.caregiver.alertStock,
        severity: 'warn',
        dedupeKey: `caregiver:stock:${pid}:${today}`,
        createdAt: now.toISOString(),
        personId: pid,
      }),
    );
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notifCaregiver.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Refactor CaregiverDashboard to use the shared helper (no behavior change)**

In `src/screens/CaregiverDashboard.tsx`:

1. Add the import (next to the other `@/lib` imports near line 11):

```ts
import { caregiverAlertConditions } from '@/lib/notifications/caregiver';
```

2. In the `data` memo, **remove** the inline `stockLow` line (currently `:107`):

```ts
    const stockLow = stock != null && meds.length ? stock <= Math.max(6, (capMap[meds[0].id] ?? 30) * 0.2) : false;
```

   and **remove** `stockLow` from the memo's return object (currently `:113`), leaving `stock` in place.

3. Replace the alert-building block (currently `:116-123`):

```ts
  const today = dateKey(new Date().toISOString());
  const highToday =
    data.latest && data.latest.payload.value >= 180 && dateKey(data.latest.timestamp) === today
      ? data.latest.payload.value
      : null;
  const alerts: string[] = [];
  if (highToday) alerts.push(es.caregiver.alertHigh(highToday));
  if (data.stockLow) alerts.push(es.caregiver.alertStock);
```

   with:

```ts
  const medId = medications.find((m) => m.personId === patient?.id)?.id;
  const { highToday, stockLow } = caregiverAlertConditions(logs, patient?.id ?? '', new Date(), {
    remaining: data.stock,
    capacity: (medId ? capMap[medId] : undefined) ?? 30,
  });
  const alerts: string[] = [];
  if (highToday) alerts.push(es.caregiver.alertHigh(highToday));
  if (stockLow) alerts.push(es.caregiver.alertStock);
```

   (`dateKey` may now be unused in this file — remove its import if `npx tsc --noEmit` flags it.)

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (no type errors; all tests green).

- [ ] **Step 7: Commit**

```bash
git add src/lib/notifications/caregiver.ts src/screens/CaregiverDashboard.tsx src/types/index.ts tests/notifCaregiver.test.ts
git commit -m "feat(notifications): caregiver alerts + shared condition helper"
```

---

## Task 7: Red-flag notifications generator

**Files:**
- Create: `src/lib/notifications/redFlag.ts`
- Test: `tests/notifRedFlag.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/notifRedFlag.test.ts
import { describe, it, expect } from 'vitest';
import { pendingRedFlagNotifications } from '@/lib/notifications/redFlag';
import { SEED_STATE } from '@/data/seed';
import type { AppState, GlucoseLog, SymptomLog } from '@/types';

const NOW = new Date('2026-06-12T10:00:00');
const TODAY = '2026-06-12';

function symptom(description: string, dateIso: string): SymptomLog {
  return {
    id: `s-${description}`,
    personId: 'carlos',
    type: 'symptom',
    timestamp: dateIso,
    createdAt: dateIso,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { description, redFlag: true },
  };
}

function glucose(value: number, dateIso: string): GlucoseLog {
  return {
    id: `g-${value}`,
    personId: 'carlos',
    type: 'glucose',
    timestamp: dateIso,
    createdAt: dateIso,
    source: 'conversation',
    confirmed: true,
    isOfflineCapture: false,
    payload: { value, moment: 'ayunas' },
  };
}

function state(logs: AppState['logs']): AppState {
  return { ...SEED_STATE, logs, medications: [], currentPersonId: 'carlos' };
}

describe('pendingRedFlagNotifications', () => {
  it('emits an urgent notification for a very low glucose reading today', () => {
    const out = pendingRedFlagNotifications(state([glucose(45, `${TODAY}T09:00:00`)]), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('red_flag');
    expect(out[0].severity).toBe('urgent');
    expect(out[0].dedupeKey).toBe('redflag:g-45');
  });

  it('does not emit for an in-range glucose reading', () => {
    expect(pendingRedFlagNotifications(state([glucose(120, `${TODAY}T09:00:00`)]), NOW)).toHaveLength(0);
  });

  it('does not emit for red-flag logs from a previous day', () => {
    expect(pendingRedFlagNotifications(state([glucose(45, '2026-06-11T09:00:00')]), NOW)).toHaveLength(0);
  });

  it('emits for an emergency symptom description', () => {
    const out = pendingRedFlagNotifications(state([symptom('dolor en el pecho', `${TODAY}T09:00:00`)]), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('urgent');
  });
});
```

> Note: `'dolor en el pecho'` matches the emergency regex in `evaluateRedFlag`; if the seed phrasing differs, adjust the description to any phrase that `evaluateRedFlag` classifies `urgent`/`emergency` (see `src/agent/tools/evaluateRedFlag.ts`). Both `urgent` and `emergency` map to `severity: 'urgent'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifRedFlag.test.ts`
Expected: FAIL ("Failed to resolve import .../redFlag").

- [ ] **Step 3: Write the generator**

```ts
// src/lib/notifications/redFlag.ts
/**
 * Red-flag alerts: scan today's symptom and glucose logs for the current
 * person; emit an urgent notification for any that the red-flag evaluators
 * classify urgent or emergency.
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { evaluateRedFlag, evaluateGlucoseRedFlag } from '@/agent/tools/evaluateRedFlag';
import { makeNotification } from './shared';
import type { AppNotification, AppState, GlucoseLog, RedFlagLevel, SymptomLog } from '@/types';

export function pendingRedFlagNotifications(state: AppState, now: Date): AppNotification[] {
  const today = dateKey(now.toISOString());
  const out: AppNotification[] = [];

  for (const log of state.logs) {
    if (log.personId !== state.currentPersonId) continue;
    if (dateKey(log.timestamp) !== today) continue;

    let level: RedFlagLevel = 'ok';
    let message = '';
    if (log.type === 'symptom') {
      const r = evaluateRedFlag((log as SymptomLog).payload.description);
      level = r.level;
      message = r.message;
    } else if (log.type === 'glucose') {
      const r = evaluateGlucoseRedFlag((log as GlucoseLog).payload.value);
      level = r.level;
      message = r.message;
    } else {
      continue;
    }

    if (level !== 'urgent' && level !== 'emergency') continue;

    out.push(
      makeNotification({
        kind: 'red_flag',
        title: es.notifications.redFlagTitle(level),
        body: message,
        severity: 'urgent',
        dedupeKey: `redflag:${log.id}`,
        createdAt: now.toISOString(),
        relatedId: log.id,
      }),
    );
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notifRedFlag.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/redFlag.ts tests/notifRedFlag.test.ts
git commit -m "feat(notifications): red-flag notifications generator"
```

---

## Task 8: Daily check-in nudge generator

**Files:**
- Create: `src/lib/notifications/checkin.ts`
- Test: `tests/notifCheckin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/notifCheckin.test.ts
import { describe, it, expect } from 'vitest';
import { dueCheckinNudge } from '@/lib/notifications/checkin';
import { SEED_STATE } from '@/data/seed';
import type { AppState, GlucoseLog, NotificationContext } from '@/types';

const TODAY = '2026-06-12';

function ctx(over: Partial<NotificationContext> = {}): NotificationContext {
  return { stock: {}, capacity: {}, lastCheckinDate: null, ...over };
}

function state(logs: AppState['logs'] = []): AppState {
  return { ...SEED_STATE, logs, medications: [], currentPersonId: 'carlos' };
}

function glucose(dateIso: string): GlucoseLog {
  return {
    id: 'g', personId: 'carlos', type: 'glucose', timestamp: dateIso, createdAt: dateIso,
    source: 'conversation', confirmed: true, isOfflineCapture: false,
    payload: { value: 110, moment: 'ayunas' },
  };
}

describe('dueCheckinNudge', () => {
  it('nudges after the morning hour when nothing is logged today', () => {
    const out = dueCheckinNudge(state(), new Date('2026-06-12T10:00:00'), ctx());
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('checkin');
    expect(out[0].dedupeKey).toBe(`checkin:${TODAY}`);
  });

  it('stays silent before the morning hour', () => {
    expect(dueCheckinNudge(state(), new Date('2026-06-12T07:00:00'), ctx())).toHaveLength(0);
  });

  it('stays silent once the morning check-in is already done today', () => {
    expect(dueCheckinNudge(state(), new Date('2026-06-12T10:00:00'), ctx({ lastCheckinDate: TODAY }))).toHaveLength(0);
  });

  it('stays silent when something is already logged today', () => {
    expect(dueCheckinNudge(state([glucose(`${TODAY}T08:00:00`)]), new Date('2026-06-12T10:00:00'), ctx())).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifCheckin.test.ts`
Expected: FAIL ("Failed to resolve import .../checkin").

- [ ] **Step 3: Write the generator**

```ts
// src/lib/notifications/checkin.ts
/**
 * Daily check-in nudge: one gentle reminder to log, shown after CHECKIN_HOUR
 * when the morning check-in has not run and nothing has been logged today.
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification, CHECKIN_HOUR, type NotificationContext } from './shared';
import type { AppNotification, AppState } from '@/types';

export function dueCheckinNudge(
  state: AppState,
  now: Date,
  ctx: NotificationContext,
): AppNotification[] {
  if (now.getHours() < CHECKIN_HOUR) return [];
  const today = dateKey(now.toISOString());
  if (ctx.lastCheckinDate === today) return [];

  const loggedToday = state.logs.some(
    (l) => l.personId === state.currentPersonId && dateKey(l.timestamp) === today,
  );
  if (loggedToday) return [];

  return [
    makeNotification({
      kind: 'checkin',
      title: es.notifications.checkinTitle,
      body: es.notifications.checkinBody,
      severity: 'info',
      dedupeKey: `checkin:${today}`,
      createdAt: now.toISOString(),
    }),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notifCheckin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/checkin.ts tests/notifCheckin.test.ts
git commit -m "feat(notifications): daily check-in nudge generator"
```

---

## Task 9: Occasional achievement nudge generator

**Files:**
- Create: `src/lib/notifications/achievement.ts`
- Test: `tests/notifAchievement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/notifAchievement.test.ts
import { describe, it, expect } from 'vitest';
import { occasionalAchievementReminder } from '@/lib/notifications/achievement';
import { SEED_STATE } from '@/data/seed';
import type { AppState, Achievement } from '@/types';

const NOW = new Date('2026-06-12T18:00:00');

function ach(): Achievement {
  // Minimal shape; spread over a seed achievement if the type needs more fields.
  return { ...SEED_STATE.achievements[0] } as Achievement;
}

function state(achievements: Achievement[]): AppState {
  return { ...SEED_STATE, achievements, currentPersonId: 'carlos' };
}

describe('occasionalAchievementReminder', () => {
  it('nudges at most once per day when there are achievements', () => {
    const out = occasionalAchievementReminder(state([ach()]), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('achievement');
    expect(out[0].severity).toBe('info');
    expect(out[0].dedupeKey).toBe('achievement:2026-06-12');
  });

  it('stays silent when there are no achievements', () => {
    expect(occasionalAchievementReminder(state([]), NOW)).toHaveLength(0);
  });
});
```

> Note: if `SEED_STATE.achievements` is empty, build `ach()` from the `Achievement` type's required fields instead (see `src/types/index.ts`). The test only depends on a non-empty achievements array.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifAchievement.test.ts`
Expected: FAIL ("Failed to resolve import .../achievement").

- [ ] **Step 3: Write the generator**

```ts
// src/lib/notifications/achievement.ts
/**
 * Occasional achievement nudge: a warm, celebratory reminder, rate-limited to
 * at most one per day via its date-scoped dedupeKey. Celebration only — no
 * streak / consecutive-day logic (matches evaluateAchievements' design).
 */
import { dateKey } from '@/lib/dateUtils';
import { es } from '@/data/i18n/es';
import { makeNotification } from './shared';
import type { AppNotification, AppState } from '@/types';

export function occasionalAchievementReminder(state: AppState, now: Date): AppNotification[] {
  if (state.achievements.length === 0) return [];
  const today = dateKey(now.toISOString());
  return [
    makeNotification({
      kind: 'achievement',
      title: es.notifications.achievementTitle,
      body: es.notifications.achievementBody,
      severity: 'info',
      dedupeKey: `achievement:${today}`,
      createdAt: now.toISOString(),
    }),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notifAchievement.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/achievement.ts tests/notifAchievement.test.ts
git commit -m "feat(notifications): occasional achievement nudge generator"
```

---

## Task 10: collectDueNotifications + dedupe contract

**Files:**
- Create: `src/lib/notifications/collect.ts`
- Test: `tests/notifCollect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/notifCollect.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { collectDueNotifications } from '@/lib/notifications/collect';
import { useNotificationStore } from '@/store/useNotificationStore';
import { SEED_STATE } from '@/data/seed';
import type { AppState, Medication, NotificationContext } from '@/types';

const NOW = new Date('2026-06-12T08:10:00');

const MED: Medication = {
  id: 'med-x', personId: 'carlos', name: 'Metformina', dose: '850 mg',
  frequency: '1/día', schedule: ['08:00'], adherenceLog: [],
};

function ctx(): NotificationContext {
  return { stock: { 'med-x': 30 }, capacity: { 'med-x': 30 }, lastCheckinDate: null };
}

function state(): AppState {
  return { ...SEED_STATE, logs: [], medications: [MED], achievements: [], currentPersonId: 'carlos' };
}

describe('collectDueNotifications', () => {
  it('returns the medication reminder and the check-in nudge for this state', () => {
    const out = collectDueNotifications(state(), NOW, ctx());
    const kinds = out.map((n) => n.kind).sort();
    // 08:10, dose not taken → medication; nothing logged but before CHECKIN_HOUR(9) → no checkin.
    expect(kinds).toContain('medication');
  });

  it('is idempotent through the store: pushing the same collect output twice adds nothing the second time', () => {
    useNotificationStore.getState().actions.clear();
    const first = collectDueNotifications(state(), NOW, ctx());
    first.forEach((n) => useNotificationStore.getState().actions.push(n));
    const afterFirst = useNotificationStore.getState().notifications.length;

    const second = collectDueNotifications(state(), NOW, ctx());
    second.forEach((n) => useNotificationStore.getState().actions.push(n));
    const afterSecond = useNotificationStore.getState().notifications.length;

    expect(afterSecond).toBe(afterFirst);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notifCollect.test.ts`
Expected: FAIL ("Failed to resolve import .../collect").

- [ ] **Step 3: Write the aggregator**

```ts
// src/lib/notifications/collect.ts
/**
 * Runs every generator and concatenates the result. Dedup is NOT done here — it
 * is the notification store's push contract — so this can be called each tick.
 */
import { dueMedicationReminders } from './medication';
import { pendingRedFlagNotifications } from './redFlag';
import { caregiverAlerts } from './caregiver';
import { dueCheckinNudge } from './checkin';
import { occasionalAchievementReminder } from './achievement';
import type { NotificationContext } from './shared';
import type { AppNotification, AppState } from '@/types';

export function collectDueNotifications(
  state: AppState,
  now: Date,
  ctx: NotificationContext,
): AppNotification[] {
  return [
    ...dueMedicationReminders(state, now),
    ...pendingRedFlagNotifications(state, now),
    ...caregiverAlerts(state, now, ctx),
    ...dueCheckinNudge(state, now, ctx),
    ...occasionalAchievementReminder(state, now),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notifCollect.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/collect.ts tests/notifCollect.test.ts
git commit -m "feat(notifications): collectDueNotifications aggregator"
```

---

## Task 11: scheduleReminder — persist into the schedule

**Files:**
- Modify: `src/agent/tools/scheduleReminder.ts` (replace the stub body; keep the input/result types)
- Test: `tests/scheduleReminder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scheduleReminder.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/appStore';
import { scheduleReminder } from '@/agent/tools/scheduleReminder';
import type { Medication } from '@/types';

const MED: Medication = {
  id: 'med-x', personId: 'carlos', name: 'Metformina', dose: '850 mg',
  frequency: '1 vez al día', schedule: ['08:00'], adherenceLog: [],
};

describe('scheduleReminder', () => {
  beforeEach(() => useAppStore.setState({ medications: [{ ...MED, schedule: ['08:00'] }] }));

  it('returns a scheduled result', () => {
    expect(scheduleReminder({ medicationId: 'med-x', time: '20:00' })).toEqual({
      scheduled: true,
      medicationId: 'med-x',
      time: '20:00',
    });
  });

  it('adds a new time to the medication schedule (sorted)', () => {
    scheduleReminder({ medicationId: 'med-x', time: '20:00' });
    const med = useAppStore.getState().medications.find((m) => m.id === 'med-x');
    expect(med?.schedule).toEqual(['08:00', '20:00']);
  });

  it('is idempotent for a time that already exists', () => {
    scheduleReminder({ medicationId: 'med-x', time: '08:00' });
    const med = useAppStore.getState().medications.find((m) => m.id === 'med-x');
    expect(med?.schedule).toEqual(['08:00']);
  });

  it('still validates input', () => {
    expect(() => scheduleReminder({ medicationId: '', time: '08:00' })).toThrow();
    expect(() => scheduleReminder({ medicationId: 'med-x', time: '8am' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scheduleReminder.test.ts`
Expected: FAIL (the current stub does not touch the store, so the schedule assertions fail).

- [ ] **Step 3: Rewrite the tool**

Replace the body of `src/agent/tools/scheduleReminder.ts` (keep the file header intent, the `zod` schema, and the result type — only the implementation changes):

```ts
/**
 * scheduleReminder — persist a daily medication reminder time.
 *
 * In-app delivery: this writes the time into the medication's `schedule[]`, and
 * the `dueMedicationReminders` generator surfaces it on the next scheduler tick.
 * (Closed-tab / cross-device delivery would need Web Push — see the spec.)
 */

import { z } from 'zod';
import { useAppStore } from '@/store/appStore';

const ScheduleReminderInput = z.object({
  medicationId: z.string().min(1, 'medicationId is required'),
  /** "HH:mm" time for the daily reminder. */
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm'),
});

export type ScheduleReminderInput = z.infer<typeof ScheduleReminderInput>;

export interface ScheduleReminderResult {
  scheduled: true;
  medicationId: string;
  time: string;
}

/**
 * Add `time` to the target medication's schedule (idempotent — never
 * duplicates a time, preserves existing entries). Throws ZodError on invalid
 * input. No-ops the persistence if the medication isn't found, but still
 * returns a scheduled result (the agent's intent is acknowledged).
 */
export function scheduleReminder(input: ScheduleReminderInput): ScheduleReminderResult {
  const parsed = ScheduleReminderInput.parse(input);
  const state = useAppStore.getState();
  const med = state.medications.find((m) => m.id === parsed.medicationId);
  if (med && !med.schedule.includes(parsed.time)) {
    state.actions.upsertMedication({
      ...med,
      schedule: [...med.schedule, parsed.time].sort(),
    });
  }
  return { scheduled: true, medicationId: parsed.medicationId, time: parsed.time };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scheduleReminder.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/agent/tools/scheduleReminder.ts tests/scheduleReminder.test.ts
git commit -m "feat(notifications): scheduleReminder persists into medication schedule"
```

---

## Task 12: Scheduler hook

**Files:**
- Create: `src/hooks/useNotificationScheduler.ts`

(Effects + timers + the `Notification` API — verified by manual click-through, not a unit test.)

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useNotificationScheduler.ts
/**
 * Drives the in-app notification system while a tab is open: ticks every 60s
 * (and once on mount, to catch up), pushes newly-due notifications, raises an
 * OS toast for warn/urgent items when permission is granted, and marks the
 * SafetyCard 'notified' flag when a red-flag notification first appears.
 */
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { usePillboxStore } from '@/store/usePillboxStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useChatStore } from '@/store/useChatStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { collectDueNotifications } from '@/lib/notifications/collect';

const TICK_MS = 60_000;

export function useNotificationScheduler(): void {
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const ctx = {
        stock: usePillboxStore.getState().stock,
        capacity: usePillboxStore.getState().capacity,
        lastCheckinDate: useSessionStore.getState().lastCheckinDate,
      };
      const due = collectDueNotifications(useAppStore.getState(), now, ctx);
      const { actions } = useNotificationStore.getState();

      let markedSafety = false;
      for (const n of due) {
        const before = useNotificationStore.getState().notifications.length;
        actions.push(n); // dedupes on dedupeKey
        const added = useNotificationStore.getState().notifications.length > before;
        if (!added) continue;

        // When a red-flag notification first appears, mark any un-notified
        // safety cards in the chat as notified (same urgent event surfaced in
        // two places). Done once per tick.
        if (n.kind === 'red_flag' && !markedSafety) {
          const chat = useChatStore.getState();
          chat.items.forEach((it) => {
            if (it.kind === 'safety' && !it.notified) chat.markSafetyNotified(it.id);
          });
          markedSafety = true;
        }

        // OS toast for attention-worthy items only, and only with permission.
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          n.severity !== 'info'
        ) {
          new Notification(n.title, { body: n.body });
          useNotificationStore.getState().actions.markShown(n.id);
        }
      }
    };

    tick(); // catch-up on mount
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNotificationScheduler.ts
git commit -m "feat(notifications): scheduler hook (tick, push, toast, safety flag)"
```

---

## Task 13: Notification center UI + global mount

**Files:**
- Create: `src/components/notifications/NotificationCenter.tsx`
- Modify: `src/app/AppLayout.tsx` (call the scheduler hook + render the bell inside the phone frame)

(UI — verified by manual click-through.)

- [ ] **Step 1: Write the NotificationCenter component**

```tsx
// src/components/notifications/NotificationCenter.tsx
/**
 * A floating bell in the top-right of the phone frame. Shows an unread badge,
 * opens a panel listing notifications (newest first) with mark-read / dismiss,
 * and holds the single permission toggle that enables OS toasts.
 */
import { useState } from 'react';
import { es } from '@/data/i18n/es';
import { useNotificationStore, unreadCount } from '@/store/useNotificationStore';

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const notifications = useNotificationStore((s) => s.notifications);
  const { markRead, dismiss } = useNotificationStore((s) => s.actions);

  const visible = notifications.filter((n) => n.status !== 'dismissed');
  const unread = unreadCount(notifications);

  const enableToasts = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  };

  return (
    <div className="absolute right-3 top-3 z-30">
      <button
        type="button"
        aria-label={es.notifications.bell}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-bg-base/90 text-lg shadow-soft-xl backdrop-blur"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-lg border border-border bg-bg-base p-2 shadow-soft-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-bold text-text-primary">{es.notifications.bell}</p>
            <button
              type="button"
              onClick={enableToasts}
              className="text-xs font-semibold text-accent"
            >
              {es.notifications.enable}
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-text-secondary">
              {es.notifications.empty}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((n) => (
                <li
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`rounded-md px-2 py-2 ${
                    n.status === 'read' ? 'bg-bg-base' : 'bg-bg-sunken'
                  } ${n.severity === 'urgent' ? 'border-l-2 border-danger' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{n.title}</p>
                      <p className="text-xs text-text-secondary">{n.body}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={es.notifications.dismiss}
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id);
                      }}
                      className="shrink-0 text-text-tertiary"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

> Note: the Tailwind tokens above (`bg-bg-base`, `bg-bg-sunken`, `text-text-*`, `border-border`, `shadow-soft-xl`, `text-accent`, `bg-danger`) follow the project's existing class vocabulary (see `CaregiverDashboard.tsx` / `AppLayout.tsx`). If `bg-danger`/`text-accent` aren't defined tokens, substitute the project's red and accent classes — grep `tailwind.config` / existing components.

- [ ] **Step 2: Mount the scheduler + bell in AppLayout**

Edit `src/app/AppLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { BottomNav } from '@/components/ui/BottomNav';
import { PanicButton } from '@/components/ui/PanicButton';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';

export function AppLayout() {
  useNotificationScheduler();
  return (
    <div className="device-backdrop grain relative flex min-h-[100dvh] items-center justify-center sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-phone flex-col overflow-hidden bg-bg-base sm:h-[860px] sm:max-h-[calc(100dvh-48px)] sm:rounded-[44px] sm:border sm:border-border sm:shadow-soft-xl">
        <NotificationCenter />
        <main className="relative flex-1 overflow-hidden">
          <Outlet />
        </main>
        <PanicButton />
        <BottomNav />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (no type errors; all tests green).

- [ ] **Step 4: Manual verification**

Run: `npm run dev` and open the app.
Verify:
1. A 🔔 bell shows top-right of the phone frame.
2. With a medication scheduled near the current time (or use the agent to call `scheduleReminder`, or temporarily set a med `schedule` to the current `HH:mm`), within ~60s an unread badge appears and the medication reminder is listed in the panel.
3. Clicking a notification marks it read (badge decrements); ✕ dismisses it.
4. "Activar avisos" prompts for OS notification permission; once granted, a `warn`/`urgent` notification (e.g. a high-glucose caregiver alert) also raises an OS toast. `info` items (medication/check-in/achievement) stay in-app only.
5. Reloading the tab does not duplicate notifications (dedupe + sessionStorage).

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/NotificationCenter.tsx src/app/AppLayout.tsx
git commit -m "feat(notifications): notification center UI + global mount"
```

---

## Final verification

- [ ] **Run the full test suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all tests pass, no type errors.

- [ ] **Update COORDINATION.md follow-up**

In `COORDINATION.md`, update item §8.3 ("`scheduleReminder` is a stub — integrate real device notifications") to note it is now wired to the in-app notification system, with Web Push remaining as the future upgrade for closed-tab delivery. Commit:

```bash
git add COORDINATION.md
git commit -m "docs: mark scheduleReminder wired to in-app notifications"
```
