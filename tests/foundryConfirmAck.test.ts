import './helpers/polyfillStorage';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { FoundryAgentProvider } from '@/agent/FoundryAgentProvider';
import { ackForEntries } from '@/agent/ack';
import type { AgentEvent } from '@/agent/AgentProvider';
import type { LogEntry } from '@/types';

// --- helpers ---------------------------------------------------------------

async function collect(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const ev of iter) events.push(ev);
  return events;
}

const fullText = (events: AgentEvent[]): string =>
  events
    .filter((e): e is Extract<AgentEvent, { type: 'text_delta' }> => e.type === 'text_delta')
    .map((e) => e.delta)
    .join('');

/** Build an SSE Response from a list of proxy events. */
function sseResponse(events: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      controller.close();
    },
  });
  return new Response(stream);
}

const glucoseEntry: LogEntry = {
  id: 'log1',
  personId: 'p1',
  timestamp: '2026-06-12T08:00:00.000Z',
  createdAt: '2026-06-12T08:00:00.000Z',
  source: 'conversation',
  confirmed: true,
  isOfflineCapture: false,
  type: 'glucose',
  payload: { value: 110, moment: 'ayunas' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- tests -----------------------------------------------------------------

describe('FoundryAgentProvider — confirmation always speaks', () => {
  it('streams a recomputed ack when the resumed turn emits no text', async () => {
    // Model resumes after confirm but says nothing (just a done frame).
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([{ type: 'done' }])));

    const provider = new FoundryAgentProvider();
    const events = await collect(
      provider.provideToolResult({
        callId: 'call_abc',
        name: 'registerEntry',
        ok: true,
        savedEntries: [glucoseEntry],
      }),
    );

    expect(fullText(events)).toBe(ackForEntries(glucoseEntry));
    expect(events.some((e) => e.type === 'text_start')).toBe(true);
    expect(events.some((e) => e.type === 'text_end')).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('does NOT append a fallback when the model already spoke', async () => {
    const spoken = 'Anoté tu azúcar, ¡vas muy bien!';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([{ type: 'text', delta: spoken }, { type: 'done' }])),
    );

    const provider = new FoundryAgentProvider();
    const events = await collect(
      provider.provideToolResult({
        callId: 'call_abc',
        name: 'registerEntry',
        ok: true,
        savedEntries: [glucoseEntry],
      }),
    );

    expect(fullText(events)).toBe(spoken);
    // Exactly one message — no second text_start from a fallback.
    expect(events.filter((e) => e.type === 'text_start')).toHaveLength(1);
  });
});
