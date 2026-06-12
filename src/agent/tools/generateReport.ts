/**
 * generateReport — pure assembly of a DoctorReport from AppState.
 *
 * Honest: includes confidence labels on pattern insights and a disclaimer that
 * the report supports but does not replace physician evaluation.
 */

import type { AppState, DoctorNote, Insight } from '@/types';
import { getSummary, type GlucoseSummary } from './getSummary';
import { runPatternDetection } from './detectPattern';
import { getDoctorNotes } from './getDoctorNotes';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DoctorReport {
  generatedAt: string;
  personId: string;
  period: 'month';
  glucose: GlucoseSummary;
  adherencePct: number | null;
  /** Detected patterns with honesty labels (confidence). */
  patterns: Insight[];
  /** Doctor notes flagged as questions to ask the doctor. */
  doctorQuestions: DoctorNote[];
  /**
   * Plain-Spanish disclaimer reminding the patient and doctor that this report
   * is a support tool, not a clinical evaluation.
   */
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble a DoctorReport from the current application state.
 * Pure: reads state but makes no mutations.
 */
export function generateReport(state: AppState): DoctorReport {
  const personLogs = state.logs.filter(
    (l) => l.personId === state.currentPersonId,
  );

  const personMeds = state.medications.filter(
    (m) => m.personId === state.currentPersonId,
  );

  const summary = getSummary(personLogs, 'month', personMeds);

  // Detect patterns — only include if there is sufficient data (non-null).
  const detectedInsight = runPatternDetection(personLogs, state.currentPersonId);
  const patterns: Insight[] = detectedInsight ? [detectedInsight] : [];

  // Doctor questions from the note store.
  const personNotes = state.doctorNotes.filter(
    (n) => n.personId === state.currentPersonId,
  );
  const doctorQuestions = getDoctorNotes(personNotes, { forQuestion: true });

  return {
    generatedAt: new Date().toISOString(),
    personId: state.currentPersonId,
    period: 'month',
    glucose: summary.glucose,
    adherencePct: summary.adherencePct,
    patterns,
    doctorQuestions,
    disclaimer:
      'Este resumen es un apoyo, no reemplaza la evaluación de tu médico. Por favor compártelo con tu doctor en tu próxima cita.',
  };
}
