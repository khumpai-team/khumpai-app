/**
 * queryRag — pure retrieval from a hardcoded knowledge base.
 *
 * Interface is designed for easy swap to Azure AI Search or a vector database
 * in Phase 2 — just replace KNOWLEDGE_BASE and the match logic while keeping
 * the same function signature.
 *
 * Every answer MUST include a source (MINSA, ADA, or "Tabla de alimentos").
 */

import { z } from 'zod';
import { findFood } from '@/data/peruvian-foods';

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

interface KnowledgeEntry {
  id: string;
  topic: string;
  /** Keywords used for matching (lowercase, no accents). */
  keywords: string[];
  content: string;
  source: string;
}

// TODO Phase 2: replace this array with Azure AI Search / pgvector retrieval
// while keeping the queryRag(query) signature stable.
const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'kb-01',
    topic: 'sueño y azúcar',
    keywords: ['sue', 'dormir', 'dormi', 'descanso', 'horas de sueno'],
    content:
      'Dormir menos de 6 horas puede hacer que tu azúcar en la mañana esté más alta. Cuando el cuerpo descansa poco, produce más cortisol, una hormona que eleva el azúcar. Cuidar el sueño es parte del control de la diabetes.',
    source: 'MINSA',
  },
  {
    id: 'kb-02',
    topic: 'fibra y azúcar',
    keywords: ['fibra', 'integral', 'avena', 'verdura', 'frejol', 'lenteja', 'quinua'],
    content:
      'Los alimentos con fibra — avena, verduras, frejoles, quinua, pan integral — hacen que el azúcar suba más despacio después de comer. Trata de incluir fibra en cada comida.',
    source: 'ADA',
  },
  {
    id: 'kb-03',
    topic: 'cuidado de los pies',
    keywords: ['pie', 'pies', 'herida', 'ampolla', 'unas', 'zapatos', 'calzado'],
    content:
      'La diabetes puede hacer que los pies pierdan sensibilidad. Revisa tus pies todos los días — busca heridas, ampollas o cambios de color. Usa zapatos cómodos que no aprieten. Si ves algo que no sana, consulta a tu médico ese mismo día.',
    source: 'MINSA',
  },
  {
    id: 'kb-04',
    topic: 'hidratación',
    keywords: ['agua', 'tomar agua', 'sed', 'hidrata', 'liquido', 'bebida'],
    content:
      'Tomar suficiente agua — al menos 6 a 8 vasos al día — ayuda a que los riñones eliminen el exceso de azúcar. Prefiere agua sola; las bebidas azucaradas suben el azúcar rápidamente.',
    source: 'MINSA',
  },
  {
    id: 'kb-05',
    topic: 'rango normal de azúcar en ayunas',
    keywords: ['normal', 'ayunas', 'rango', 'valor', 'cuanto debe', 'deberia', 'meta'],
    content:
      'En términos generales, muchas personas con diabetes apuntan a un azúcar en ayunas entre 80 y 130 mg/dL, según lo que su médico les indique. Cada persona es diferente — solo tu médico puede decirte cuál es tu meta personal.',
    source: 'ADA',
  },
  {
    id: 'kb-06',
    topic: 'comidas regulares',
    keywords: ['saltarse', 'saltar', 'comida', 'horario', 'regular', 'frecuencia', 'meal'],
    content:
      'Saltarse comidas puede hacer que el azúcar suba y baje de forma irregular. Trata de comer a horas parecidas cada día y no pasar muchas horas sin comer — esto ayuda a que el azúcar se mantenga más estable.',
    source: 'ADA',
  },
  {
    id: 'kb-07',
    topic: 'caminar después de comer',
    keywords: ['caminar', 'camina', 'caminata', 'despues de comer', 'paseo', 'ejercicio', 'actividad'],
    content:
      'Una caminata suave de 10 a 15 minutos después de comer ayuda a que los músculos usen el azúcar de la sangre. Es uno de los hábitos más sencillos y efectivos para controlar el azúcar después de las comidas.',
    source: 'ADA',
  },
  {
    id: 'kb-08',
    topic: 'metformina',
    keywords: ['metformina', 'pastilla', 'medicamento', 'medicina', 'tableta'],
    content:
      'La Metformina es uno de los medicamentos más usados para la diabetes tipo 2 en el Perú. Ayuda al cuerpo a usar el azúcar de manera más eficiente. Es importante tomarla con comida para evitar malestar estomacal. Nunca cambies tu dosis sin hablarlo con tu médico.',
    source: 'MINSA',
  },
  {
    id: 'kb-09',
    topic: 'azúcar alta después de comer',
    keywords: ['alta despues', 'post comida', 'postprandial', 'sube despues', 'sube al comer'],
    content:
      'Es normal que el azúcar suba un poco después de comer. Lo importante es cuánto sube y qué tan rápido baja. Comer con fibra y proteína, y caminar después, ayuda a que esa subida sea más suave.',
    source: 'ADA',
  },
  {
    id: 'kb-10',
    topic: 'estrés y azúcar',
    keywords: ['estres', 'estresado', 'nervioso', 'ansiedad', 'preocupado', 'cortisol'],
    content:
      'El estrés y la ansiedad pueden elevar el azúcar en la sangre porque el cuerpo libera cortisol. Técnicas simples como respirar profundo, salir a caminar o hablar con alguien de confianza pueden ayudar a manejarlo.',
    source: 'MINSA',
  },
  {
    id: 'kb-11',
    topic: 'síntomas de azúcar baja',
    keywords: ['azucar baja', 'hipoglicemia', 'mareo', 'temblar', 'temblor', 'sudor', 'debil', 'hambre de golpe'],
    content:
      'Si sientes mareo, temblor, sudoración o mucha hambre de repente, puede ser que tu azúcar esté baja. Come algo dulce ahora mismo — un jugo, unas galletas o un caramelo. Si no mejoras en 15 minutos, busca ayuda.',
    source: 'MINSA',
  },
  {
    id: 'kb-12',
    topic: 'visita al médico',
    keywords: ['doctor', 'medico', 'consulta', 'cita', 'revision', 'chequeo', 'control'],
    content:
      'Se recomienda visitar al médico cada 3 meses cuando la diabetes está controlada, o más seguido si hay cambios en el azúcar, nuevos síntomas o ajustes de medicación. Lleva tu registro de lecturas para que el doctor pueda ver cómo has estado.',
    source: 'MINSA',
  },
  {
    id: 'kb-13',
    topic: 'azúcar y alcohol',
    keywords: ['alcohol', 'cerveza', 'vino', 'trago', 'bebida alcoholica', 'chicha'],
    content:
      'El alcohol puede hacer que el azúcar baje de forma impredecible, especialmente si no comes al mismo tiempo. Si decides tomar, hazlo con moderación, siempre acompañado de comida, y avisa a alguien de confianza.',
    source: 'ADA',
  },
  {
    id: 'kb-14',
    topic: 'sal y presión',
    keywords: ['sal', 'salado', 'presion', 'presion alta', 'hipertension', 'sodio'],
    content:
      'Muchas personas con diabetes tipo 2 también tienen presión alta. Reducir la sal — usar menos en la cocina y evitar snacks muy salados — ayuda a controlar la presión y protege los riñones.',
    source: 'MINSA',
  },
  {
    id: 'kb-15',
    topic: 'control del peso',
    keywords: ['peso', 'bajar de peso', 'adelgazar', 'obesidad', 'imc'],
    content:
      'Bajar incluso un poco de peso — entre el 5 y 10% del peso corporal — puede mejorar significativamente el control del azúcar. No hace falta llegar a un peso ideal: cada kilo que bajas con salud ayuda.',
    source: 'ADA',
  },
];

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const QueryRagInput = z.object({
  query: z.string().min(1, 'query must not be empty'),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesKnowledgeBase(
  normalizedQuery: string,
): KnowledgeEntry | undefined {
  return KNOWLEDGE_BASE.find(
    (entry) =>
      entry.keywords.some((kw) => normalizedQuery.includes(normalize(kw))) ||
      normalize(entry.topic).split(' ').some((word) => normalizedQuery.includes(word)),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RagResult {
  content: string;
  source: string;
}

/**
 * Retrieve the most relevant answer for a free-text health question.
 *
 * Matching priority:
 *   1. If the query names a Peruvian food (via findFood), return that food's note
 *      with source "Tabla de alimentos".
 *   2. Otherwise, match against KNOWLEDGE_BASE keywords and topics.
 *   3. Returns null if no match is found.
 *
 * Every returned answer includes a source field.
 *
 * Throws ZodError on invalid (empty) query.
 *
 * TODO Phase 2: replace KNOWLEDGE_BASE matching with an Azure AI Search /
 * pgvector similarity query while keeping the function signature identical.
 */
export function queryRag(query: string): RagResult | null {
  QueryRagInput.parse({ query });

  const normQuery = normalize(query);

  // Priority 1: Peruvian food lookup
  const food = findFood(query);
  if (food) {
    return {
      content: food.note,
      source: 'Tabla de alimentos',
    };
  }

  // Priority 2: knowledge base keyword/topic match
  const entry = matchesKnowledgeBase(normQuery);
  if (entry) {
    return {
      content: entry.content,
      source: entry.source,
    };
  }

  return null;
}
