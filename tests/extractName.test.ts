import { describe, it, expect } from 'vitest';
import { extractPersonName } from '@/agent/extractName';

describe('extractPersonName — pulls the actual name out of conversational input', () => {
  // The reported bug: a greeting + intro must NOT be stored verbatim.
  it('strips greeting + intro: "hola me llamo lucio" -> "Lucio"', () => {
    expect(extractPersonName('hola me llamo lucio')).toBe('Lucio');
  });

  const cases: [string, string][] = [
    ['Lucio', 'Lucio'],
    ['lucio', 'Lucio'],
    ['LUCIO', 'Lucio'],
    ['me llamo Lucio', 'Lucio'],
    ['Me llamo lucio', 'Lucio'],
    ['mi nombre es María González', 'María González'],
    ['soy Pedro', 'Pedro'],
    ['yo soy Pedro', 'Pedro'],
    ['yo soy don Carlos', 'Carlos'],
    ['me dicen Pepe', 'Pepe'],
    ['buenos días, me llamo Ana', 'Ana'],
    ['buenas, soy Rosa', 'Rosa'],
    ['hola soy la señora Rosa Quispe', 'Rosa Quispe'],
    ['me llamo lucio y tengo diabetes', 'Lucio'],
    ['soy Juan, mucho gusto', 'Juan'],
    ['mi nombre es jorge', 'Jorge'],
    ['hola', ''], // greeting only → nothing extractable
    ['', ''],
    ['   ', ''],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" -> "${expected}"`, () => {
      expect(extractPersonName(input)).toBe(expected);
    });
  }

  // patientName phrasings ("¿Cómo se llama tu familiar?")
  it('handles "mi papá se llama Juan" -> "Juan"', () => {
    expect(extractPersonName('mi papá se llama Juan')).toBe('Juan');
  });
  it('handles "se llama Juan" -> "Juan"', () => {
    expect(extractPersonName('se llama Juan')).toBe('Juan');
  });
  it('handles "es mi mamá Rosa" -> "Rosa"', () => {
    expect(extractPersonName('es mi mamá Rosa')).toBe('Rosa');
  });

  // Compound names keep their connectors lowercase.
  it('keeps connectors lowercase: "María de los Ángeles" -> "María de los Ángeles"', () => {
    expect(extractPersonName('me llamo María de los Ángeles')).toBe('María de los Ángeles');
  });

  // Defensive: drops stray digits, caps absurd run-on input.
  it('drops digits: "soy lucio 123" -> "Lucio"', () => {
    expect(extractPersonName('soy lucio 123')).toBe('Lucio');
  });
});
