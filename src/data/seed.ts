/**
 * Seed data for Khumpai — "Carlos", a 52-year-old type 2 diabetes patient.
 * Covers the last 10 days relative to the current date (always fresh).
 *
 * INTENTIONAL SLEEP ↔ GLUCOSE PATTERN (the core demo):
 * Three short-sleep nights (<6h) each precede a high fasting morning reading
 * (170–195 mg/dL). All other fasting readings are 110–130 mg/dL and follow
 * good sleep nights (≥7h). This powers the sleep_glucose insight.
 *
 * PAIRING MAP — used by the correlation engine and tests:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Short sleep log          │  Paired high ayunas reading                │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  seed-slp-8  DAYS_AGO(8,23) — bedtime night   │  seed-glu-4  DAYS_AGO(7,7)   │
 * │  seed-slp-5  DAYS_AGO(5,23) — bedtime night   │  seed-glu-9  DAYS_AGO(4,7)   │
 * │  seed-slp-3  DAYS_AGO(3,23) — bedtime night   │  seed-glu-13 DAYS_AGO(2,7)   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Rule: sleep log at DAYS_AGO(N, 23) represents the bedtime of the night that
 * ends on the morning of DAYS_AGO(N-1). So high glucose at DAYS_AGO(N-1, 7)
 * is the first reading after that short night.
 *
 * All entries: source='seed', confirmed=true, isOfflineCapture=false.
 */

import type {
  AppState,
  LogEntry,
  GlucoseLog,
  MealLog,
  SleepLog,
  MoodLog,
  StressLog,
  Medication,
  AdherenceRecord,
  DoctorNote,
  DoctorVisit,
  Insight,
  ChartPoint,
  PrecomputedPackage,
  Achievement,
  UserPrefs,
} from '@/types';

// ---------------------------------------------------------------------------
// Date helpers — all timestamps relative to "now" so the seed is always fresh
// ---------------------------------------------------------------------------

/**
 * Returns an ISO 8601 string for N days ago at the given hour:minute.
 * This is the ONLY time source in this file — keeps the seed self-consistent.
 */
const DAYS_AGO = (n: number, hour = 9, minute = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/** Returns "YYYY-MM-DD" for N days ago (for AdherenceRecord.date). */
const DATE_AGO = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Base fields shared by all seed log entries
// ---------------------------------------------------------------------------

const BASE = {
  personId: 'carlos',
  source: 'seed' as const,
  confirmed: true as const,
  isOfflineCapture: false as const,
};

// ---------------------------------------------------------------------------
// Glucose logs — 14 readings
//
// SHORT-SLEEP MORNINGS (high, 170-195):  DAYS_AGO(7), DAYS_AGO(4), DAYS_AGO(2)
// ALL OTHER AYUNAS (good sleep, 110-130): DAYS_AGO(9), DAYS_AGO(6), DAYS_AGO(1)
// REMAINING: post-meal readings, mixed values
// ---------------------------------------------------------------------------

const glucoseLogs: GlucoseLog[] = [
  // --- Day 9 ago — ayunas after good sleep (DAYS_AGO(10,23) = good night)
  {
    ...BASE,
    id: 'seed-glu-1',
    type: 'glucose',
    timestamp: DAYS_AGO(9, 7, 15),
    createdAt: DAYS_AGO(9, 7, 16),
    payload: { value: 118, moment: 'ayunas' },
  },
  // --- Day 9 ago — post-almuerzo
  {
    ...BASE,
    id: 'seed-glu-2',
    type: 'glucose',
    timestamp: DAYS_AGO(9, 14, 30),
    createdAt: DAYS_AGO(9, 14, 31),
    payload: { value: 155, moment: 'post-almuerzo' },
  },
  // --- Day 8 ago — post-cena
  {
    ...BASE,
    id: 'seed-glu-3',
    type: 'glucose',
    timestamp: DAYS_AGO(8, 21, 0),
    createdAt: DAYS_AGO(8, 21, 1),
    payload: { value: 162, moment: 'post-cena' },
  },
  // --- Day 7 ago — HIGH ayunas after short sleep at DAYS_AGO(8,23) [PAIR 1]
  {
    ...BASE,
    id: 'seed-glu-4',
    type: 'glucose',
    timestamp: DAYS_AGO(7, 7, 0),
    createdAt: DAYS_AGO(7, 7, 1),
    payload: { value: 185, moment: 'ayunas' },
  },
  // --- Day 7 ago — post-desayuno
  {
    ...BASE,
    id: 'seed-glu-5',
    type: 'glucose',
    timestamp: DAYS_AGO(7, 10, 0),
    createdAt: DAYS_AGO(7, 10, 1),
    payload: { value: 198, moment: 'post-desayuno' },
  },
  // --- Day 6 ago — ayunas after good sleep (DAYS_AGO(7,23) = good night)
  {
    ...BASE,
    id: 'seed-glu-6',
    type: 'glucose',
    timestamp: DAYS_AGO(6, 7, 30),
    createdAt: DAYS_AGO(6, 7, 31),
    payload: { value: 122, moment: 'ayunas' },
  },
  // --- Day 6 ago — post-almuerzo
  {
    ...BASE,
    id: 'seed-glu-7',
    type: 'glucose',
    timestamp: DAYS_AGO(6, 14, 0),
    createdAt: DAYS_AGO(6, 14, 1),
    payload: { value: 148, moment: 'post-almuerzo' },
  },
  // --- Day 5 ago — post-cena (high due to pollo a la brasa)
  {
    ...BASE,
    id: 'seed-glu-8',
    type: 'glucose',
    timestamp: DAYS_AGO(5, 21, 30),
    createdAt: DAYS_AGO(5, 21, 31),
    payload: { value: 210, moment: 'post-cena' },
  },
  // --- Day 4 ago — HIGH ayunas after short sleep at DAYS_AGO(5,23) [PAIR 2]
  {
    ...BASE,
    id: 'seed-glu-9',
    type: 'glucose',
    timestamp: DAYS_AGO(4, 7, 0),
    createdAt: DAYS_AGO(4, 7, 1),
    payload: { value: 178, moment: 'ayunas' },
  },
  // --- Day 4 ago — post-almuerzo
  {
    ...BASE,
    id: 'seed-glu-10',
    type: 'glucose',
    timestamp: DAYS_AGO(4, 14, 0),
    createdAt: DAYS_AGO(4, 14, 1),
    payload: { value: 160, moment: 'post-almuerzo' },
  },
  // --- Day 3 ago — post-desayuno
  {
    ...BASE,
    id: 'seed-glu-11',
    type: 'glucose',
    timestamp: DAYS_AGO(3, 10, 0),
    createdAt: DAYS_AGO(3, 10, 1),
    payload: { value: 145, moment: 'post-desayuno' },
  },
  // --- Day 2 ago — HIGH ayunas after short sleep at DAYS_AGO(3,23) [PAIR 3]
  {
    ...BASE,
    id: 'seed-glu-13',
    type: 'glucose',
    timestamp: DAYS_AGO(2, 7, 0),
    createdAt: DAYS_AGO(2, 7, 1),
    payload: { value: 191, moment: 'ayunas' },
  },
  // --- Day 1 ago — ayunas after good sleep (DAYS_AGO(2,23) = good night)
  {
    ...BASE,
    id: 'seed-glu-14',
    type: 'glucose',
    timestamp: DAYS_AGO(1, 7, 15),
    createdAt: DAYS_AGO(1, 7, 16),
    payload: { value: 126, moment: 'ayunas' },
  },
  // --- Today — post-desayuno
  {
    ...BASE,
    id: 'seed-glu-15',
    type: 'glucose',
    timestamp: DAYS_AGO(0, 10, 0),
    createdAt: DAYS_AGO(0, 10, 1),
    payload: { value: 152, moment: 'post-desayuno' },
  },
];

// ---------------------------------------------------------------------------
// Sleep logs — 8 entries
//
// SHORT NIGHTS (hours < 6):
//   seed-slp-8  → DAYS_AGO(8,23)  5h   → pairs with seed-glu-4  DAYS_AGO(7,7)
//   seed-slp-5  → DAYS_AGO(5,23)  5.5h → pairs with seed-glu-9  DAYS_AGO(4,7)
//   seed-slp-3  → DAYS_AGO(3,23)  4.5h → pairs with seed-glu-13 DAYS_AGO(2,7)
//
// GOOD NIGHTS (hours ≥ 7):
//   seed-slp-10 → DAYS_AGO(10,23) 7.5h → pairs with seed-glu-1  DAYS_AGO(9,7)
//   seed-slp-7  → DAYS_AGO(7,23)  8h   → pairs with seed-glu-6  DAYS_AGO(6,7)
//   seed-slp-6  → DAYS_AGO(6,23)  7h   (no ayunas reading next morning in dataset)
//   seed-slp-2  → DAYS_AGO(2,23)  7h   → pairs with seed-glu-14 DAYS_AGO(1,7)
//   seed-slp-1  → DAYS_AGO(1,23)  7.5h → no ayunas yet (today)
// ---------------------------------------------------------------------------

const sleepLogs: SleepLog[] = [
  // Good night 10 days ago → normal glucose the morning of 9 days ago
  {
    ...BASE,
    id: 'seed-slp-10',
    type: 'sleep',
    timestamp: DAYS_AGO(10, 23, 0),
    createdAt: DAYS_AGO(10, 23, 5),
    payload: { hours: 7.5 },
  },
  // SHORT night 8 days ago → HIGH glucose morning of 7 days ago [PAIR 1]
  {
    ...BASE,
    id: 'seed-slp-8',
    type: 'sleep',
    timestamp: DAYS_AGO(8, 23, 0),
    createdAt: DAYS_AGO(8, 23, 5),
    payload: { hours: 5 },
  },
  // Good night 7 days ago → normal glucose morning of 6 days ago [good recovery]
  {
    ...BASE,
    id: 'seed-slp-7',
    type: 'sleep',
    timestamp: DAYS_AGO(7, 23, 0),
    createdAt: DAYS_AGO(7, 23, 5),
    payload: { hours: 8 },
  },
  // Good night 6 days ago
  {
    ...BASE,
    id: 'seed-slp-6',
    type: 'sleep',
    timestamp: DAYS_AGO(6, 23, 0),
    createdAt: DAYS_AGO(6, 23, 5),
    payload: { hours: 7 },
  },
  // SHORT night 5 days ago → HIGH glucose morning of 4 days ago [PAIR 2]
  {
    ...BASE,
    id: 'seed-slp-5',
    type: 'sleep',
    timestamp: DAYS_AGO(5, 23, 0),
    createdAt: DAYS_AGO(5, 23, 5),
    payload: { hours: 5.5 },
  },
  // SHORT night 3 days ago → HIGH glucose morning of 2 days ago [PAIR 3]
  {
    ...BASE,
    id: 'seed-slp-3',
    type: 'sleep',
    timestamp: DAYS_AGO(3, 23, 0),
    createdAt: DAYS_AGO(3, 23, 5),
    payload: { hours: 4.5 },
  },
  // Good night 2 days ago → normal glucose morning of 1 day ago
  {
    ...BASE,
    id: 'seed-slp-2',
    type: 'sleep',
    timestamp: DAYS_AGO(2, 23, 0),
    createdAt: DAYS_AGO(2, 23, 5),
    payload: { hours: 7 },
  },
  // Good night last night → no ayunas reading yet today
  {
    ...BASE,
    id: 'seed-slp-1',
    type: 'sleep',
    timestamp: DAYS_AGO(1, 23, 0),
    createdAt: DAYS_AGO(1, 23, 5),
    payload: { hours: 7.5 },
  },
];

// ---------------------------------------------------------------------------
// Meal logs — 12 Peruvian meals across the 10 days
// ---------------------------------------------------------------------------

const mealLogs: MealLog[] = [
  {
    ...BASE,
    id: 'seed-mel-1',
    type: 'meal',
    timestamp: DAYS_AGO(9, 8, 0),
    createdAt: DAYS_AGO(9, 8, 5),
    payload: { description: 'Pan con palta y café', context: 'casa' },
  },
  {
    ...BASE,
    id: 'seed-mel-2',
    type: 'meal',
    timestamp: DAYS_AGO(9, 13, 30),
    createdAt: DAYS_AGO(9, 13, 35),
    payload: { description: 'Arroz con pollo y ensalada', context: 'casa' },
  },
  {
    ...BASE,
    id: 'seed-mel-3',
    type: 'meal',
    timestamp: DAYS_AGO(8, 8, 0),
    createdAt: DAYS_AGO(8, 8, 5),
    payload: { description: 'Avena con plátano', context: 'casa' },
  },
  {
    ...BASE,
    id: 'seed-mel-4',
    type: 'meal',
    timestamp: DAYS_AGO(8, 13, 0),
    createdAt: DAYS_AGO(8, 13, 5),
    payload: { description: 'Menú del día: sopa de pollo y seco de pollo con frejoles', context: 'fuera' },
  },
  {
    ...BASE,
    id: 'seed-mel-5',
    type: 'meal',
    timestamp: DAYS_AGO(8, 20, 30),
    createdAt: DAYS_AGO(8, 20, 35),
    payload: { description: 'Pollo a la brasa con papas fritas', context: 'fuera' },
  },
  {
    ...BASE,
    id: 'seed-mel-6',
    type: 'meal',
    timestamp: DAYS_AGO(7, 8, 0),
    createdAt: DAYS_AGO(7, 8, 5),
    payload: { description: 'Dos panes con palta', context: 'casa' },
  },
  {
    ...BASE,
    id: 'seed-mel-7',
    type: 'meal',
    timestamp: DAYS_AGO(6, 13, 0),
    createdAt: DAYS_AGO(6, 13, 5),
    payload: { description: 'Tallarines verdes con bistec', context: 'casa' },
  },
  {
    ...BASE,
    id: 'seed-mel-8',
    type: 'meal',
    timestamp: DAYS_AGO(5, 8, 0),
    createdAt: DAYS_AGO(5, 8, 5),
    payload: { description: 'Pan francés con huevo frito', context: 'casa' },
  },
  {
    ...BASE,
    id: 'seed-mel-9',
    type: 'meal',
    timestamp: DAYS_AGO(4, 13, 30),
    createdAt: DAYS_AGO(4, 13, 35),
    payload: { description: 'Lomo saltado con arroz y ensalada', context: 'fuera' },
  },
  {
    ...BASE,
    id: 'seed-mel-10',
    type: 'meal',
    timestamp: DAYS_AGO(3, 13, 0),
    createdAt: DAYS_AGO(3, 13, 5),
    payload: { description: 'Ceviche y chicha morada', context: 'fuera' },
  },
  {
    ...BASE,
    id: 'seed-mel-11',
    type: 'meal',
    timestamp: DAYS_AGO(2, 8, 0),
    createdAt: DAYS_AGO(2, 8, 5),
    payload: { description: 'Avena con fruta', context: 'casa' },
  },
  {
    ...BASE,
    id: 'seed-mel-12',
    type: 'meal',
    timestamp: DAYS_AGO(1, 13, 30),
    createdAt: DAYS_AGO(1, 13, 35),
    payload: { description: 'Arroz con leche y sopa de pollo', context: 'casa' },
  },
];

// ---------------------------------------------------------------------------
// Mood logs — 4 entries; lower scores near short-sleep days for realism
// ---------------------------------------------------------------------------

const moodLogs: MoodLog[] = [
  // Good day
  {
    ...BASE,
    id: 'seed-moo-1',
    type: 'mood',
    timestamp: DAYS_AGO(8, 18, 0),
    createdAt: DAYS_AGO(8, 18, 5),
    payload: { score: 4 },
  },
  // Morning after short sleep — lower mood
  {
    ...BASE,
    id: 'seed-moo-2',
    type: 'mood',
    timestamp: DAYS_AGO(7, 9, 0),
    createdAt: DAYS_AGO(7, 9, 5),
    payload: { score: 2 },
  },
  // Decent day
  {
    ...BASE,
    id: 'seed-moo-3',
    type: 'mood',
    timestamp: DAYS_AGO(5, 18, 0),
    createdAt: DAYS_AGO(5, 18, 5),
    payload: { score: 3 },
  },
  // Morning after another short sleep — lower mood
  {
    ...BASE,
    id: 'seed-moo-4',
    type: 'mood',
    timestamp: DAYS_AGO(2, 9, 0),
    createdAt: DAYS_AGO(2, 9, 5),
    payload: { score: 2 },
  },
];

// ---------------------------------------------------------------------------
// Stress logs — 3 entries, higher stress near short-sleep nights
// ---------------------------------------------------------------------------

const stressLogs: StressLog[] = [
  // High stress the evening of the first short sleep
  {
    ...BASE,
    id: 'seed-str-1',
    type: 'stress',
    timestamp: DAYS_AGO(8, 22, 0),
    createdAt: DAYS_AGO(8, 22, 5),
    payload: { level: 3 as const },
  },
  // Moderate stress near second short sleep
  {
    ...BASE,
    id: 'seed-str-2',
    type: 'stress',
    timestamp: DAYS_AGO(5, 20, 0),
    createdAt: DAYS_AGO(5, 20, 5),
    payload: { level: 2 as const },
  },
  // High stress evening before third short sleep
  {
    ...BASE,
    id: 'seed-str-3',
    type: 'stress',
    timestamp: DAYS_AGO(3, 21, 0),
    createdAt: DAYS_AGO(3, 21, 5),
    payload: { level: 3 as const },
  },
];

// ---------------------------------------------------------------------------
// Second caregiver patient — "Rosa" (mother).
//
// A smaller, recent history that yields a DIFFERENT live status than Carlos so
// the caregiver portfolio shows two cards in two states. Rosa has a high
// fasting reading TODAY (188) and her 08:00 dose today is not marked taken — so
// she surfaces as "Necesita atención" (azúcar alta + pastilla olvidada) while
// Carlos stays calm in a typical daytime demo.
// ---------------------------------------------------------------------------

const ROSA_BASE = {
  personId: 'rosa',
  source: 'seed' as const,
  confirmed: true as const,
  isOfflineCapture: false as const,
};

const rosaLogs: LogEntry[] = [
  {
    ...ROSA_BASE,
    id: 'rosa-glu-1',
    type: 'glucose',
    timestamp: DAYS_AGO(2, 7, 30),
    createdAt: DAYS_AGO(2, 7, 31),
    payload: { value: 124, moment: 'ayunas' },
  },
  {
    ...ROSA_BASE,
    id: 'rosa-glu-2',
    type: 'glucose',
    timestamp: DAYS_AGO(1, 7, 30),
    createdAt: DAYS_AGO(1, 7, 31),
    payload: { value: 131, moment: 'ayunas' },
  },
  {
    ...ROSA_BASE,
    id: 'rosa-glu-3',
    type: 'glucose',
    timestamp: DAYS_AGO(0, 7, 30),
    createdAt: DAYS_AGO(0, 7, 31),
    payload: { value: 188, moment: 'ayunas' },
  },
  {
    ...ROSA_BASE,
    id: 'rosa-mood-1',
    type: 'mood',
    timestamp: DAYS_AGO(1, 20, 0),
    createdAt: DAYS_AGO(1, 20, 1),
    payload: { score: 4 },
  },
];

// ---------------------------------------------------------------------------
// All logs combined
// ---------------------------------------------------------------------------

export const SEED_LOGS: LogEntry[] = [
  ...glucoseLogs,
  ...sleepLogs,
  ...mealLogs,
  ...moodLogs,
  ...stressLogs,
  ...rosaLogs,
];

// ---------------------------------------------------------------------------
// Medication: Metformina 850mg × 2/day — ~80% adherence over 10 days
// ---------------------------------------------------------------------------

const buildAdherenceLog = (): AdherenceRecord[] => {
  // 20 scheduled doses over 10 days; ~80% taken = ~4 missed
  const missed = new Set([
    `${DATE_AGO(8)}-20:00`,
    `${DATE_AGO(6)}-08:00`,
    `${DATE_AGO(4)}-20:00`,
    `${DATE_AGO(2)}-08:00`,
  ]);

  const records: AdherenceRecord[] = [];
  for (let daysAgo = 9; daysAgo >= 0; daysAgo--) {
    const date = DATE_AGO(daysAgo);
    for (const time of ['08:00', '20:00']) {
      // Skip tonight's 20:00 dose if it's day 0 (today) and time hasn't passed
      if (daysAgo === 0 && time === '20:00') continue;
      records.push({
        date,
        scheduledTime: time,
        taken: !missed.has(`${date}-${time}`),
      });
    }
  }
  return records;
};

/** Rosa's adherence: mostly taken, but TODAY's 08:00 dose is missed. */
const buildRosaAdherenceLog = (): AdherenceRecord[] => {
  const records: AdherenceRecord[] = [];
  for (let daysAgo = 5; daysAgo >= 0; daysAgo--) {
    const date = DATE_AGO(daysAgo);
    for (const time of ['08:00', '20:00']) {
      if (daysAgo === 0 && time === '20:00') continue; // tonight's dose not yet due
      const missed = daysAgo === 0 && time === '08:00'; // forgot this morning's dose
      records.push({ date, scheduledTime: time, taken: !missed });
    }
  }
  return records;
};

export const SEED_MEDICATIONS: Medication[] = [
  {
    id: 'med-metformina',
    personId: 'carlos',
    name: 'Metformina',
    dose: '850mg',
    frequency: '2 veces al día',
    schedule: ['08:00', '20:00'],
    adherenceLog: buildAdherenceLog(),
  },
  {
    id: 'med-glibenclamida',
    personId: 'rosa',
    name: 'Glibenclamida',
    dose: '5mg',
    frequency: '2 veces al día',
    schedule: ['08:00', '20:00'],
    adherenceLog: buildRosaAdherenceLog(),
  },
];

// ---------------------------------------------------------------------------
// Doctor notes
// ---------------------------------------------------------------------------

export const SEED_DOCTOR_NOTES: DoctorNote[] = [
  {
    id: 'seed-dn-1',
    personId: 'carlos',
    text: 'El doctor dijo que mi azúcar en ayunas sigue un poco alta. Quiere que camine 30 minutos al día.',
    timestamp: DAYS_AGO(20, 10, 30),
    source: 'user',
    forQuestion: false,
  },
  {
    id: 'seed-dn-2',
    personId: 'carlos',
    text: '¿Es normal que mi azúcar suba tanto cuando duermo poco?',
    timestamp: DAYS_AGO(4, 9, 0),
    source: 'user',
    forQuestion: true,
  },
];

// ---------------------------------------------------------------------------
// Doctor visit — ~20 days ago, next appointment ~10 days in the future
// ---------------------------------------------------------------------------

const visitDate = new Date();
visitDate.setDate(visitDate.getDate() - 20);
const visitDateStr = visitDate.toISOString().slice(0, 10);

const nextApptDate = new Date();
nextApptDate.setDate(nextApptDate.getDate() + 10);
const nextApptStr = nextApptDate.toISOString().slice(0, 10);

export const SEED_DOCTOR_VISITS: DoctorVisit[] = [
  {
    id: 'seed-visit-1',
    personId: 'carlos',
    date: visitDateStr,
    whatDoctorSaid:
      'Control de rutina. El azúcar en ayunas sigue un poco alta. Se mantiene Metformina 850mg dos veces al día. Recomienda caminar 30 minutos al día y controlar el azúcar en casa.',
    indications: [
      'Tomar metformina 850mg dos veces al día (8 a.m. y 8 p.m.)',
      'Caminar 30 minutos al día',
      'Medir el azúcar en ayunas todos los días',
      'Evitar harinas y azúcar procesada',
      'Control en 1 mes',
    ],
    nextAppointment: nextApptStr,
  },
];

// ---------------------------------------------------------------------------
// Insight: sleep ↔ glucose pattern
// ---------------------------------------------------------------------------

const sleepGlucoseChartData: ChartPoint[] = [
  { label: 'Noche 1 (5h)', value: 185, category: 'high_glucose' },
  { label: 'Noche 2 (5.5h)', value: 178, category: 'high_glucose' },
  { label: 'Noche 3 (4.5h)', value: 191, category: 'high_glucose' },
  { label: 'Noche 4 (7.5h)', value: 118, category: 'normal_glucose' },
  { label: 'Noche 5 (8h)', value: 122, category: 'normal_glucose' },
  { label: 'Noche 6 (7h)', value: 126, category: 'normal_glucose' },
];

/**
 * New-schema insights (src/types/index.ts). Used by SEED_STATE and appStore.ts.
 * Note: agent/tools/index.ts imports the old SEED_INSIGHTS name; see the
 * backward-compat section at the bottom of this file.
 */
export const SEED_INSIGHTS_V2: Insight[] = [
  {
    id: 'seed-ins-sleep-glucose',
    personId: 'carlos',
    pattern: 'sleep_glucose',
    confidence: 'clear',
    basedOnCount: 3,
    text: 'He notado que en las mañanas después de dormir poco (menos de 6 horas), tu azúcar tiende a estar más alta. No es seguro al 100%, pero vale la pena cuidar tu sueño.',
    chartData: sleepGlucoseChartData,
  },
];

// ---------------------------------------------------------------------------
// Precomputed package — valid for 12 hours
// ---------------------------------------------------------------------------

const nowIso = new Date().toISOString();
const validUntilDate = new Date();
validUntilDate.setHours(validUntilDate.getHours() + 12);
const validUntilIso = validUntilDate.toISOString();

export const SEED_PRECOMPUTED: PrecomputedPackage = {
  generatedAt: nowIso,
  validUntil: validUntilIso,
  morningGreeting: '¡Buenos días, Carlos! ¿Cómo amaneciste hoy?',
  morningCheckin: '¿Ya tomaste tu Metformina de la mañana? Si ya lo hiciste, solo dime y lo anoto.',
  mealGuidance:
    'Para el desayuno, algo con fibra ayuda a que tu azúcar suba más despacio: avena, pan con palta o fruta con cáscara. Evita jugo de fruta solo — mejor come la fruta entera.',
  motivationalMessage:
    'Cada registro que haces me ayuda a conocerte mejor y darte sugerencias más útiles. ¡Vas muy bien, Carlos!',
  educationSnippet: {
    content:
      'Dormir menos de 6 horas puede hacer que el azúcar en sangre suba más en la mañana. Esto se debe a que el cuerpo produce más cortisol cuando está cansado, y el cortisol sube el azúcar. Cuidar el sueño es parte del control de la diabetes.',
    source: 'MINSA',
  },
  redFlagReminders: [
    'Si tu azúcar está por encima de 250, toma agua y reposa. Si te sientes mal, avisa a María.',
    'Si tu azúcar está por debajo de 70, come algo dulce ahora mismo.',
    'Síntomas como visión borrosa, mucha sed o mareo merecen atención médica ese mismo día.',
  ],
};

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export const SEED_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach-first-log',
    title: 'Primer registro',
    description: 'Anotaste tu primer dato. Así empieza cuidarse.',
    unlockedAt: DAYS_AGO(9, 7, 20),
    icon: 'star',
  },
  {
    id: 'ach-first-week',
    title: 'Primera semana',
    description: '¡Llevas una semana completa anotando! Eso ya es un gran paso.',
    unlockedAt: DAYS_AGO(2, 8, 0),
    icon: 'calendar',
  },
];

// ---------------------------------------------------------------------------
// Prefs
// ---------------------------------------------------------------------------

export const SEED_PREFS: UserPrefs = {
  preferredInputMode: 'text',
  inputModeCounts: { text: 18, voice: 4, quick_action: 7 },
  activeHours: [8, 9, 13, 20],
  activeHourCounts: {
    '8': 12,
    '9': 8,
    '13': 10,
    '20': 9,
    '21': 3,
  },
  acceptedSuggestionTypes: {
    meal_logging: 5,
    glucose_prompt: 8,
    medication_reminder: 6,
  },
  rejectedSuggestionTypes: {
    activity_suggestion: 2,
  },
};

// ---------------------------------------------------------------------------
// SEED_STATE — the full AppState for Carlos
// ---------------------------------------------------------------------------

export const SEED_STATE: AppState = {
  mode: 'patient',
  user: { id: 'carlos', name: 'Carlos' },
  persons: [
    {
      id: 'carlos',
      name: 'Carlos',
      relation: 'self',
      color: '#2E7D6B',
    },
    {
      id: 'rosa',
      name: 'Rosa',
      relation: 'mother',
      color: '#8A5CC0',
    },
  ],
  currentPersonId: 'carlos',
  logs: SEED_LOGS,
  medications: SEED_MEDICATIONS,
  doctorNotes: SEED_DOCTOR_NOTES,
  doctorVisits: SEED_DOCTOR_VISITS,
  insights: SEED_INSIGHTS_V2,
  prefs: SEED_PREFS,
  emergencyContact: {
    name: 'María',
    phone: '+51 999 888 777',
    relation: 'hija',
    isCaregiverUser: false,
  },
  isOffline: false,
  syncQueue: [],
  precomputedPackage: SEED_PRECOMPUTED,
  chatHistory: [],
  achievements: SEED_ACHIEVEMENTS,
};

// ---------------------------------------------------------------------------
// NOTE: Pre-existing files in src/agent/ and src/components/cards/ were
// already broken before this workstream (they import "@/lib/types" which does
// not exist on disk). Their refactor is owned by other workstreams.
//
// The export alias below preserves the old name so the one resolvable error
// in agent/tools/index.ts (missing SEED_INSIGHTS) is reduced to just the
// @/lib/types module error that was already there.
// ---------------------------------------------------------------------------

/**
 * Alias for agent/tools/index.ts backward compatibility.
 * agent/tools/index.ts also imports Insight from "@/lib/types" which doesn't
 * exist — so that file is already broken for other reasons. This export just
 * prevents adding a new missing-member error on top.
 */
export { SEED_INSIGHTS_V2 as SEED_INSIGHTS };
