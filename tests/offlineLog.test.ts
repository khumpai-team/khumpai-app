import { describe, it, expect } from 'vitest';
import { looksLikeFoodLog } from '@/agent/offlineLog';
import { offlineEducationAnswer } from '@/agent/offlineEducation';

describe('looksLikeFoodLog — bare food statements are loggable offline', () => {
  it('logs a verbless food: "pan con palta"', () => {
    expect(looksLikeFoodLog('pan con palta')).toBe('pan con palta');
  });
  it('logs "arroz con pollo"', () => {
    expect(looksLikeFoodLog('arroz con pollo')).toBe('arroz con pollo');
  });
  it('does NOT log a question: "¿puedo comer arroz?"', () => {
    expect(looksLikeFoodLog('¿puedo comer arroz?')).toBeNull();
  });
  it('does NOT log an opinion question: "el camote es bueno?"', () => {
    expect(looksLikeFoodLog('el camote es bueno?')).toBeNull();
  });
  it('returns null for a non-food statement: "hola"', () => {
    expect(looksLikeFoodLog('hola')).toBeNull();
  });
});

describe('offline digest covers the most common questions (gap fixes)', () => {
  const expectsHit = [
    'qué es la diabetes',
    'por qué me sube el azúcar en la mañana',
    'tengo mucha sed',
    'cuánto debe estar mi azúcar',
  ];
  for (const q of expectsHit) {
    it(`answers "${q}"`, () => {
      const r = offlineEducationAnswer(q);
      expect(r).not.toBeNull();
      expect(r!.body.length).toBeGreaterThan(0);
    });
  }
});
