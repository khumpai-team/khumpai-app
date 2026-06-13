import { describe, it, expect } from 'vitest';
import { buildAgentMessages, SYSTEM_PREFIX } from '../src/http/buildMessages.js';

describe('buildAgentMessages', () => {
  it('keeps a byte-identical, cacheable system prefix across different inputs', () => {
    const a = buildAgentMessages({
      history: [{ role: 'user', content: 'hola' }],
      patientContext: 'X',
      nowIso: '2026-06-12T10:00:00Z',
    });
    const b = buildAgentMessages({
      history: [{ role: 'user', content: 'otra cosa distinta' }],
      patientContext: 'Y',
      nowIso: '2026-06-13T11:00:00Z',
    });
    expect(a[0]).toEqual(SYSTEM_PREFIX);
    expect(a[0].content).toBe(b[0].content); // prefix unchanged → cache stays warm
  });

  it('puts datetime + patient context only in the dynamic message, not the prefix', () => {
    const m = buildAgentMessages({
      history: [],
      patientContext: 'última azúcar 130',
      nowIso: '2026-06-12T10:00:00Z',
    });
    expect(m[1].content).toContain('2026-06-12');
    expect(m[1].content).toContain('última azúcar 130');
    expect(SYSTEM_PREFIX.content ?? '').not.toContain('2026-06-12');
  });

  it('bounds the history window', () => {
    const hist = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    const m = buildAgentMessages({ history: hist, patientContext: '', nowIso: 'now', windowTurns: 6 });
    expect(m.length).toBe(2 + 6); // prefix + context + 6 turns
    expect(m[m.length - 1].content).toBe('m19');
  });
});
