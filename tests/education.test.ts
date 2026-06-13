import { describe, it, expect } from 'vitest';
import { isEducationQuestion } from '@/agent/education';

describe('isEducationQuestion', () => {
  // Education questions the grounded knowledge base should answer.
  const educational = [
    '¿por qué me sube el azúcar en la mañana?',
    '¿el camote es bueno para la diabetes?',
    '¿qué es la hemoglobina glicosilada?',
    '¿puedo comer arroz?',
    '¿cómo cuido mis pies?',
    '¿el ejercicio ayuda con el azúcar?',
    'para qué sirve la metformina',
    '¿cuántos vasos de agua debo tomar al día?',
    'explícame qué es la diabetes',
  ];
  for (const q of educational) {
    it(`treats "${q}" as an education question`, () => {
      expect(isEducationQuestion(q)).toBe(true);
    });
  }

  // NOT education: greetings, chit-chat, and data/symptom statements that the
  // deterministic layer handles before this detector ever runs.
  const notEducational = [
    'hola',
    'buenos días',
    'gracias khumpi',
    '¿cómo estás?',
    'me salió 120 en ayunas',
    'dormí 5 horas',
    'ya tomé mi pastilla',
    'tengo una herida en el pie',
    '¿qué tengo?',
  ];
  for (const q of notEducational) {
    it(`does NOT treat "${q}" as an education question`, () => {
      expect(isEducationQuestion(q)).toBe(false);
    });
  }
});
