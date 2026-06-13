import { describe, it, expect } from 'vitest';
import { FOUNDRY_TOOL_DEFINITIONS, DIARY_FEWSHOTS } from '@/agent/foundryConfig';

/* eslint-disable @typescript-eslint/no-explicit-any -- schema introspection */
const registerEntry = FOUNDRY_TOOL_DEFINITIONS.find(
  (d) => d.function.name === 'registerEntry',
) as any;

describe('registerEntry strict schema', () => {
  it('is marked strict', () => {
    expect(registerEntry.function.strict).toBe(true);
  });

  it('exposes 5 typed entry variants via anyOf', () => {
    const variants = registerEntry.function.parameters.properties.entry.anyOf;
    expect(variants).toHaveLength(5);
    const types = variants.map((v: any) => v.properties.type.enum[0]).sort();
    expect(types).toEqual(['glucose', 'meal', 'medication', 'sleep', 'symptom']);
  });

  it('secondaryEntry is nullable (anyOf includes a null variant)', () => {
    const sec = registerEntry.function.parameters.properties.secondaryEntry.anyOf;
    expect(sec.some((v: any) => v.type === 'null')).toBe(true);
  });

  it('every object disallows extra props and requires all its keys (strict-compliant)', () => {
    const walk = (s: any): void => {
      if (!s || typeof s !== 'object') return;
      if (s.type === 'object') {
        expect(s.additionalProperties).toBe(false);
        expect(new Set(s.required)).toEqual(new Set(Object.keys(s.properties)));
        Object.values(s.properties).forEach(walk);
      }
      (s.anyOf ?? []).forEach(walk);
    };
    walk(registerEntry.function.parameters);
  });
});

describe('diary few-shots', () => {
  it('are present and reference registerEntry examples', () => {
    expect(DIARY_FEWSHOTS).toContain('registerEntry');
    expect(DIARY_FEWSHOTS).toContain('moment:"ayunas"');
  });
});
