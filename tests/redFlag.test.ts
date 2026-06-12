import { describe, it, expect } from 'vitest';
import { evaluateRedFlag, evaluateGlucoseRedFlag } from '@/agent/tools/evaluateRedFlag';

// ---------------------------------------------------------------------------
// evaluateRedFlag — symptom text classifier
// ---------------------------------------------------------------------------

describe('evaluateRedFlag — emergency level', () => {
  it('dolor en el pecho → emergency', () => {
    const r = evaluateRedFlag('dolor en el pecho');
    expect(r.level).toBe('emergency');
  });

  it('me desmayé → emergency', () => {
    const r = evaluateRedFlag('me desmayé');
    expect(r.level).toBe('emergency');
  });

  it('no puedo respirar → emergency', () => {
    const r = evaluateRedFlag('no puedo respirar');
    expect(r.level).toBe('emergency');
  });

  it('tengo una herida que no cierra → emergency', () => {
    // EMERGENCY_RE includes "herida que no (sana|cierra)"
    const r = evaluateRedFlag('tengo una herida que no cierra');
    expect(r.level).toBe('emergency');
  });

  it('tengo una úlcera en el pie → emergency', () => {
    const r = evaluateRedFlag('tengo una úlcera en el pie');
    expect(r.level).toBe('emergency');
  });
});

describe('evaluateRedFlag — urgent level', () => {
  it('tengo una herida que no sana → urgent or emergency', () => {
    // "herida que no sana" appears in BOTH EMERGENCY_RE and URGENT_RE
    // EMERGENCY_RE checks first, so it returns emergency
    const r = evaluateRedFlag('tengo una herida que no sana');
    expect(['emergency', 'urgent']).toContain(r.level);
  });

  it('veo borroso / visión borrosa → urgent or emergency', () => {
    const r = evaluateRedFlag('visión borrosa');
    expect(['emergency', 'urgent']).toContain(r.level);
    // Not ok
    expect(r.level).not.toBe('ok');
  });

  it('tengo vómitos → urgent', () => {
    const r = evaluateRedFlag('tengo vómito fuerte');
    expect(r.level).toBe('urgent');
  });

  it('tengo fiebre alta → urgent', () => {
    const r = evaluateRedFlag('tengo fiebre alta');
    expect(r.level).toBe('urgent');
  });
});

describe('evaluateRedFlag — watch level', () => {
  it('tengo hormigueo → watch', () => {
    const r = evaluateRedFlag('tengo hormigueo en los pies');
    expect(r.level).toBe('watch');
  });

  it('estoy mareado → watch', () => {
    const r = evaluateRedFlag('estoy mareado');
    expect(r.level).toBe('watch');
  });

  it('tengo hinchazón → watch', () => {
    const r = evaluateRedFlag('tengo hinchazón en el tobillo');
    expect(r.level).toBe('watch');
  });

  it('mucha sed → watch', () => {
    const r = evaluateRedFlag('tengo mucha sed');
    expect(r.level).toBe('watch');
  });
});

describe('evaluateRedFlag — ok level', () => {
  it('me duele un poco la rodilla → ok (no diabetic red-flag)', () => {
    const r = evaluateRedFlag('me duele un poco la rodilla');
    expect(r.level).toBe('ok');
  });

  it('me siento un poco cansado → ok', () => {
    const r = evaluateRedFlag('me siento un poco cansado hoy');
    expect(r.level).toBe('ok');
  });
});

// Fix D: neuropathy / loss of sensation → watch (not ok)
describe('evaluateRedFlag — neuropathy / loss of sensation (Fix D)', () => {
  it('no siento los pies → watch', () => {
    const r = evaluateRedFlag('no siento los pies');
    expect(r.level).toBe('watch');
  });

  it('no siento las manos → watch', () => {
    const r = evaluateRedFlag('no siento las manos');
    expect(r.level).toBe('watch');
  });

  it('no siento las piernas → watch', () => {
    const r = evaluateRedFlag('no siento las piernas');
    expect(r.level).toBe('watch');
  });

  it('pérdida de sensibilidad → at least watch level (not ok)', () => {
    // EMERGENCY_RE already covers "pérdida de sensibilidad" — confirm it is not ok
    const r = evaluateRedFlag('pérdida de sensibilidad en los pies');
    expect(r.level).not.toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// evaluateGlucoseRedFlag — numeric thresholds
// ---------------------------------------------------------------------------

describe('evaluateGlucoseRedFlag — thresholds', () => {
  it('55 → emergency (below 60)', () => {
    const r = evaluateGlucoseRedFlag(55);
    expect(r.level).toBe('emergency');
  });

  it('310 → emergency (above 300)', () => {
    const r = evaluateGlucoseRedFlag(310);
    expect(r.level).toBe('emergency');
  });

  it('270 → urgent (250 < v <= 300)', () => {
    const r = evaluateGlucoseRedFlag(270);
    expect(r.level).toBe('urgent');
  });

  it('220 → watch (180 <= v <= 250)', () => {
    const r = evaluateGlucoseRedFlag(220);
    expect(r.level).toBe('watch');
  });

  it('140 → ok (below 180, above 60)', () => {
    const r = evaluateGlucoseRedFlag(140);
    expect(r.level).toBe('ok');
  });

  it('70 → ok (exactly 70, boundary)', () => {
    const r = evaluateGlucoseRedFlag(70);
    expect(r.level).toBe('ok');
  });

  it('59 → emergency (below 60)', () => {
    const r = evaluateGlucoseRedFlag(59);
    expect(r.level).toBe('emergency');
  });

  it('180 → watch (exactly 180)', () => {
    const r = evaluateGlucoseRedFlag(180);
    expect(r.level).toBe('watch');
  });

  it('each result includes a non-empty message string', () => {
    for (const v of [55, 270, 220, 140]) {
      const r = evaluateGlucoseRedFlag(v);
      expect(typeof r.message).toBe('string');
      expect(r.message.length).toBeGreaterThan(0);
    }
  });
});
