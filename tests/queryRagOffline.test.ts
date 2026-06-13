import { describe, it, expect } from 'vitest';
import { queryRag } from '@/agent/tools/queryRag';

describe('queryRag — offline digest', () => {
  it('answers the plate-method question from the digest', () => {
    const r = queryRag('cómo sirvo mi plato');
    expect(r).not.toBeNull();
    expect(r!.content.toLowerCase()).toMatch(/mitad|verduras|plato/);
    expect(r!.source.length).toBeGreaterThan(0);
  });

  it('answers a foot-care question', () => {
    const r = queryRag('cómo cuido mis pies');
    expect(r).not.toBeNull();
    expect(r!.content.toLowerCase()).toContain('pie');
  });

  it('returns null for an unrelated question', () => {
    expect(queryRag('quién ganó el partido')).toBeNull();
  });
});
