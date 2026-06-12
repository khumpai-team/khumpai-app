/**
 * Centralized Peruvian-Spanish strings for the Khumpi agent layer.
 *
 * Rules:
 * - Plain language: "tu azúcar", NEVER "glucemia" or medical jargon.
 * - Tone: calm first, data second, one action max, never judgmental.
 * - Template helpers use arrow functions so callers get type-safe interpolation.
 *
 * Usage:
 *   import { AGENT_ES } from '@/data/i18n/agent-es';
 *   AGENT_ES.confirmations.saved           // "Anotado ✅"
 *   AGENT_ES.glucose.registered(145)      // "Anoté tu azúcar en 145. ..."
 */

export const AGENT_ES = {
  // ---------------------------------------------------------------------------
  // Greetings — used at session start, keyed by time-of-day
  // ---------------------------------------------------------------------------
  greetings: {
    morning: (name: string) =>
      `¡Buenos días, ${name}! ¿Cómo amaneciste hoy? Si ya te mediste el azúcar o tomaste tu pastilla, cuéntame.`,
    midday: (name: string) =>
      `¡Hola, ${name}! ¿Cómo vas por el día? Puedes contarme qué almorzaste o cómo te has sentido.`,
    afternoon: (name: string) =>
      `Buenas tardes, ${name}. ¿Quieres anotar algo de hoy antes de la cena?`,
    evening: (name: string) =>
      `Buenas noches, ${name}. ¿Cómo estuvo tu día? Si quieres, me cuentas cómo dormiste anoche.`,
    /** Generic fallback when hour is unknown. */
    generic: (name: string) =>
      `¡Hola, ${name}! ¿Cómo estás? Cuéntame cómo va tu día.`,
    /** Used the very first time the user opens the app. */
    firstTime: (name: string) =>
      `¡Hola, ${name}! Soy Khumpi, tu compañera para cuidar tu azúcar. Cuéntame cómo amaneciste hoy. 😊`,
  },

  // ---------------------------------------------------------------------------
  // Confirmations — short, warm acknowledgements after saving
  // ---------------------------------------------------------------------------
  confirmations: {
    saved: 'Anotado ✅',
    savedLong: 'Listo, lo guardé.',
    savedGlucose: 'Listo, anoté tu azúcar. 💙',
    savedMeal: '¡Gracias por contarme! Ya anoté tu comida. 🍽️',
    savedSleep: 'Anotado tu descanso. Dormir bien también cuida tu azúcar. 😴',
    savedMedication: '¡Bien! Anoté que tomaste tu pastilla. 💊',
    savedSymptom: 'Anotado. Seguimos de cerca cómo te sientes.',
    savedMood: 'Anotado cómo te sientes. Gracias por contarme.',
    savedStress: 'Entendido. Lo anoté para que tu doctor también lo vea.',
    savedActivity: '¡Qué bien que te moviste! Ya lo anoté. 🚶',
    edited: 'Listo, corregí el dato.',
  },

  // ---------------------------------------------------------------------------
  // Glucose — context-aware messages after registering a reading
  // ---------------------------------------------------------------------------
  glucose: {
    /** Called immediately after saving any glucose reading. */
    registered: (v: number) =>
      `Anoté tu azúcar en ${v} mg/dL. Gracias por avisarme.`,
    /** v < 70 */
    low: (v: number) =>
      `Tu azúcar está en ${v}, que es bastante baja. Come algo dulce AHORA — un jugo, unas galletas — y descansa un momento. Si no mejoras en 15 minutos, llama a alguien de confianza.`,
    /** 70 ≤ v < 180 */
    ok: (v: number) =>
      `Anoté tu azúcar en ${v}. Está en un rango tranquilo. ¡Bien!`,
    /** 180 ≤ v < 250 */
    high: (v: number) =>
      `Anoté tu azúcar en ${v}. Está un poquito alta hoy. Toma agua, evita algo dulce esta tarde y cuéntame cómo sigues más tarde.`,
    /** v ≥ 250 */
    veryHigh: (v: number) =>
      `Tu azúcar está en ${v}, que es alta. Toma agua ahora y descansa. Si te sientes mal o ves borroso, avisa a María o ve al médico hoy.`,
    /** Fasting reading annotation */
    fastingNote: 'Esta es tu azúcar de la mañana, antes de comer.',
    /** Post-meal annotation */
    postMealNote: (minutes: number) =>
      `Esta lectura es ${minutes} minutos después de comer, así que puede estar un poco más alta de lo normal.`,
  },

  // ---------------------------------------------------------------------------
  // Red-flag messages per level — calm, warm, never alarmist
  // ---------------------------------------------------------------------------
  redFlags: {
    /** All readings within normal range */
    ok: '¡Todo bien por ahora! Sigue como vas.',
    /** Something to monitor but not urgent */
    watch: (detail: string) =>
      `Noté algo que vale la pena vigilar: ${detail}. No es urgente, pero anótalo para contárselo a tu doctor en tu próxima cita.`,
    /** Needs prompt medical attention */
    urgent: (detail: string) =>
      `Esto merece atención pronto: ${detail}. Te recomiendo llamar a tu médico hoy o mañana. Si empeora, no esperes.`,
    /** Emergency — act now */
    emergency: (detail: string) =>
      `${detail} Esto es importante — busca ayuda médica ahora. Puedo ayudarte a avisar a María si lo necesitas.`,
  },

  // ---------------------------------------------------------------------------
  // Guardrail refusals — warm, redirects to doctor or logging
  // ---------------------------------------------------------------------------
  guardrails: {
    /** User asks about changing medication dose */
    doseQuestion:
      'Esa decisión sobre tu dosis es solo de tu médico. Yo te ayudo a anotar todo para que él pueda decidir mejor. ¿Quieres que lo dejemos apuntado para tu próxima cita?',
    /** User asks for a diagnosis */
    diagnosis:
      'No puedo decirte qué enfermedad es — eso lo evalúa tu médico. Lo que sí puedo es ayudarte a anotar lo que sientes para contárselo. ¿Te parece?',
    /** User asks about stopping medication */
    stopMedication:
      'Dejar o cambiar una pastilla es una decisión muy importante, y debe tomarla tu médico, no yo. Anota esta duda para preguntársela en tu próxima consulta. ¿Lo guardo como pregunta para el doctor?',
    /** Possible prompt-injection or off-topic instruction */
    promptInjection:
      'Eso no me suena a algo que yo deba hacer. Estoy aquí para ayudarte con tu azúcar, tus comidas y cómo te sientes. ¿Hay algo en eso que quieras anotar hoy?',
    /** Generic guardrail for anything outside scope */
    outOfScope:
      'Eso está fuera de lo que puedo ayudarte. Pero si hay algo sobre tu azúcar, tu dieta o cómo te sientes, con gusto lo anotamos.',
  },

  // ---------------------------------------------------------------------------
  // Offline rule messages — fired by the offline engine, no network needed
  // ---------------------------------------------------------------------------
  offline: {
    /** Glucose ≥ 250, captured offline */
    glucoseVeryHigh: (v: number) =>
      `Tu azúcar está en ${v}, que es alta. Toma agua ahora. Si te sientes mal, avisa a María o ve al centro de salud. Cuando tengas señal, lo sincronizamos.`,
    /** Glucose < 70, captured offline */
    glucoseLow: (_v: number) =>
      'Tu azúcar está baja — come algo dulce AHORA: un jugo, unas galletas o un caramelo. Descansa y dime cómo te sientes en unos minutos.',
    /** Less than 5 hours sleep — gentle nudge */
    sleepShort: (hours: number) =>
      `Dormiste ${hours} horas. Descansa un poco más cuando puedas — el descanso también cuida tu azúcar. Sin prisa.`,
    /** Medication overdue (no log after scheduled time) */
    medicationOverdue: (name: string, scheduledTime: string) =>
      `Parece que aún no tomaste tu ${name} de las ${scheduledTime}. ¿Ya la tomaste? Puedes contarme y lo anoto.`,
    /** Generic offline message when no rule fires */
    noConnection:
      'Estás sin conexión ahora, pero sigo anotando todo. Cuando vuelva la señal, sincronizamos automáticamente.',
  },

  // ---------------------------------------------------------------------------
  // Achievement titles and descriptions — celebration-only, never streak-shame
  // ---------------------------------------------------------------------------
  achievements: {
    firstWeek: {
      title: 'Primera semana',
      description: '¡Llevas una semana completa anotando! Eso ya es un gran paso.',
    },
    fiveReadingsThisWeek: {
      title: '5 registros esta semana',
      description: 'Cinco veces te mediste el azúcar esta semana. Así es como se cuida la salud.',
    },
    khumpiKnowsYou: {
      title: 'Khumpi ya te conoce mejor',
      description: 'Con tus datos, ya puedo darte sugerencias más personalizadas para ti.',
    },
    reportReady: {
      title: 'Reporte listo',
      description: 'Preparé tu resumen para llevar al médico. ¡Qué bien documentado vas!',
    },
    firstLog: {
      title: 'Primer registro',
      description: 'Anotaste tu primer dato. Así empieza cuidarse.',
    },
  },

  // ---------------------------------------------------------------------------
  // Insight presentation — how the agent shares a detected pattern
  // ---------------------------------------------------------------------------
  insights: {
    sleepGlucosePattern:
      'He notado algo interesante: en las mañanas después de dormir poco (menos de 6 horas), tu azúcar tiende a estar más alta. No es seguro al 100%, pero vale la pena cuidar tu sueño.',
    /** Generic intro before sharing any insight */
    intro: 'Revisando tus datos, noté un patrón que puede ayudarte:',
    /** Disclaimer added after any insight */
    disclaimer:
      'Esto es solo una observación de tus datos — tu médico puede confirmarlo mejor.',
    /** When asked "why was my sugar high?" */
    whyHigh: (possibleCause: string) =>
      `Una posibilidad es ${possibleCause}. Pero hay otros factores que solo tu médico puede evaluar. ¿Quieres que lo anotemos para preguntárselo?`,
  },

  // ---------------------------------------------------------------------------
  // Fallbacks — when the agent cannot parse or has nothing specific to say
  // ---------------------------------------------------------------------------
  fallbacks: {
    /** When intent is unclear */
    unclear:
      'No estoy seguro de entenderte bien. Puedes contarme con tus palabras qué comiste, cómo dormiste o cuánto te salió el azúcar, y yo lo anoto. 😊',
    /** After a parse error */
    parseError:
      'Mmm, no pude entender bien eso. ¿Puedes contarme de otra manera? Por ejemplo: "mi azúcar estuvo en 145" o "dormí 7 horas".',
    /** Generic positive filler when there is nothing to highlight */
    allGood:
      'Todo va bien por aquí. Sigue anotando y juntos llevamos un registro completo para tu médico.',
    /** When no data exists yet for a query */
    noData:
      'Aún no tengo datos suficientes para eso. Sigue anotando unos días más y te podré decir algo más concreto.',
    /** Session start with no new data */
    nothingNew:
      'No hay nada nuevo por ahora. Cuéntame cómo va tu día cuando quieras.',
  },

  // ---------------------------------------------------------------------------
  // Doctor visit / report related
  // ---------------------------------------------------------------------------
  doctor: {
    reportIntro:
      'Preparé un resumen de los últimos días para que lo lleves a tu cita. Incluye tu azúcar, tus comidas, tu descanso y tus pastillas.',
    savedNote: (text: string) =>
      `Guardé esto para tu doctor: "${text}". Te lo recuerdo antes de tu próxima cita.`,
    savedQuestion: (text: string) =>
      `Apunté tu pregunta para el doctor: "${text}". No se te olvidará.`,
    nextAppointmentReminder: (date: string) =>
      `Tu próxima cita es el ${date}. ¿Quieres repasar lo que tienes anotado para llevarle?`,
  },

  // ---------------------------------------------------------------------------
  // Morning check-in — precomputed package strings
  // ---------------------------------------------------------------------------
  morningCheckin: {
    greeting: (name: string) =>
      `Buenos días, ${name}. ¿Cómo amaneciste? Si ya te mediste, cuéntame tu azúcar de hoy.`,
    checkin:
      '¿Te tomaste tu pastilla de la mañana? Solo dime "sí" y lo anoto.',
    mealGuidance:
      'Para el desayuno, algo con fibra te ayuda a que el azúcar suba más despacio: avena, pan integral, frutas con cáscara.',
    motivational:
      'Cada registro cuenta. Poco a poco, juntos llevamos el control.',
  },

} as const;

export type AgentStrings = typeof AGENT_ES;
