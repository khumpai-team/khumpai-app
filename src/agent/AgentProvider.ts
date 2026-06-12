/**
 * AgentProvider — the single seam between the UI and whatever is "thinking".
 *
 * Today this is backed by {@link MockAgentProvider} (scripted, regex-driven).
 * Tomorrow it will be backed by a FoundryAgentProvider (Azure AI Foundry)
 * WITHOUT any UI change. To make that swap painless, the interface is designed
 * from day one around two realities of real LLM agents:
 *
 *   1. Responses STREAM (token deltas), they don't arrive whole.
 *   2. The agent calls TOOLS — and some tools (like registering a health entry)
 *      require the human to confirm before they take effect.
 *
 * The UI consumes an async stream of {@link AgentEvent}s. When the agent wants
 * to do something that needs confirmation, it emits a `tool_call`; the UI runs
 * the client-side tool (e.g. shows a ConfirmationCard), then resumes the turn
 * via {@link AgentProvider.provideToolResult} with the outcome.
 */

import type { LogEntry } from '@/types';

export type ChatRole = 'user' | 'khumpi';

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface AgentInput {
  text: string;
  /** Prior turns, oldest first. Lets a real model keep context. */
  history: ChatTurn[];
}

// --- Tools ----------------------------------------------------------------

/** Names of tools the agent may call. Mirrors `src/agent/tools`. */
export type ToolName =
  | 'registerEntry' // propose a health entry for the user to confirm
  | 'detectPattern' // surface a correlation/insight
  | 'evaluateRedFlag' // assess a symptom for urgency
  | 'guardrailRedirect' // refuse diagnosis/dose, redirect to doctor
  | 'anticipateRisk'; // proactively warn about a likely upcoming spike

/** A proposed entry awaiting human confirmation. */
export interface RegisterEntryArgs {
  /** The draft entry (confirmed=false until the user accepts & it is saved). */
  entry: LogEntry;
  /** A second entry volunteered together (e.g. meal + glucose). */
  secondaryEntry?: LogEntry;
  /** Warm acknowledgement to stream AFTER the user confirms. */
  ack: string;
}

export interface GuardrailArgs {
  reason: 'dose' | 'diagnosis' | 'stop' | 'injection';
  message: string;
}

export interface RedFlagArgs {
  severity: 'mild' | 'watch' | 'red_flag';
  message: string;
}

export interface DetectPatternArgs {
  insightId: string;
}

export interface AnticipateRiskArgs {
  message: string;
}

export type ToolArgsByName = {
  registerEntry: RegisterEntryArgs;
  detectPattern: DetectPatternArgs;
  evaluateRedFlag: RedFlagArgs;
  guardrailRedirect: GuardrailArgs;
  anticipateRisk: AnticipateRiskArgs;
};

/** Discriminated union: matching on `name` narrows `args` to the right shape. */
export type ToolCall = {
  [N in ToolName]: { id: string; name: N; args: ToolArgsByName[N] };
}[ToolName];

/** Outcome of a client-side tool the UI ran (e.g. the confirmation card). */
export interface ToolResult {
  callId: string;
  name: ToolName;
  /** True if the user confirmed/accepted. */
  ok: boolean;
  /** Entries actually saved, if any (after possible edits). */
  savedEntries?: LogEntry[];
}

// --- Stream events --------------------------------------------------------

export type AgentEvent =
  | { type: 'text_start'; messageId: string }
  | { type: 'text_delta'; messageId: string; delta: string }
  | { type: 'text_end'; messageId: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'done' };

// --- The interface --------------------------------------------------------

export interface AgentProvider {
  /** Stable id, e.g. "mock" or "foundry". */
  readonly id: string;

  /** Begin a turn in response to a user message. */
  sendMessage(input: AgentInput): AsyncIterable<AgentEvent>;

  /**
   * Resume a turn after a client-side tool resolved (e.g. the user confirmed
   * or edited a ConfirmationCard). Yields any follow-up text/tool events.
   */
  provideToolResult(result: ToolResult): AsyncIterable<AgentEvent>;
}
