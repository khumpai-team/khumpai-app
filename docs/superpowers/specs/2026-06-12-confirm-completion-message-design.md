# Friendly completion message after a confirmed validation

**Date:** 2026-06-12
**Status:** Approved (pending spec review)

## Problem

When Khumpi proposes a structured health entry, the UI shows a `ConfirmationCard`
(the "human validation"). On confirm, the agent should always send a warm message
saying the action completed successfully ("Anotado tu descanso…", a range-aware
glucose line, etc.).

This works on two of the three confirm paths but **not** the real-agent path:

| Path | Where | On confirm | Friendly message? |
|------|-------|-----------|-------------------|
| Local cards (caregiver, photo attachments) | `useChat.confirmCard` → stored `localAck` | streams stored ack | ✅ always |
| Mock provider | `MockAgentProvider.provideToolResult` | streams stored `ack` | ✅ always |
| **Foundry (real Azure) provider** | `FoundryAgentProvider.provideToolResult` | resumes `runTurnLoop`, depends on the model emitting text | ❌ **not guaranteed** |

In the Foundry path the model already produced a warm `ack` string when it called
`registerEntry` (see `RegisterEntryArgs.ack`), but on confirm that string is unused —
the code resumes the model turn and relies on the model to speak again. If the model
emits another tool call, empty text, or the request fails, **no completion message
appears**.

## Goal

Guarantee that confirming an agent-proposed entry always streams a friendly
"completed successfully" message — without losing the model's ability to react to
values the user edited inline before confirming.

## Approach (decided)

1. **Model round-trip + deterministic fallback.** Keep resuming the model so it can
   react to the final/edited values; if the resumed turn yields no text, stream a
   deterministic fallback.
2. **Recompute the fallback from saved values.** Build the fallback message from the
   actually-saved entries (`ToolResult.savedEntries`, which reflects inline edits),
   using a shared ack helper — so the fallback is warm *and* value-accurate.

## Components

### 1. New shared module — `src/agent/ack.ts`

The "warm acknowledgement for a confirmed entry" logic is currently duplicated
almost verbatim:

- `useChat.ts:40-67` — `glucoseMsg` + `localAck(draft)`
- `MockAgentProvider.ts:30-59` — `glucoseMessage` + `ackFor(draft)`

Consolidate into one module:

```ts
// src/agent/ack.ts
import type { LogEntry } from '@/types';

/** Range-aware acknowledgement for a glucose value. */
export function glucoseMessage(v: number): string;

/**
 * Warm Peruvian-Spanish acknowledgement for a confirmed entry.
 * Accepts loose (primary, secondary?) so it serves both DraftEntries
 * (draft.primary/draft.secondary) and savedEntries ([0]/[1]).
 */
export function ackForEntries(primary: LogEntry, secondary?: LogEntry): string;
```

Behavior preserved from the existing impls:
- `glucose` → `glucoseMessage(value)` (`<70` low, `<180` ok, `<250` high, else veryHigh)
- `meal` → if paired glucose, the glucose message; else `confirmations.savedMeal`
- `sleep` → `<6h` → `offline.sleepShort(hours)`; else `confirmations.savedSleep`
- `medication` → `confirmations.savedMedication`
- `symptom` → `evaluateRedFlag(description).message`
- default → **`confirmations.savedLong`** ("Listo, lo guardé.")

> Decision: the two existing defaults differ (`useChat` used `confirmations.saved`,
> Mock used `confirmations.savedLong`). Standardize the spoken default on
> `savedLong`. `confirmations.saved` was the shorter "✓ Guardado"-style string and
> is not the right default for a spoken line.

Then make the existing consumers thin adapters (no behavior change):
- `useChat.localAck(draft)` → `ackForEntries(draft.primary, draft.secondary)`
- `MockAgentProvider.ackFor(draft)` → `ackForEntries(draft.primary, draft.secondary)`

### 2. Foundry fallback — `FoundryAgentProvider.provideToolResult`

Iterate `runTurnLoop` manually, track whether any text was emitted, hold back the
loop's terminal `done`, and stream a recomputed fallback when the confirmed turn
produced no text.

```ts
let sawText = false;
for await (const ev of this.runTurnLoop(messages)) {
  if (ev.type === 'done') break;                       // hold the terminal done
  if (ev.type === 'text_start' || ev.type === 'text_delta') sawText = true;
  yield ev;
}
if (result.ok && !sawText) {
  const [primary, secondary] = result.savedEntries ?? [];
  yield* this.streamText(
    primary ? ackForEntries(primary, secondary) : AGENT_ES.confirmations.savedLong,
  );
}
yield { type: 'done' };
```

Notes:
- `runTurnLoop` yields exactly one terminal `done` on every return path, so breaking
  on it is safe and the fallback is injected before our own single `done`.
- Add a small local `streamText(text)` async generator to the Foundry provider
  (mirroring `MockAgentProvider.streamText`): yields `text_start` → word-by-word
  `text_delta` → `text_end` with a new `messageId`.
- Scope is the **confirmed** (`ok: true`) case, as requested. The decline
  (`ok: false`) path already streams a decline line via the resumed model and is out
  of scope here.

### 3. Unchanged

- `AgentProvider` interface — no change. `ToolResult.savedEntries` already carries the
  post-edit entries.
- `useChat.confirmCard` — no change. It already passes `savedEntries` into
  `provideToolResult` and handles the local-card path itself.
- `ConfirmationCard` — no change.

## Data flow (confirmed agent card)

```
User confirms ConfirmationCard
  → useChat.confirmCard(callId, savedEntries)
      → setCardState(saved); addLog(...)
      → agent.provideToolResult({ callId, name:'registerEntry', ok:true, savedEntries })
          → push tool result, resume runTurnLoop
              → model speaks  → text streamed  → sawText = true  → (no fallback)
              → model silent  → sawText = false → streamText(ackForEntries(savedEntries…))
      → celebrate()
```

## Testing

- **Unit — `ackForEntries`** (pure, in `tests/`): range-aware glucose (low/ok/high/
  veryHigh), meal+glucose pairing, short-sleep vs normal-sleep, medication, red-flag
  symptom, and the default fallback line.
- **Foundry fallback** : mock `fetch` to return an SSE stream that ends in `done`
  with no `text` events; call `provideToolResult({ ok:true, savedEntries:[entry] })`;
  assert the yielded stream contains a `text_*` sequence whose text equals
  `ackForEntries(entry)`. A second case with text in the SSE stream asserts **no**
  fallback is appended.

## Out of scope / YAGNI

- Decline (`ok: false`) fallback symmetry.
- Regenerating the `ack` shown by local/Mock paths on inline edit (pre-existing
  staleness, unrelated to this change).
- Any `ConfirmationCard` or interface changes.
