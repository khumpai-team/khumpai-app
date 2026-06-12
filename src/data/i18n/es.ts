/**
 * Single source of truth for ALL user-facing text.
 * Peruvian Spanish, plain language. We say "tu azúcar", never "glucemia".
 * Warm and encouraging — never punitive.
 *
 * Components must import from here; never hardcode user-facing strings.
 */

export const es = {
  app: {
    name: 'Khumpai',
    tagline: 'Tu compañera para cuidar tu azúcar',
  },

  nav: {
    home: 'Inicio',
    chat: 'Khumpi',
    journal: 'Mi diario',
  },

  chat: {
    status: 'En línea',
    statusThinking: 'Escribiendo…',
    statusListening: 'Te escucho…',
    headerSubtitle: 'Aquí para ayudarte',
    inputPlaceholder: 'Cuéntame cómo vas…',
    micLabel: 'Hablar con Khumpi',
    micStop: 'Dejar de grabar',
    sendLabel: 'Enviar mensaje',
    attachLabel: 'Adjuntar',
    greeting: '¡Hola, Carlos! 👋 ¿Cómo amaneciste hoy?',
    suggestionsTitle: 'Puedes contarme cosas como:',
    suggestions: [
      'Hoy desayuné dos panes con palta y me salió 160',
      'Dormí 5 horas',
      'Ya tomé mi pastilla',
      'Me duele un poco la cabeza',
    ],
  },

  confirmation: {
    title: 'Anoté esto',
    titleMeal: 'Tu comida',
    titleGlucose: 'Tu azúcar',
    titleSleep: 'Tu descanso',
    titleMedication: 'Tu pastilla',
    titleSymptom: 'Cómo te sientes',
    forPersonPrefix: 'Para',
    confirm: 'Confirmar',
    edit: 'Editar',
    saved: 'Guardado',
    cancel: 'Cancelar',
    done: 'Listo',
    // field labels
    fieldMeal: 'Comida',
    fieldPlace: 'Dónde',
    fieldGlucose: 'Azúcar',
    fieldGlucoseMoment: 'Cuándo mediste',
    fieldHours: 'Horas',
    fieldMedication: 'Medicamento',
    fieldMedTaken: 'Estado',
    fieldSymptom: 'Molestia',
    medTaken: { yes: 'Sí la tomé', no: 'Aún no' },
    units: {
      mgdl: 'mg/dL',
      hours: 'horas',
    },
  },

  enums: {
    mealContext: {
      casa: 'En casa',
      fuera: 'Fuera',
    },
    glucoseMoment: {
      ayunas: 'En ayunas',
      'post-desayuno': 'Después del desayuno',
      'post-almuerzo': 'Después del almuerzo',
      'post-cena': 'Después de la cena',
    },
  },

  // NOTE: generic agent reflexes live in `agent-es.ts` (AGENT_ES). This file
  // holds UI chrome AND scripted demo-flow dialogue (the emotional arc, etc.).

  // The spike → calm → why → action arc.
  arc: {
    calm: (name: string) =>
      `Tranquilo, ${name}. Respira hondo. Un número alto no es una emergencia por sí solo — y no es tu culpa. Vamos a entenderlo juntos, ¿ya?`,
    chipWhy: '¿Por qué me pasó?',
    chipWhat: '¿Qué hago ahora?',
    insightHeader: 'Lo que veo en TUS registros',
    honestyClear: 'Patrón claro',
    honestyPossible: 'Posible patrón',
    honestyTail: (n: number) =>
      `· basado en ${n} coincidencias en tus registros · no es un diagnóstico`,
    actionActivity:
      'Una caminata suave de 10 minutos después de almorzar suele ayudar. ¿Te lo recuerdo?',
    actionFood:
      'Como lo tuyo es más la comida 🍽️, para el almuerzo algo con fibra y menos arroz ayuda a que tu azúcar suba más despacio. ¿Quieres una idea sencilla?',
    acceptActivity: 'Sí, recuérdamelo',
    acceptFood: 'Sí, dame una idea',
    decline: 'Hoy no',
    acceptedReply: 'Perfecto, te lo dejo recordado para más tarde. 💚',
    declinedReply: 'No pasa nada 💚 Aquí estoy cuando quieras.',
    foodIdea:
      'Te paso una: media taza de arroz en vez de una llena, y agrégale más verduras o menestras. Pequeños cambios, gran diferencia. 🥗',
    close: 'Y esto queda anotado para tu próximo reporte al doctor. 📝',
    doctorNote:
      'Azúcar alta en la mañana. Conversamos el patrón de dormir poco y una acción sencilla para hoy.',
  },

  safety: {
    title: 'Mejor que lo vea tu médico',
    notifyContact: (name: string) => `Avisar a ${name}`,
    notified: (name: string) => `Le avisé a ${name}`,
    seeClinic: 'Ver clínica cercana',
    hideClinic: 'Ocultar clínica',
    emergencyLine: 'Emergencias: llama al 106 (SAMU)',
    call106: 'Llamar al 106',
    whatsappMessage: (name: string) =>
      `Hola, soy ${name}. Khumpai me sugirió avisarte: necesito que me acompañes a ver al médico. Gracias 💚`,
    clinic: {
      label: 'Clínica más cercana',
      name: 'Centro de Salud San José',
      address: 'Av. Los Próceres 456 — a 8 min de ti',
      phone: '(01) 555-1234',
    },
  },

  panic: {
    button: 'Necesito ayuda',
    title: '¿Necesitas ayuda ahora?',
    subtitle: 'Si es una emergencia, te conecto de inmediato.',
    confirm: 'Sí, es urgente',
    cancel: 'Me equivoqué',
    callContact: (name: string) => `Llamar a ${name}`,
    whatsappContact: (name: string) => `Escribir a ${name} por WhatsApp`,
    call106: 'Llamar al 106 (SAMU)',
    reassure: (name: string) => `Tranquilo. ${name} ya fue avisada. Estoy aquí contigo. 💚`,
    whatsappMessage: (name: string) =>
      `Hola, soy ${name}. Es urgente — necesito tu ayuda ahora. Te escribo desde Khumpai.`,
  },

  home: {
    title: 'Inicio',
    greetMorning: (name: string) => `Buenos días, ${name} 💚`,
    greetAfternoon: (name: string) => `Buenas tardes, ${name} 💚`,
    greetEvening: (name: string) => `Buenas noches, ${name} 💚`,
    nextDoseLine: (med: string, time: string) => `Hoy: tu ${med} a las ${time}.`,
    sleptLittle: 'Anoche dormiste poco — hoy vamos suave, sin apuro.',
    restedWell: 'Anoche descansaste bien. ¡Sigue así! 🌙',
    pillTitle: 'Tu pastillero',
    nextTake: (time: string) => `Próxima toma: ${time}`,
    markTaken: 'Marcar como tomada',
    takenToday: 'Tomada hoy ✓',
    allDone: 'Hoy ya estás al día 💚',
    weekTitle: 'Tu semana',
    weekCount: (n: number) =>
      `Esta semana me contaste ${n} ${n === 1 ? 'día' : 'días'}. ¡Eso ayuda un montón! 🌱`,
    weekZero: 'Cuéntame algo cuando quieras — sin apuro. Aquí estoy. 🌱',
    cta: 'Hablar con Khumpi',
  },

  settings: {
    title: 'Ajustes',
    appearance: 'Apariencia',
    theme: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    emergency: 'Contacto de emergencia',
    emergencyName: 'Nombre',
    emergencyPhone: 'Teléfono',
    emergencyRelation: 'Parentesco',
    save: 'Guardar',
    saved: 'Guardado ✓',
    connection: 'Conexión',
    offlineDemo: 'Modo sin conexión (demo)',
    offlineHint: 'Simula estar sin señal para ver cómo Khumpi sigue ayudando.',
    language: 'Idioma',
    languageValue: 'Español (Perú)',
    languageSoon: 'Más idiomas pronto',
  },

  report: {
    title: 'Reporte',
    open: 'Ver reporte',
    tabDoctor: 'Para mi médico',
    tabVisits: 'Lo que me dijo el doctor',
    period: 'Periodo',
    period15: 'Últimos 15 días',
    period30: 'Últimos 30 días',
    glucoseTitle: 'Tus azúcares',
    avg: 'Promedio',
    inRange: 'En rango',
    spikes: 'Picos notables',
    readingsCount: (n: number) => `${n} ${n === 1 ? 'lectura' : 'lecturas'}`,
    noGlucose: 'Aún no hay lecturas en este periodo.',
    adherenceTitle: 'Adherencia',
    adherencePct: (p: number) => `${p}% de las tomas`,
    adherenceSub: (t: number, n: number) => `${t} de ${n} tomas registradas`,
    noAdherence: 'Sin registro de pastillas en este periodo.',
    patternsTitle: 'Patrones observados',
    patternsDisclaimer: 'Solo observaciones de tus datos — no es un diagnóstico.',
    noPatterns: 'Todavía no veo un patrón claro. Sigue anotando y te aviso.',
    questionsTitle: 'Preguntas para tu médico',
    addQuestion: 'Agregar pregunta',
    questionPlaceholder: 'Escribe tu pregunta para el doctor…',
    noQuestions: 'Sin preguntas por ahora.',
    share: 'Compartir con mi médico',
    shareVia: '¿Cómo quieres compartirlo?',
    whatsapp: 'WhatsApp',
    email: 'Correo',
    pdf: 'PDF',
    sent: 'Enviado ✓',
    newVisit: 'Nueva nota de cita',
    visitSaid: '¿Qué te dijo el doctor?',
    visitIndications: 'Indicaciones (una por línea)',
    visitNext: 'Próxima cita (opcional)',
    visitSave: 'Guardar cita',
    noVisits: 'Aún no hay notas de citas. Agrega la última que tuviste.',
    indicationsTitle: 'Indicaciones',
    nextAppt: (d: string) => `Próxima cita: ${d}`,
    visitAck: (said: string) =>
      `Vi que el doctor te dijo: "${said}". Lo tendré presente para acompañarte mejor. 💙`,
  },

  journal: {
    title: 'Mi diario',
    placeholder: 'Aquí verás todo lo que vamos anotando juntos.',
    empty: 'Este día no me contaste nada — y no pasa nada. 💚',
    sections: {
      morning: 'Mañana',
      glucose: 'Glucosa',
      meals: 'Comidas',
      medication: 'Medicación',
      notes: 'Notas de Khumpi',
    },
    sleepLabel: (h: number) => `Dormiste ${h} h`,
    moodLabel: 'Ánimo',
    stressLabel: 'Estrés',
    taken: 'Tomada',
    pending: 'Pendiente',
    edit: 'Editar',
    save: 'Guardar',
    cancel: 'Cancelar',
    today: 'Hoy',
    yesterday: 'Ayer',
    weekdayInitials: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  },

  common: {
    you: 'Tú',
    today: 'Hoy',
    offline: 'Sin conexión — guardo todo y lo sincronizo después',
    back: 'Volver',
    close: 'Cerrar',
    themeToggle: 'Cambiar tema',
    themeLight: 'Modo claro',
    themeDark: 'Modo oscuro',
  },
} as const;

export type I18n = typeof es;
