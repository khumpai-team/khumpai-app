/**
 * clientToolRouter.ts — executes a model tool call against the browser store.
 *
 * The model sends a tool name + JSON args; this module maps them to the
 * corresponding tool implementation and returns the result.  All tool
 * implementations read/write the Zustand store via useAppStore.getState().
 *
 * Browser-only — never import this from server code.
 */

import {
  queryHistory,
  getSummary,
  detectPattern,
  runPatternDetection,
  evaluateRedFlag,
  guardrailRedirect,
  queryRag,
  confirmEntry,
  logMedication,
  upsertMedication,
  addDoctorNote,
  getDoctorNotes,
  generateReport,
  anticipateRiskFromContext,
  scheduleReminder,
} from '@/agent/tools';
import { useAppStore } from '@/store/appStore';
import type { SummaryPeriod } from '@/agent/tools';
import type { GuardrailReason } from '@/agent/tools';

/**
 * Execute one tool call by name, mapping model arg names to our function
 * signatures.  Returns the raw result as an unknown value (caller serialises
 * it to JSON for the tool-result message).
 *
 * @param name - Tool name as sent by the model (matches FOUNDRY_TOOL_DEFINITIONS).
 * @param args - Parsed JSON object from the model's tool call arguments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON arg boundary: model sends untyped JSON
export async function runClientTool(name: string, args: Record<string, any>): Promise<unknown> {
  const state = useAppStore.getState();

  switch (name) {
    case 'queryHistory': {
      return queryHistory(state.logs, {
        // The model may send `type` and `daysBack` as per FOUNDRY_TOOL_DEFINITIONS
        type: args['type'] as Parameters<typeof queryHistory>[1]['type'],
        daysBack: typeof args['daysBack'] === 'number' ? args['daysBack'] : undefined,
        personId: state.currentPersonId,
      });
    }

    case 'getSummary': {
      const period = (args['period'] ?? 'week') as SummaryPeriod;
      return getSummary(state.logs, period, state.medications);
    }

    case 'detectPattern': {
      // Try the precomputed insight store first; fall back to live detection.
      const insightId = String(args['insightId'] ?? '');
      const precomputed = detectPattern(insightId);
      if (precomputed) return precomputed;
      return runPatternDetection(state.logs, state.currentPersonId);
    }

    case 'evaluateRedFlag': {
      const description = String(args['description'] ?? '');
      return evaluateRedFlag(description);
    }

    case 'guardrailRedirect': {
      const reason = (args['reason'] ?? 'diagnosis') as GuardrailReason;
      return guardrailRedirect(reason, state.currentPersonId);
    }

    case 'queryRag': {
      const question = String(args['question'] ?? '');
      return queryRag(question);
    }

    case 'confirmEntry': {
      const entryId = String(args['entryId'] ?? '');
      return confirmEntry(entryId);
    }

    case 'logMedication': {
      // The model sends `takenAt` (ISO datetime); map to our schema's `date`/`taken`.
      const takenAt: string = args['takenAt'] ?? new Date().toISOString();
      const date = takenAt.slice(0, 10); // YYYY-MM-DD
      return logMedication({
        medicationId: String(args['medicationId'] ?? ''),
        taken: true,
        date,
      });
    }

    case 'upsertMedication': {
      // The model may send a partial medication; fill required fields with
      // reasonable defaults so the store's Zod schema doesn't reject it.
      const freshId = `med-${Date.now()}`;
      return upsertMedication({
        id: String(args['id'] ?? freshId),
        personId: state.currentPersonId,
        name: String(args['name'] ?? ''),
        dose: String(args['dose'] ?? ''),
        frequency: String(args['frequency'] ?? args['schedule'] ?? ''),
        schedule: [],
        adherenceLog: [],
      });
    }

    case 'addDoctorNote': {
      return addDoctorNote({
        personId: state.currentPersonId,
        text: String(args['content'] ?? args['text'] ?? ''),
        source: 'khumpi',
        forQuestion: Boolean(args['forQuestion'] ?? false),
      });
    }

    case 'getDoctorNotes': {
      return getDoctorNotes(state.doctorNotes, {
        personId: state.currentPersonId,
      });
    }

    case 'generateReport': {
      return generateReport(state);
    }

    case 'anticipateRisk': {
      // The model may call anticipateRisk with a `message` arg (passthrough) OR
      // we can use the context-aware variant.  Prefer context-aware when state
      // is available, fall back to the model's message.
      const fromCtx = anticipateRiskFromContext(state);
      if (fromCtx) return fromCtx;
      return { message: String(args['message'] ?? '') };
    }

    case 'scheduleReminder': {
      return scheduleReminder({
        medicationId: String(args['medicationId'] ?? ''),
        time: String(args['time'] ?? '08:00'),
      });
    }

    default: {
      return { error: 'unknown tool' };
    }
  }
}
