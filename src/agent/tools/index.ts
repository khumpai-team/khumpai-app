/**
 * Tool handlers for the Khumpai agent.
 *
 * This is the PUBLIC BARREL for @/agent/tools.
 * Every symbol exported from here is callable by MockAgentProvider, the
 * Foundry/Azure provider, and any future agent runtime.
 *
 * SAFETY: Khumpi never diagnoses and never suggests doses.
 * `guardrailRedirect` and `evaluateRedFlag` encode those rules here
 * (and they also live in the system prompt).
 *
 * NOTE: This file is a barrel only — no logic lives here.
 * Implementations are in the individual modules below.
 */

// ---------------------------------------------------------------------------
// Budget guard
// ---------------------------------------------------------------------------

export const TOOL_BUDGET = {
  maxToolCallsPerTurn: 5,
  maxIterations: 3,
} as const;

// ---------------------------------------------------------------------------
// registerEntry (buildDraftEntries + DraftEntries)
// ---------------------------------------------------------------------------

export { buildDraftEntries } from './registerEntry';
export type { DraftEntries } from './registerEntry';

// ---------------------------------------------------------------------------
// evaluateRedFlag + evaluateGlucoseRedFlag
// ---------------------------------------------------------------------------

export { evaluateRedFlag, evaluateGlucoseRedFlag } from './evaluateRedFlag';

// ---------------------------------------------------------------------------
// guardrailRedirect
// ---------------------------------------------------------------------------

export { guardrailRedirect } from './guardrailRedirect';
export type { GuardrailReason, GuardrailResult } from './guardrailRedirect';

// ---------------------------------------------------------------------------
// confirmEntry
// ---------------------------------------------------------------------------

export { confirmEntry } from './confirmEntry';
export type { ConfirmEntryResult } from './confirmEntry';

// ---------------------------------------------------------------------------
// queryHistory
// ---------------------------------------------------------------------------

export { queryHistory } from './queryHistory';
export type { QueryHistoryOpts } from './queryHistory';

// ---------------------------------------------------------------------------
// getSummary
// ---------------------------------------------------------------------------

export { getSummary } from './getSummary';
export type { Summary, SummaryPeriod, GlucoseSummary } from './getSummary';

// ---------------------------------------------------------------------------
// detectPattern + runPatternDetection
// ---------------------------------------------------------------------------

export { detectPattern, runPatternDetection } from './detectPattern';

// ---------------------------------------------------------------------------
// anticipateRisk + anticipateRiskFromContext
// ---------------------------------------------------------------------------

export { anticipateRisk, anticipateRiskFromContext } from './anticipateRisk';

// ---------------------------------------------------------------------------
// logMedication
// ---------------------------------------------------------------------------

export { logMedication } from './logMedication';
export type { LogMedicationInput, LogMedicationResult } from './logMedication';

// ---------------------------------------------------------------------------
// upsertMedication
// ---------------------------------------------------------------------------

export { upsertMedication } from './upsertMedication';

// ---------------------------------------------------------------------------
// scheduleReminder
// ---------------------------------------------------------------------------

export { scheduleReminder } from './scheduleReminder';
export type { ScheduleReminderInput, ScheduleReminderResult } from './scheduleReminder';

// ---------------------------------------------------------------------------
// addDoctorNote
// ---------------------------------------------------------------------------

export { addDoctorNote } from './addDoctorNote';
export type { AddDoctorNoteInput } from './addDoctorNote';

// ---------------------------------------------------------------------------
// getDoctorNotes
// ---------------------------------------------------------------------------

export { getDoctorNotes } from './getDoctorNotes';
export type { GetDoctorNotesOpts } from './getDoctorNotes';

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------

export { generateReport } from './generateReport';
export type { DoctorReport } from './generateReport';

// ---------------------------------------------------------------------------
// queryRag
// ---------------------------------------------------------------------------

export { queryRag } from './queryRag';
export type { RagResult } from './queryRag';
