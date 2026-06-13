/**
 * FoundryAgentProvider.ts — browser orchestrator backed by the Vite dev-server
 * proxy at /api/foundry/chat.
 *
 * Architecture:
 *   Browser → POST /api/foundry/chat (SSE) → Vite middleware → Azure AI Foundry
 *
 * The browser bundle never imports the Azure SDK.  All tool calls execute
 * client-side (Zustand store) via clientToolRouter.
 *
 * Implements AgentProvider (src/agent/AgentProvider.ts).
 */

import { uid } from '@/lib/id';
import type {
  AgentEvent,
  AgentInput,
  AgentProvider,
  RegisterEntryArgs,
  ToolResult,
} from '@/agent/AgentProvider';
import { TOOL_BUDGET } from '@/agent/tools';
import { runClientTool } from '@/agent/clientToolRouter';
import { ackForEntries } from '@/agent/ack';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { useAppStore } from '@/store/appStore';
import type { LogEntry } from '@/types';

// Re-export for backward compatibility with any code that imported these from
// FoundryAgentProvider directly.
export { KHUMPI_SYSTEM_PROMPT, FOUNDRY_TOOL_DEFINITIONS } from './foundryConfig';

// ---------------------------------------------------------------------------
// Local OpenAI-format message type
// ---------------------------------------------------------------------------

interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Plain text for most messages; an array of content parts for vision messages. */
  content: string | unknown[] | null;
  /** Present on assistant messages that invoked tools. */
  tool_calls?: OAIToolCall[];
  /** Present on tool-result messages. */
  tool_call_id?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// SSE event shapes coming from the proxy
// ---------------------------------------------------------------------------

interface SSEText    { type: 'text';       delta: string }
interface SSEToolCalls {
  type: 'tool_calls';
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}
interface SSEError   { type: 'error';      message: string }
interface SSEDone    { type: 'done' }

type SSEEvent = SSEText | SSEToolCalls | SSEError | SSEDone;

// ---------------------------------------------------------------------------
// History mapping
// ---------------------------------------------------------------------------

function mapHistory(history: AgentInput['history']): OAIMessage[] {
  return history.map((turn) => ({
    role: turn.role === 'user' ? 'user' : 'assistant',
    content: turn.text,
  }));
}

// ---------------------------------------------------------------------------
// FoundryAgentProvider
// ---------------------------------------------------------------------------

export class FoundryAgentProvider implements AgentProvider {
  readonly id = 'foundry';

  /**
   * Holds the full messages array for a turn that is paused waiting for the
   * user to confirm/reject a registerEntry card.  Keyed by the registerEntry
   * tool call id.
   */
  private pending = new Map<string, OAIMessage[]>();

  // -------------------------------------------------------------------------
  // streamTurn — POST to proxy, parse SSE, yield AgentEvents
  // -------------------------------------------------------------------------

  /**
   * Stream one model turn.  Yields AgentEvents for text deltas.
   * Fills `collectedToolCalls` (passed by ref) with any tool calls from this
   * turn (available only after the generator is fully consumed).
   */
  private async *streamTurn(
    messages: OAIMessage[],
    collectedToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
  ): AsyncGenerator<AgentEvent> {
    const messageId = uid('msg');
    let textStarted = false;

    let response: Response;
    try {
      response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
    } catch (err) {
      // Network-level failure
      yield { type: 'text_start', messageId };
      yield {
        type: 'text_delta',
        messageId,
        delta: `Error conectando con Khumpi: ${String(err)}`,
      };
      yield { type: 'text_end', messageId };
      return;
    }

    if (!response.body) {
      yield { type: 'text_start', messageId };
      yield { type: 'text_delta', messageId, delta: 'Error: respuesta vacía del servidor.' };
      yield { type: 'text_end', messageId };
      return;
    }

    // Parse SSE stream line by line
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.slice('data:'.length).trim();
        if (!jsonStr) continue;

        let event: SSEEvent;
        try {
          event = JSON.parse(jsonStr) as SSEEvent;
        } catch {
          continue;
        }

        if (event.type === 'text') {
          if (!textStarted) {
            yield { type: 'text_start', messageId };
            textStarted = true;
          }
          yield { type: 'text_delta', messageId, delta: event.delta };
        } else if (event.type === 'tool_calls') {
          for (const tc of event.toolCalls) {
            collectedToolCalls.push(tc);
          }
        } else if (event.type === 'error') {
          if (!textStarted) {
            yield { type: 'text_start', messageId };
            textStarted = true;
          }
          yield {
            type: 'text_delta',
            messageId,
            delta: `⚠️ ${event.message}`,
          };
        } else if (event.type === 'done') {
          break outer;
        }
      }
    }

    if (textStarted) {
      yield { type: 'text_end', messageId };
    }
  }

  // -------------------------------------------------------------------------
  // runTurnLoop — bounded multi-turn loop
  // -------------------------------------------------------------------------

  /**
   * Execute up to TOOL_BUDGET.maxIterations model turns, handling tool calls
   * in between.  Yields AgentEvents.
   *
   * Returns early (via generator `return`) when:
   *   - The model emits no tool calls (conversation turn done).
   *   - A `registerEntry` call is found (pause for confirmation card).
   *   - The iteration budget is exhausted.
   */
  private async *runTurnLoop(
    messages: OAIMessage[],
  ): AsyncGenerator<AgentEvent> {
    for (let iter = 0; iter < TOOL_BUDGET.maxIterations; iter++) {
      const toolCalls: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
      }> = [];

      // Stream one model turn, yielding text events live
      yield* this.streamTurn(messages, toolCalls);

      // No tool calls → conversation turn is complete
      if (toolCalls.length === 0) {
        yield { type: 'done' };
        return;
      }

      // Push the assistant message with the full tool_calls list
      const assistantMsg: OAIMessage = {
        role: 'assistant',
        content: null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
      messages.push(assistantMsg);

      // Split tool calls into server-side (non-registerEntry) and registerEntry
      const registerEntryCall = toolCalls.find((tc) => tc.name === 'registerEntry');
      const serverToolCalls = toolCalls.filter((tc) => tc.name !== 'registerEntry');

      // FIRST PASS: execute all non-registerEntry tools
      for (const tc of serverToolCalls) {
        let result: unknown;
        try {
          result = await runClientTool(tc.name, tc.arguments);
        } catch (err) {
          result = { error: String(err) };
        }
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      // SECOND PASS: handle registerEntry if present
      if (registerEntryCall) {
        // Normalise the draft entry from the model's args
        const rawArgs = registerEntryCall.arguments;
        const now = new Date().toISOString();
        const currentPersonId = useAppStore.getState().currentPersonId;

        const normaliseEntry = (raw: Record<string, unknown>): LogEntry => {
          // Spread raw first so our explicit fields take precedence.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spreading model JSON, typed via cast below
          return {
            ...(raw as any),
            id: uid('log'),
            personId: currentPersonId,
            createdAt: now,
            // Clamp an obviously-wrong timestamp (e.g. a hallucinated past year) to now.
            timestamp:
              typeof raw['timestamp'] === 'string' &&
              new Date(raw['timestamp'] as string).getFullYear() === new Date(now).getFullYear()
                ? (raw['timestamp'] as string)
                : now,
            source: 'conversation' as const,
            confirmed: false,
            isOfflineCapture: false,
          } as LogEntry;
        };

        const entryRaw = (rawArgs['entry'] ?? {}) as Record<string, unknown>;
        const secondaryRaw = rawArgs['secondaryEntry'] as Record<string, unknown> | undefined;

        const registerArgs: RegisterEntryArgs = {
          entry: normaliseEntry(entryRaw),
          secondaryEntry: secondaryRaw ? normaliseEntry(secondaryRaw) : undefined,
          ack: (rawArgs['ack'] as string | undefined) ?? '',
        };

        // Persist the messages array for the continuation
        this.pending.set(registerEntryCall.id, [...messages]);

        yield {
          type: 'tool_call',
          call: {
            id: registerEntryCall.id,
            name: 'registerEntry',
            args: registerArgs,
          },
        };
        yield { type: 'done' };
        return; // Pause here — provideToolResult will resume
      }

      // If only server-side tools ran, loop to get the model's next turn
    }

    // Budget exhausted
    yield { type: 'done' };
  }

  // -------------------------------------------------------------------------
  // AgentProvider.sendMessage
  // -------------------------------------------------------------------------

  async *sendMessage(input: AgentInput): AsyncIterable<AgentEvent> {
    // Build the user message content: a vision array when an image is attached,
    // otherwise a plain string.
    const userContent: string | unknown[] = input.imageDataUrl
      ? [
          { type: 'text', text: input.text },
          { type: 'image_url', image_url: { url: input.imageDataUrl } },
        ]
      : input.text;

    const messages: OAIMessage[] = [
      ...mapHistory(input.history),
      { role: 'user', content: userContent },
    ];

    yield* this.runTurnLoop(messages);
  }

  // -------------------------------------------------------------------------
  // AgentProvider.provideToolResult
  // -------------------------------------------------------------------------

  async *provideToolResult(result: ToolResult): AsyncIterable<AgentEvent> {
    // Look up the paused messages array
    let messages = this.pending.get(result.callId);

    if (!messages) {
      // No pending turn — stream a brief acknowledgement turn
      messages = [
        {
          role: 'user',
          content: result.ok
            ? 'El usuario confirmó la entrada.'
            : 'El usuario rechazó la entrada.',
        },
      ];
    } else {
      this.pending.delete(result.callId);
    }

    // Push the tool result for the registerEntry call
    messages.push({
      role: 'tool',
      tool_call_id: result.callId,
      content: JSON.stringify({
        ok: result.ok,
        savedEntries: result.savedEntries ?? [],
      }),
    });

    // Resume the turn loop, but guarantee a friendly completion message: a
    // confirmed entry must always be acknowledged out loud, even if the model
    // stays silent (emits another tool call, empty text, or the request fails).
    // We watch the resumed turn for any text and hold back its terminal `done`
    // so a deterministic fallback can be injected before we finish the turn.
    let sawText = false;
    for await (const ev of this.runTurnLoop(messages)) {
      if (ev.type === 'done') break;
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
  }

  // -------------------------------------------------------------------------
  // streamText — emit a deterministic message as text_start / deltas / end
  // -------------------------------------------------------------------------

  /**
   * Stream a local (non-model) message word by word, mirroring the SSE path.
   * The per-word delay is what makes it visibly stream: the UI fills text as
   * deltas arrive, so without pacing the whole message would pop in at once.
   */
  private async *streamText(text: string): AsyncGenerator<AgentEvent> {
    const messageId = uid('msg');
    yield { type: 'text_start', messageId };
    for (const w of text.split(/(\s+)/)) {
      yield { type: 'text_delta', messageId, delta: w };
      if (w.trim()) await new Promise<void>((r) => setTimeout(r, 28));
    }
    yield { type: 'text_end', messageId };
  }
}
