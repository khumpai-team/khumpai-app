import './helpers/polyfillStorage';
import { describe, it, expect } from 'vitest';
import { MockAgentProvider } from '@/agent/MockAgentProvider';
import { useAppStore } from '@/store/appStore';
import type { AgentEvent } from '@/agent/AgentProvider';
import type { MealLog, GlucoseLog } from '@/types';

// ---------------------------------------------------------------------------
// Helper: collect all events from an async iterable
// ---------------------------------------------------------------------------

async function collectEvents(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const ev of iter) {
    events.push(ev);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Integration test: meal + glucose combo
// ---------------------------------------------------------------------------

describe('MockAgentProvider full flow: meal+glucose', { timeout: 15000 }, () => {
  const INPUT_TEXT = 'hoy desayuné dos panes con palta y me salió 160';

  it('emits a tool_call for registerEntry with correct entries', async () => {
    const provider = new MockAgentProvider();
    const events = await collectEvents(
      provider.sendMessage({ text: INPUT_TEXT, history: [] }),
    );

    // There must be a tool_call event
    const toolCallEvent = events.find((e) => e.type === 'tool_call');
    expect(toolCallEvent).toBeDefined();
    expect(toolCallEvent!.type).toBe('tool_call');

    if (toolCallEvent!.type !== 'tool_call') return;
    const call = toolCallEvent!.call;

    expect(call.name).toBe('registerEntry');
    expect(call.args).toBeDefined();
  });

  it('registerEntry args: primary is meal with palta in description, context casa', async () => {
    const provider = new MockAgentProvider();
    const events = await collectEvents(
      provider.sendMessage({ text: INPUT_TEXT, history: [] }),
    );

    const toolCallEvent = events.find((e) => e.type === 'tool_call');
    expect(toolCallEvent).toBeDefined();
    if (toolCallEvent?.type !== 'tool_call') return;

    const { args } = toolCallEvent.call;
    const entry = (args as any).entry as MealLog;

    expect(entry.type).toBe('meal');
    expect(entry.payload.description.toLowerCase()).toContain('palta');
    expect(entry.payload.context).toBe('casa');
  });

  it('registerEntry args: secondaryEntry is glucose with value 160 and moment post-desayuno', async () => {
    const provider = new MockAgentProvider();
    const events = await collectEvents(
      provider.sendMessage({ text: INPUT_TEXT, history: [] }),
    );

    const toolCallEvent = events.find((e) => e.type === 'tool_call');
    expect(toolCallEvent).toBeDefined();
    if (toolCallEvent?.type !== 'tool_call') return;

    const { args } = toolCallEvent.call;
    const secondary = (args as any).secondaryEntry as GlucoseLog | undefined;

    expect(secondary).toBeDefined();
    expect(secondary!.type).toBe('glucose');
    expect(secondary!.payload.value).toBe(160);
    expect(secondary!.payload.moment).toBe('post-desayuno');
  });

  it('persisting confirmed entries to store works and they are findable by id', async () => {
    const provider = new MockAgentProvider();
    const events = await collectEvents(
      provider.sendMessage({ text: INPUT_TEXT, history: [] }),
    );

    const toolCallEvent = events.find((e) => e.type === 'tool_call');
    if (toolCallEvent?.type !== 'tool_call') return;

    const { args } = toolCallEvent.call;
    const mealEntry = { ...(args as any).entry, confirmed: true } as MealLog;
    const glucoseEntry = { ...(args as any).secondaryEntry, confirmed: true } as GlucoseLog;

    // Persist to store (simulate what useChat does)
    const { actions } = useAppStore.getState();
    actions.addLog(mealEntry);
    actions.addLog(glucoseEntry);

    // Verify both entries are in the store
    const logs = useAppStore.getState().logs;
    const foundMeal = logs.find((l) => l.id === mealEntry.id);
    const foundGlucose = logs.find((l) => l.id === glucoseEntry.id);

    expect(foundMeal).toBeDefined();
    expect(foundMeal!.confirmed).toBe(true);
    expect((foundMeal as MealLog).payload.description.toLowerCase()).toContain('palta');

    expect(foundGlucose).toBeDefined();
    expect(foundGlucose!.confirmed).toBe(true);
    expect((foundGlucose as GlucoseLog).payload.value).toBe(160);
  });

  it('provideToolResult yields warm text reply and done event', async () => {
    const provider = new MockAgentProvider();
    const sendEvents = await collectEvents(
      provider.sendMessage({ text: INPUT_TEXT, history: [] }),
    );

    const toolCallEvent = sendEvents.find((e) => e.type === 'tool_call');
    expect(toolCallEvent).toBeDefined();
    if (toolCallEvent?.type !== 'tool_call') return;

    const callId = toolCallEvent.call.id;
    const { args } = toolCallEvent.call;
    const savedEntries = [
      (args as any).entry,
      (args as any).secondaryEntry,
    ].filter(Boolean);

    const resumeEvents = await collectEvents(
      provider.provideToolResult({
        callId,
        name: 'registerEntry',
        ok: true,
        savedEntries,
      }),
    );

    // Concatenate text deltas
    const text = resumeEvents
      .filter((e) => e.type === 'text_delta')
      .map((e) => (e as any).delta as string)
      .join('');

    expect(text.length).toBeGreaterThan(0);

    // 160 is in the ok range (< 180), so the reply should mention 160
    // or be a warm confirmation. Either way it should be non-empty.
    // Assert it contains the value OR is a warm acknowledgement.
    const hasDoneEvent = resumeEvents.some((e) => e.type === 'done');
    expect(hasDoneEvent).toBe(true);

    // The ack for a meal+glucose combo (160 < 180) uses AGENT_ES.glucose.ok(160)
    // which says "Anoté tu azúcar en 160. Está en un rango tranquilo. ¡Bien!"
    expect(text).toContain('160');
  });

  it('full flow emits done at the end of sendMessage', async () => {
    const provider = new MockAgentProvider();
    const events = await collectEvents(
      provider.sendMessage({ text: INPUT_TEXT, history: [] }),
    );
    const lastEvent = events[events.length - 1];
    expect(lastEvent.type).toBe('done');
  });
});
