import { describe, it, expect } from 'vitest';
import { offlineEducationAnswer } from '@/agent/offlineEducation';

describe('offlineEducationAnswer', () => {
  it('returns a digest answer for an education question about foot care', () => {
    const result = offlineEducationAnswer('¿cómo cuido mis pies?');
    expect(result).not.toBeNull();
    expect(result!.body.toLowerCase()).toContain('pie');
    expect(result!.source.length).toBeGreaterThan(0);
    expect(result!.body).toMatch(/Sin conexión, pero esto es lo que sé:/);
  });

  it('returns a digest answer for an education question about the plate method', () => {
    const result = offlineEducationAnswer('¿cómo debo comer con diabetes?');
    expect(result).not.toBeNull();
    expect(result!.body.toLowerCase()).toMatch(/mitad|verduras|plato|fibra|carbohidrato/);
    expect(result!.source.length).toBeGreaterThan(0);
  });

  it('returns null for a non-education question', () => {
    const result = offlineEducationAnswer('hola');
    expect(result).toBeNull();
  });

  it('returns null when education question has no digest match', () => {
    // An education question about a topic with no keyword match in the digest
    const result = offlineEducationAnswer('¿qué es el péptido C?');
    expect(result).toBeNull();
  });
});
