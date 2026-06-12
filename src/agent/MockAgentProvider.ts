/**
 * MockAgentProvider — scripted stand-in for the real Foundry agent.
 *
 * It parses the user's Spanish message, decides which tool(s) to "call", and
 * streams Khumpi's reply word-by-word so the UI behaves exactly as it will with
 * a real streaming model. Health-safety logic is delegated to `agent/tools`;
 * all reply text comes from `AGENT_ES`.
 */

import { AGENT_ES } from '@/data/i18n/agent-es';
import { SEED_STATE } from '@/data/seed';
import { uid } from '@/lib/id';
import type {
  AgentEvent,
  AgentInput,
  AgentProvider,
  RegisterEntryArgs,
  ToolResult,
} from '@/agent/AgentProvider';
import { parseMessage } from '@/agent/parse';
import { buildDraftEntries, evaluateRedFlag, guardrailRedirect, type DraftEntries } from '@/agent/tools';
import type { LogEntry } from '@/types';

const THINK_MS = 650;
const WORD_MS = 28;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Range-aware message for a glucose value. */
function glucoseMessage(v: number): string {
  if (v < 70) return AGENT_ES.glucose.low(v);
  if (v < 180) return AGENT_ES.glucose.ok(v);
  if (v < 250) return AGENT_ES.glucose.high(v);
  return AGENT_ES.glucose.veryHigh(v);
}

/** Pick the right warm acknowledgement for a confirmed draft. */
function ackFor(draft: DraftEntries): string {
  const e = draft.primary;
  switch (e.type) {
    case 'glucose':
      return glucoseMessage(e.payload.value);
    case 'meal': {
      const sec = draft.secondary;
      if (sec && sec.type === 'glucose') return glucoseMessage(sec.payload.value);
      return AGENT_ES.confirmations.savedMeal;
    }
    case 'sleep':
      return e.payload.hours < 6
        ? AGENT_ES.offline.sleepShort(e.payload.hours)
        : AGENT_ES.confirmations.savedSleep;
    case 'medication':
      return AGENT_ES.confirmations.savedMedication;
    case 'symptom':
      return evaluateRedFlag(e.payload.description).message;
    default:
      return AGENT_ES.confirmations.savedLong;
  }
}

export class MockAgentProvider implements AgentProvider {
  readonly id = 'mock';

  /** Drafts awaiting confirmation, keyed by tool-call id. */
  private pending = new Map<string, { draft: DraftEntries; ack: string }>();

  async *sendMessage(input: AgentInput): AsyncIterable<AgentEvent> {
    const intent = parseMessage(input.text);
    await sleep(THINK_MS);

    if (
      intent.kind === 'meal' ||
      intent.kind === 'glucose' ||
      intent.kind === 'sleep' ||
      intent.kind === 'medication' ||
      intent.kind === 'symptom'
    ) {
      const draft = buildDraftEntries(intent, SEED_STATE.currentPersonId);

      // If the parsed intent carries a retroactive timestamp, override the
      // "now" stamp that buildDraftEntries stamped onto the draft entries.
      if (intent.retroTimestamp) {
        (draft.primary as LogEntry).timestamp = intent.retroTimestamp;
        if (draft.secondary) {
          (draft.secondary as LogEntry).timestamp = intent.retroTimestamp;
        }
      }

      const ack = ackFor(draft);
      const callId = uid('call');
      this.pending.set(callId, { draft, ack });

      const args: RegisterEntryArgs = {
        entry: draft.primary,
        secondaryEntry: draft.secondary,
        ack,
      };
      yield { type: 'tool_call', call: { id: callId, name: 'registerEntry', args } };
      yield { type: 'done' };
      return;
    }

    if (intent.kind === 'guardrail') {
      // 'injection' is handled locally to avoid depending on the tools agent's
      // version of guardrailRedirect, which is being widened in a parallel edit.
      // Once that agent lands, this can be collapsed to a single guardrailRedirect call.
      const message =
        intent.reason === 'injection'
          ? AGENT_ES.guardrails.promptInjection
          : guardrailRedirect(intent.reason).message;
      yield* this.streamText(message);
      yield { type: 'done' };
      return;
    }

    yield* this.streamText(AGENT_ES.fallbacks.unclear);
    yield { type: 'done' };
  }

  async *provideToolResult(result: ToolResult): AsyncIterable<AgentEvent> {
    const entry = this.pending.get(result.callId);
    this.pending.delete(result.callId);

    if (!result.ok) {
      yield* this.streamText('Sin problema, lo dejamos así. Aquí estoy cuando quieras. 🙂');
      yield { type: 'done' };
      return;
    }

    await sleep(280);
    yield* this.streamText(entry?.ack ?? AGENT_ES.confirmations.saved);
    yield { type: 'done' };
  }

  /** Emit text as a start / deltas / end sequence, word by word. */
  private async *streamText(text: string): AsyncIterable<AgentEvent> {
    const messageId = uid('msg');
    yield { type: 'text_start', messageId };
    const words = text.split(/(\s+)/);
    for (const w of words) {
      yield { type: 'text_delta', messageId, delta: w };
      if (w.trim()) await sleep(WORD_MS);
    }
    yield { type: 'text_end', messageId };
  }
}
