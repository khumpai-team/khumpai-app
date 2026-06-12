import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluateAchievements } from '@/lib/achievements';
import type { AppState, LogEntry } from '@/types';
import { SEED_STATE } from '@/data/seed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_ENTRY = {
  personId: 'carlos',
  createdAt: new Date().toISOString(),
  source: 'conversation' as const,
  confirmed: true as const,
  isOfflineCapture: false as const,
  timestamp: new Date().toISOString(),
};

function makeLog(id: string, daysAgo = 0): LogEntry {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    ...BASE_ENTRY,
    id,
    type: 'meal',
    timestamp: d.toISOString(),
    payload: { description: 'test', context: 'casa' },
  } as LogEntry;
}

function makeState(
  logs: LogEntry[],
  achievements: AppState['achievements'] = [],
): AppState {
  return {
    ...SEED_STATE,
    logs,
    achievements,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateAchievements — ach-first-log', () => {
  it('1 confirmed log → includes ach-first-log', () => {
    const state = makeState([makeLog('log-1')]);
    const result = evaluateAchievements(state);
    const ids = result.map((a) => a.id);
    expect(ids).toContain('ach-first-log');
  });

  it('0 confirmed logs → does NOT include ach-first-log', () => {
    const noConfirmed: LogEntry[] = [
      {
        ...BASE_ENTRY,
        id: 'unconfirmed-1',
        type: 'meal',
        confirmed: false,
        payload: { description: 'test', context: 'casa' },
      },
    ];
    const state = makeState(noConfirmed);
    const result = evaluateAchievements(state);
    const ids = result.map((a) => a.id);
    expect(ids).not.toContain('ach-first-log');
  });
});

describe('evaluateAchievements — ach-khumpi-knows', () => {
  it('10 confirmed logs → includes ach-khumpi-knows', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(`log-${i}`));
    const state = makeState(logs);
    const result = evaluateAchievements(state);
    const ids = result.map((a) => a.id);
    expect(ids).toContain('ach-khumpi-knows');
  });

  it('9 confirmed logs → does NOT include ach-khumpi-knows', () => {
    const logs = Array.from({ length: 9 }, (_, i) => makeLog(`log-${i}`));
    const state = makeState(logs);
    const result = evaluateAchievements(state);
    const ids = result.map((a) => a.id);
    expect(ids).not.toContain('ach-khumpi-knows');
  });

  it('12 confirmed logs → includes both ach-first-log and ach-khumpi-knows', () => {
    const logs = Array.from({ length: 12 }, (_, i) => makeLog(`log-${i}`));
    const state = makeState(logs);
    const result = evaluateAchievements(state);
    const ids = result.map((a) => a.id);
    expect(ids).toContain('ach-first-log');
    expect(ids).toContain('ach-khumpi-knows');
  });
});

describe('evaluateAchievements — idempotency', () => {
  it('ach-first-log already in state → NOT returned again', () => {
    const logs = [makeLog('log-1')];
    const existing = [
      {
        id: 'ach-first-log',
        title: 'Primer registro',
        description: 'Anotaste tu primer dato.',
        unlockedAt: new Date().toISOString(),
      },
    ];
    const state = makeState(logs, existing);
    const result = evaluateAchievements(state);
    const ids = result.map((a) => a.id);
    expect(ids).not.toContain('ach-first-log');
  });

  it('ach-khumpi-knows already in state → NOT returned again', () => {
    const logs = Array.from({ length: 12 }, (_, i) => makeLog(`log-${i}`));
    const existing = [
      {
        id: 'ach-khumpi-knows',
        title: 'Khumpi ya te conoce',
        description: 'Con tus datos...',
        unlockedAt: new Date().toISOString(),
      },
    ];
    const state = makeState(logs, existing);
    const result = evaluateAchievements(state);
    const ids = result.map((a) => a.id);
    expect(ids).not.toContain('ach-khumpi-knows');
  });

  it('re-running with same state returns same result (stable idempotency)', () => {
    const logs = Array.from({ length: 5 }, (_, i) => makeLog(`log-${i}`));
    const state = makeState(logs);
    const now = new Date('2026-06-12T10:00:00');
    const r1 = evaluateAchievements(state, now);
    const r2 = evaluateAchievements(state, now);
    expect(r1.map((a) => a.id).sort()).toEqual(r2.map((a) => a.id).sort());
  });
});

describe('evaluateAchievements — ach-report-ready (event flag)', () => {
  it('opts.reportGenerated true → includes ach-report-ready', () => {
    const state = makeState([]);
    const result = evaluateAchievements(state, new Date(), { reportGenerated: true });
    const ids = result.map((a) => a.id);
    expect(ids).toContain('ach-report-ready');
  });

  it('opts.reportGenerated false → does NOT include ach-report-ready', () => {
    const state = makeState([]);
    const result = evaluateAchievements(state, new Date(), { reportGenerated: false });
    const ids = result.map((a) => a.id);
    expect(ids).not.toContain('ach-report-ready');
  });
});

// ---------------------------------------------------------------------------
// NO-STREAK GUARANTEE — source scan (code-only lines, comments excluded)
//
// The intent: achievements.ts must have NO streak logic in executable code.
// The file itself warns in its header comment that streaks are prohibited,
// so we must strip comments before scanning to avoid false positives.
// ---------------------------------------------------------------------------

describe('achievements.ts NO-STREAK GUARANTEE', () => {
  const rawSource = readFileSync(
    new URL('../src/lib/achievements.ts', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
    'utf-8',
  );

  // Strip single-line comments (// ...) and block comments (/* ... */)
  // so that "no streak variables" in the header comment doesn't trip the scan.
  const codeOnly = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
    .replace(/\/\/[^\n]*/g, '')        // remove single-line comments
    .toLowerCase();

  it('code (excluding comments) does not contain "streak"', () => {
    expect(codeOnly).not.toContain('streak');
  });

  it('code (excluding comments) does not contain "consecut"', () => {
    expect(codeOnly).not.toContain('consecut');
  });

  it('code (excluding comments) does not contain "racha"', () => {
    expect(codeOnly).not.toContain('racha');
  });

  it('code (excluding comments) does not contain "días seguidos"', () => {
    expect(codeOnly).not.toContain('días seguidos');
  });

  it('code (excluding comments) does not contain "missed"', () => {
    expect(codeOnly).not.toContain('missed');
  });
});
