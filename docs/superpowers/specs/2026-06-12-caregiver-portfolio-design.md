# Caregiver Portfolio & Cross-Patient Monitoring — Design

**Date:** 2026-06-12
**Status:** Approved, implementing
**Front affected:** Caregiver only (`AppState.mode === 'caregiver'`)

## Problem

The caregiver front (`CaregiverDashboard`) monitors exactly **one** patient at a
time (`currentPersonId`) via an avatar switcher. There is no "all my patients at
a glance" view, and the notification engine (`caregiverAlerts`) only fires for
the currently-selected patient — so a carer watching one person is blind to a
high reading or a missed pill for another. A carer needs:

1. **Complete monitoring** — see every patient's status at once.
2. **Alerts on bad actions / forgotten pills** — across *all* patients, not just
   the selected one.
3. **Access to each patient's medical reports** — journal + report per patient.

## Approach

Split the single caregiver screen into a **portfolio** (all patients) and a
**detail** (one patient), and lift alert evaluation from "current patient" to
"every patient" through one shared status helper.

### 1. Screen split

- **`CaregiverPortfolio`** (new) — the caregiver **Inicio**. A warm, scannable
  card per patient. Replaces `CaregiverDashboard` as the landing view in
  `HomeScreen` when `mode === 'caregiver'`.
- **`CaregiverDashboard`** (existing, refactored) — the **per-patient detail**,
  reached by tapping a portfolio card. Tapping sets `currentPersonId`, so its
  existing "Ver diario / Ver reporte / Escribir a Khumpi" buttons already scope
  to that patient (Report & Journal filter by `currentPersonId`). The avatar
  switcher is removed from the detail (the portfolio supersedes it); the detail
  gains a back-to-portfolio affordance.

Navigation stays inside the existing `/home` route — `HomeScreen` renders the
portfolio, and the portfolio drills into the detail via local view state
(`selectedView`) so no new route or nav tab is added. Back returns to the
portfolio.

### 2. Portfolio screen

Header: warm count ("Tus N personas 💙") + gear + add-patient (reuse existing
add-patient logic from the current dashboard).

Per patient, a **card** (not a row):
- Avatar + name + relation label ("Tu papá" / "Tu mamá" / "Tú").
- **Status chip** with traffic-light semantics derived from the patient's worst
  active alert:
  - 💙 *Todo tranquilo* — calm (no alerts)
  - 🟡 *Necesita atención* — warn (high glucose / forgot pill / low stock)
  - 🔴 *Revisar ahora* — urgent (red-flag symptom)
- Two mini-vitals: última azúcar (mg/dL), % pastillas (adherence).
- Alert badges, shown only when active: azúcar alta, pastilla olvidada, stock
  bajo, síntoma de alerta.
- Tap → sets `currentPersonId`, opens detail.

When every patient is calm, a reassuring all-calm note appears.

### 3. Cross-patient alert engine

New shared helper in `src/lib/notifications/caregiver.ts`:

```ts
type CaregiverSeverity = 'calm' | 'warn' | 'urgent';
interface CaregiverPatientStatus {
  severity: CaregiverSeverity;
  alerts: { kind: 'high' | 'forgotPill' | 'stock' | 'redFlag'; text: string }[];
}
function caregiverPatientStatus(
  state: AppState, personId: string, now: Date, ctx: NotificationContext,
): CaregiverPatientStatus
```

Conditions (reuse existing logic where it exists):
- **High glucose today** (≥180) — reuse `caregiverAlertConditions`.
- **Low stock** — reuse `caregiverAlertConditions`.
- **Forgot pills** — a dose scheduled *earlier today* (scheduled time already
  passed) not marked taken. Adapt the due/taken check from
  `medication.ts:dueMedicationReminders` into a small reusable predicate so the
  "missed" definition stays consistent.
- **Red-flag symptom** — run `evaluateRedFlag` over the patient's recent symptom
  logs; `urgent`/`emergency` → `redFlag` alert and bumps severity to `urgent`.

Severity precedence: `redFlag` ⇒ urgent; any of high/forgotPill/stock ⇒ warn;
else calm.

Consumers:
- **`CaregiverPortfolio`** — calls the helper per patient for chip color +
  badges.
- **`CaregiverDashboard`** (detail) — uses the same helper for its alert banner
  (single source of truth; banner and portfolio can't disagree).
- **`caregiverAlerts`** (notification generator) — change from
  `currentPersonId` only to **iterating every person**, emitting per-patient
  notifications. Dedupe keys already include `personId`, so per-patient dedupe
  works unchanged. Add a `forgotPill` notification body.

### 4. Seed a second patient

Add one more caregiver patient (a parent) with a modest log/medication history
that yields a *different* status than Carlos (e.g. a missed pill + a borderline
reading) so the portfolio demonstrably shows two cards in two states. Seeded
into `SEED_STATE.persons` + corresponding `logs`/`medications`, present
regardless of front (caregiver mode simply renders the portfolio over them).
Carlos keeps id `carlos` (onboarding caregiver path relabels him and the
dashboard stays data-rich).

## Out of scope / YAGNI

- No new route or bottom-nav tab (drill-down is local view state).
- No editing patient details beyond the existing add-patient name flow.
- No changes to the patient (non-caregiver) front.
- No new report visualizations — reuse existing Report/Journal screens.

## i18n

New strings under `es.caregiver.*` (portfolio header/count, relation labels,
status chip labels, badge labels, forgot-pill alert) and a `forgotPill`
notification body. All Spanish, matching existing warm tone.

## Testing

- Unit-test `caregiverPatientStatus` severity precedence and each condition
  (calm / high / forgotPill / stock / redFlag) with crafted state.
- Unit-test that `caregiverAlerts` now emits for multiple persons.
- Strict build + full existing test suite must stay green.
- No browser automation available — interactive drill-down verified via build +
  dev-server transform + type-check (consistent with prior caregiver work).
