import { describe, it, expect } from 'vitest';
import { FOUNDRY_TOOL_DEFINITIONS } from '@/agent/foundryConfig';
import { getSummary } from '@/agent/tools';
import type { LogEntry } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reaching into JSON-schema literals
const params = (name: string): any =>
  FOUNDRY_TOOL_DEFINITIONS.find((t) => t.function.name === name)!.function.parameters;

const glucoseLog = (daysAgo: number): LogEntry => ({
  id: `g${daysAgo}`,
  personId: 'p1',
  timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  createdAt: new Date().toISOString(),
  source: 'conversation',
  confirmed: true,
  isOfflineCapture: false,
  type: 'glucose',
  payload: { value: 120, moment: 'ayunas' },
});

describe('getSummary — 3-month window is honoured', () => {
  it('"3months" counts the last ~90 days, not all time', () => {
    const logs = [glucoseLog(60), glucoseLog(100)];
    // 60d ago is inside 3 months; 100d ago is outside.
    expect(getSummary(logs, '3months').glucose.count).toBe(1);
    // sanity: month window excludes the 60d one too
    expect(getSummary(logs, 'month').glucose.count).toBe(0);
  });
});

describe('tool definitions match their implementations', () => {
  it('getSummary advertises only supported periods and no dead metric param', () => {
    const p = params('getSummary');
    expect(p.properties.period.enum).toEqual(['day', 'week', 'month', '3months']);
    expect(p.properties.metric).toBeUndefined();
    expect(p.required).toEqual(['period']);
  });

  it('queryHistory advertises daysBack, not unimplemented from/to', () => {
    const p = params('queryHistory');
    expect(p.properties.daysBack).toBeDefined();
    expect(p.properties.from).toBeUndefined();
    expect(p.properties.to).toBeUndefined();
  });
});
