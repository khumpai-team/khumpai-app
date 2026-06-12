import { describe, it, expect } from 'vitest';
import { findFood } from '@/data/peruvian-foods';
import { queryRag } from '@/agent/tools/queryRag';

// ---------------------------------------------------------------------------
// Fix E: findFood should match food names embedded inside a longer query
// ---------------------------------------------------------------------------

describe('findFood — conversational input (Fix E)', () => {
  it('findFood("puedo comer arroz con pollo") returns arroz con pollo entry', () => {
    const result = findFood('puedo comer arroz con pollo');
    expect(result).toBeDefined();
    expect(result!.name).toBe('arroz con pollo');
  });

  it('findFood("¿puedo comer arroz con pollo?") returns arroz con pollo entry', () => {
    const result = findFood('¿puedo comer arroz con pollo?');
    expect(result).toBeDefined();
    expect(result!.name).toBe('arroz con pollo');
  });

  it('findFood("me gusta el ceviche") returns ceviche entry', () => {
    const result = findFood('me gusta el ceviche');
    expect(result).toBeDefined();
    expect(result!.name).toBe('ceviche');
  });

  // Original direction (single word / partial) still works as fallback
  it('findFood("arroz") still returns an entry with "arroz" in its name', () => {
    const result = findFood('arroz');
    expect(result).toBeDefined();
    // Should match the first food whose name contains "arroz"
    expect(result!.name).toMatch(/arroz/);
  });
});

describe('queryRag — food lookup via conversational query (Fix E)', () => {
  it('queryRag("puedo comer arroz con pollo") returns the food note with source "Tabla de alimentos"', () => {
    const result = queryRag('puedo comer arroz con pollo');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('Tabla de alimentos');
    // The note mentions arroz and azúcar
    expect(result!.content).toMatch(/arroz/i);
    expect(result!.content.length).toBeGreaterThan(0);
  });

  it('queryRag("¿puedo comer lomo saltado?") returns lomo saltado note', () => {
    const result = queryRag('¿puedo comer lomo saltado?');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('Tabla de alimentos');
    expect(result!.content).toMatch(/arroz|papa|proteina/i);
  });
});
