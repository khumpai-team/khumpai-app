# Notifications — in-app reminder system with local scheduling

**Date:** 2026-06-12
**Status:** Approved (pending spec review)

## Problem

Khumpai has no notification system. The agent tool `scheduleReminder`
(`src/agent/tools/scheduleReminder.ts`) is an explicit **stub**: it validates
`{ medicationId, time }` and returns `{ scheduled: true, ... }` without scheduling
anything. `COORDINATION.md` (§5, §8.3) marks it as Phase 2 work. The type system
already anticipates the feature — `LogSource` includes `'notification'` and
`SafetyCard` carries a `notified` flag — but nothing produces, delivers, or stores
notifications.

This spec defines a notification system that **medication reminders**, **red-flag /
safety alerts**, **caregiver alerts**, a **daily check-in nudge**, and an
**occasional achievement nudge** all flow through.

## Delivery model (and its honest limits)

Delivery is **in-app + local scheduling**: no backend, no service worker, no Web
Push. The consequence, stated plainly so it is not mistaken for more than it is:

- Notifications only fire **while a Khumpai tab is alive**. Nothing is delivered when
  the app is fully closed.
- The scheduler **catches up on app open** (surfaces recently-due reminders) and
  **ticks on an interval** while open.
- The browser `Notification` API can raise an OS-level toast **only** while the page
  is running (foreground or backgrounded-but-alive), and **only** after the user has
  granted permission.

**Web Push + service worker is the documented future upgrade path** for closed-tab /
cross-device delivery. It is explicitly out of scope here (see YAGNI).

## Goal

A single, well-bounded notification subsystem: pure generators decide *what is due*,
a store holds notifications, a scheduler hook surfaces them while the app is open, and
a notification center renders them. Each piece is testable in isolation and
communicates through a small typed interface.

## Architecture

```
                  pure, (state, now) → AppNotification[]
  ┌─────────────────────────────────────────────────────┐
  │  src/lib/notifications/                                │
  │   dueMedicationReminders · pendingRedFlagNotifications │
  │   caregiverAlerts · dueCheckinNudge ·                  │
  │   occasionalAchievementReminder                        │
  │            └── collectDueNotifications(state, now) ────┼──┐
  └─────────────────────────────────────────────────────┘  │
                                                             │ push (dedupe by key)
  ┌──────────────────────────────┐        reads/writes      ▼
  │ useNotificationScheduler()    │ ───────────────► useNotificationStore
  │  (mounted once at app root)   │                  notifications: AppNotification[]
  │  • interval tick (~60s)       │ ◄─────────────── push/markShown/markRead/dismiss
  │  • catch-up on mount          │     renders             ▲
  │  • fires browser Notification │                         │
  └──────────────────────────────┘                  ┌───────┴────────┐
                                                     │ NotificationCenter (bell+panel) │
                                                     └────────────────┘
```

Data flows one way: generators (pure) → scheduler (effects) → store (state) → UI
(render) → store (mark read/dismiss). Generators never touch the store or `Date`
directly; the scheduler injects both.

## Components

### 1. Model + store — `src/store/useNotificationStore.ts` (new)

Follows the existing small-focused-store pattern (`usePillboxStore`,
`useSessionStore`) and persists to **sessionStorage** via `zustand/middleware`
`persist` + `createJSONStorage` — a cold-start cache, never authoritative (matches the
`appStore` persistence note).

```ts
// src/types/index.ts (add)
export type NotificationKind =
  | 'medication' | 'red_flag' | 'caregiver' | 'checkin' | 'achievement';
export type NotificationSeverity = 'info' | 'warn' | 'urgent';
export type NotificationStatus = 'pending' | 'shown' | 'read' | 'dismissed';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  severity: NotificationSeverity;
  /** ISO timestamp the notification was created/became due. */
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

Store actions:

| Action | Behavior |
| --- | --- |
| `push(n: AppNotification)` | **No-op if a notification with the same `dedupeKey` already exists** (any status). This is what makes the interval tick idempotent. |
| `markShown(id)` | `pending → shown` (set after a browser `Notification` is fired). |
| `markRead(id)` | → `read`; drives the unread badge. |
| `dismiss(id)` | → `dismissed`; hidden from the panel but kept so its `dedupeKey` still suppresses re-creation. |
| `clear()` | Remove all. |

Selector helper: `unreadCount(state)` = notifications where `status` ∈
`{pending, shown}`.

### 2. Pure generators — `src/lib/notifications/` (new)

Each generator is `(state: AppState, now: Date) => AppNotification[]`, deterministic,
no side effects, no `Date.now()` inside (the scheduler passes `now`). All produced
notifications start `status: 'pending'` and carry a stable `dedupeKey`. i18n strings
come from `AGENT_ES` / `es` (see §6).

- **`dueMedicationReminders(state, now)`** — for each `Medication` of the current
  person and each `schedule[]` HH:mm time, emit a reminder when `now` is within the
  due window `[time, time + WINDOW_MIN)` (`WINDOW_MIN = 60`), **unless** an
  `AdherenceRecord` / `MedicationLog` for that med+date already shows the dose taken.
  `dedupeKey = med:{medId}:{YYYY-MM-DD}:{HH:mm}`. `severity: 'info'`.
  `relatedId = medId`.

- **`pendingRedFlagNotifications(state, now)`** — scan recent symptom/glucose logs
  whose red-flag level (`evaluateRedFlag` / `evaluateGlucoseRedFlag`, already in
  `@/agent/tools`) is `urgent` or `emergency`. `dedupeKey = redflag:{logId}`.
  `severity: 'urgent'`. `relatedId = logId`. The scheduler is responsible for setting
  the existing `SafetyCard.notified` flag (`useChatStore`) when it pushes one — the
  generator stays pure.

- **`caregiverAlerts(state, now)`** — emit a high-glucose alert (latest value `≥ 180`,
  dated today) and/or a low-stock alert. The `highToday` / `stockLow` logic currently
  lives inline in `CaregiverDashboard.tsx:106-123`; **extract it into a shared pure
  helper** `caregiverAlertConditions(state, pid, now)` that both this generator and the
  dashboard consume (the dashboard keeps rendering its `alerts: string[]`, now sourced
  from the helper — no behavior change there). `dedupeKey =
  caregiver:{kind}:{personId}:{YYYY-MM-DD}`. `severity: 'warn'`.

- **`dueCheckinNudge(state, now)`** — one gentle nudge to log, when there is no log for
  today **and** `now` is past a morning threshold (`CHECKIN_HOUR = 9`). Reads the
  last-checkin date from `useSessionStore` to avoid nagging after the morning
  experience already ran. `dedupeKey = checkin:{YYYY-MM-DD}`. `severity: 'info'`.

- **`occasionalAchievementReminder(state, now)`** — a warm, **rate-limited** (≤ 1 per
  day) celebratory nudge referencing earned achievements. Celebration only — no
  streak / consecutive-day logic (consistent with the existing `evaluateAchievements`
  design constraint). `dedupeKey = achievement:{YYYY-MM-DD}`. `severity: 'info'`.

- **`collectDueNotifications(state, now)`** — calls all five generators and returns the
  concatenated list. Pure. Dedup is **not** done here — it is the store's `push`
  contract — so `collect` can be called freely each tick.

Shared constants (`WINDOW_MIN`, `CHECKIN_HOUR`) live in
`src/lib/notifications/config.ts`.

### 3. Scheduler — `useNotificationScheduler()` hook (new), mounted once at app root

```ts
// pseudocode
useEffect(() => {
  const tick = () => {
    const now = new Date();
    const due = collectDueNotifications(useAppStore.getState(), now);
    for (const n of due) {
      const before = useNotificationStore.getState().notifications.length;
      useNotificationStore.getState().actions.push(n);     // dedupe inside
      const added = useNotificationStore.getState().notifications.length > before;
      if (!added) continue;
      if (n.kind === 'red_flag') markSafetyCardNotified(n.relatedId);
      if (Notification.permission === 'granted' && n.severity !== 'info') {
        new Notification(n.title, { body: n.body });
        useNotificationStore.getState().actions.markShown(n.id);
      }
    }
  };
  tick();                                  // catch-up on mount
  const id = setInterval(tick, 60_000);    // tick while open
  return () => clearInterval(id);
}, []);
```

- **Permission is requested lazily, only on a user gesture** (the toggle in the
  notification center, §4) via `Notification.requestPermission()` — never
  auto-prompted on load. Until granted, notifications still populate the in-app
  center; only the OS toast is withheld.
- Only `warn` / `urgent` severities raise an OS toast; `info` items live quietly in
  the center to avoid toast fatigue.
- `id` generation reuses the project `uid()` helper. Because generators are seeded
  with `now` and notifications are deduped by `dedupeKey` (not by `id`), a fresh `id`
  per tick is harmless — the store rejects the duplicate before `id` matters.

### 4. UI — notification center

A bell icon with an unread badge (`unreadCount`) and a dropdown/panel listing
notifications newest-first, each with a mark-read affordance and a dismiss control.
`urgent` items also surface as an inline banner at the top of the panel. Reuses
existing card/badge styling (mirrors `SafetyCard`). The panel header holds the single
**"Activar avisos"** permission toggle that triggers
`Notification.requestPermission()`.

Mounting: the bell goes in the app header; `useNotificationScheduler()` is called once
in the root layout component (alongside where global stores are first read).

### 5. `scheduleReminder` tool — replace the stub

`src/agent/tools/scheduleReminder.ts` keeps its input schema
(`{ medicationId, time }`) and result shape (`{ scheduled, medicationId, time }`) but
**persists** the time instead of no-op'ing: it adds `time` to the target medication's
`schedule[]` via `useAppStore.getState().actions.upsertMedication(...)`, **idempotent**
(no duplicate times; preserves existing schedule entries). `dueMedicationReminders`
then picks the new time up on the next tick. No new config field is introduced —
`Medication.schedule` already models HH:mm times.

The tool stays a thin store-mutating function consistent with the other client tools
in `clientToolRouter.ts`; the pure scheduling decision remains in the generators.

### 6. i18n

Warm Peruvian-Spanish copy for all five kinds, added under a `notifications` namespace
in `src/data/i18n/es.ts` (and `agent-es` where the agent voice applies), consistent
with Khumpi's existing tone. Title + body per kind; medication and caregiver strings
are parameterized (med name / dose / glucose value).

## Data flow (medication reminder, end to end)

```
Agent calls scheduleReminder({ medicationId, time })
  → upsertMedication adds time to med.schedule[]            (persisted)

…app open, scheduler tick (now):
  collectDueNotifications(state, now)
    → dueMedicationReminders: time is in window, dose not taken today
        → AppNotification{ kind:'medication', dedupeKey:'med:…:08:00', severity:'info' }
  → store.push(n)         (added: not seen before)
  → severity 'info' → no OS toast; appears in the bell with unread badge
User opens bell → markRead(n.id) → badge decrements
Next tick same minute → collect produces the same dedupeKey → push is a no-op
```

## Testing

Vitest unit tests in `tests/`, following the project's pure-function test style:

- **`dueMedicationReminders`** — in-window vs out-of-window `now`; dose already
  taken today is suppressed; multiple `schedule[]` times; correct `dedupeKey`.
- **`pendingRedFlagNotifications`** — `urgent`/`emergency` produce a notification;
  `ok`/`watch` do not; `dedupeKey` is per log.
- **`caregiverAlerts`** — `highToday` threshold (`≥180`, dated today), `stockLow`
  threshold; both/neither; shared helper matches the dashboard's prior result.
- **`dueCheckinNudge`** — produced only when no log today and past `CHECKIN_HOUR`;
  suppressed once last-checkin is today.
- **`occasionalAchievementReminder`** — at most one per day; none when no achievements.
- **Dedupe contract** — pushing the full `collectDueNotifications` output **twice**
  into a fresh store yields the same count the second time (zero added).
- **`scheduleReminder` persistence** — calling it adds `time` to `schedule[]`; calling
  it again with the same time does not duplicate; existing times are preserved.

The scheduler hook (effects, `setInterval`, `Notification` API) and the
NotificationCenter UI are verified by manual click-through, not unit tests.

## Out of scope / YAGNI

- **Web Push + service worker** and any closed-tab / cross-device delivery — the
  documented future upgrade path, not built now.
- Backend / Supabase Edge Function scheduling.
- A full notification-preferences screen — only the single permission toggle exists.
- Per-kind mute/snooze, notification history beyond the session cache, and
  cross-person notification routing beyond the existing `personId` attribution.
