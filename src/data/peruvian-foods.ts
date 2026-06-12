/**
 * Reference database of common Peruvian foods with approximate carbohydrate
 * content, glycemic index, and a plain-Spanish note for the Khumpi agent.
 *
 * Portions are typical Peruvian restaurant / home servings.
 * Carb values are approximate — for guidance only, not clinical dosing.
 * GI categories: bajo <55, medio 55–70, alto >70.
 *
 * NOTE: user-facing `note` strings are in plain Peruvian Spanish as required
 * by the project i18n contract ("tu azúcar", never "glucemia").
 */

export interface PeruvianFood {
  /** Display name as the patient would say it. */
  name: string;
  /** Typical portion description, e.g. "1 plato regular". */
  portion: string;
  /** Approximate carbohydrates in grams for that portion. */
  carbs_g: number;
  /** Glycemic index category. */
  glycemicIndex: 'bajo' | 'medio' | 'alto';
  /**
   * Plain-Spanish note for the agent to share, e.g. food combinations,
   * tips, or why this food matters for blood sugar.
   */
  note: string;
}

export const PERUVIAN_FOODS: PeruvianFood[] = [
  {
    name: 'arroz con pollo',
    portion: '1 plato regular',
    carbs_g: 65,
    glycemicIndex: 'alto',
    note: 'El arroz eleva tu azúcar más rápido que el pollo — combina con ensalada verde para que suba más despacio.',
  },
  {
    name: 'pollo a la brasa',
    portion: '¼ pollo con papas',
    carbs_g: 45,
    glycemicIndex: 'medio',
    note: 'Las papas fritas suben bastante el azúcar. Pide ensalada en vez de papas si puedes.',
  },
  {
    name: 'menú del día',
    portion: '1 menú completo (sopa + segundo)',
    carbs_g: 80,
    glycemicIndex: 'alto',
    note: 'El menú de restaurante suele tener arroz, fideos y pan juntos — eso es mucho carbohidrato de golpe. Deja un poco del arroz si puedes.',
  },
  {
    name: 'pan con palta',
    portion: '2 panes medianos con palta',
    carbs_g: 40,
    glycemicIndex: 'medio',
    note: 'La palta tiene grasa buena que frena un poco la subida del azúcar. Mejor que pan con mantequilla.',
  },
  {
    name: 'tallarines verdes',
    portion: '1 plato regular con bistec',
    carbs_g: 70,
    glycemicIndex: 'alto',
    note: 'Los fideos suben el azúcar bastante. Pide porción pequeña y combina con bastante ensalada.',
  },
  {
    name: 'sopa de pollo',
    portion: '1 plato hondo',
    carbs_g: 15,
    glycemicIndex: 'bajo',
    note: 'Buena opción — poca papa y buen caldo. La sopa de entrada llena sin subir mucho el azúcar.',
  },
  {
    name: 'ceviche',
    portion: '1 plato regular',
    carbs_g: 12,
    glycemicIndex: 'bajo',
    note: 'Muy buen plato para la diabetes — poca grasa, poco carbohidrato. El limón y el camote vienen aparte; con moderación van bien.',
  },
  {
    name: 'lomo saltado',
    portion: '1 plato con arroz y papas',
    carbs_g: 60,
    glycemicIndex: 'alto',
    note: 'Rico en proteína, pero el arroz y las papas elevan bastante el azúcar. Si puedes, pide solo con ensalada.',
  },
  {
    name: 'papa a la huancaína',
    portion: '2 papas medianas con salsa',
    carbs_g: 35,
    glycemicIndex: 'alto',
    note: 'La papa tiene índice glucémico alto — mejor comerla como entrada pequeña, no como plato principal.',
  },
  {
    name: 'causa limeña',
    portion: '1 porción mediana',
    carbs_g: 40,
    glycemicIndex: 'alto',
    note: 'Hecha de papa y limón, sube el azúcar moderadamente. Una porción pequeña está bien.',
  },
  {
    name: 'aji de gallina',
    portion: '1 plato con arroz',
    carbs_g: 55,
    glycemicIndex: 'medio',
    note: 'La salsa de ají amarillo con pan tiene carbohidratos; el arroz lo añade más. Porción moderada va bien.',
  },
  {
    name: 'tamal',
    portion: '1 tamal mediano',
    carbs_g: 35,
    glycemicIndex: 'medio',
    note: 'El maíz molido sube el azúcar de manera moderada. Uno está bien; dos ya es bastante carbohidrato.',
  },
  {
    name: 'chicha morada',
    portion: '1 vaso (250ml)',
    carbs_g: 28,
    glycemicIndex: 'alto',
    note: 'Tiene azúcar añadida. Prefiere la preparada en casa con menos azúcar, o toma agua con la comida.',
  },
  {
    name: 'quinua',
    portion: '½ taza cocida',
    carbs_g: 20,
    glycemicIndex: 'bajo',
    note: 'Excelente opción — tiene proteína y fibra que frenan la subida del azúcar. Muy recomendable.',
  },
  {
    name: 'camote',
    portion: '1 camote mediano',
    carbs_g: 27,
    glycemicIndex: 'medio',
    note: 'Más amigable que la papa blanca para el azúcar. La fibra de la cáscara ayuda a que suba más despacio.',
  },
  {
    name: 'yuca',
    portion: '1 taza cocida',
    carbs_g: 38,
    glycemicIndex: 'alto',
    note: 'La yuca sube bastante el azúcar — más que la papa. Mejor comerla en poca cantidad y hervida, no frita.',
  },
  {
    name: 'choclo',
    portion: '1 mazorca mediana',
    carbs_g: 25,
    glycemicIndex: 'medio',
    note: 'El choclo peruano es más grande que el maíz importado. Una mazorca es una ración razonable.',
  },
  {
    name: 'frejoles',
    portion: '½ taza cocida',
    carbs_g: 20,
    glycemicIndex: 'bajo',
    note: 'Excelente fuente de fibra y proteína. Los frejoles ayudan a estabilizar el azúcar — inclúyelos en tu dieta.',
  },
  {
    name: 'lentejas',
    portion: '½ taza cocida',
    carbs_g: 20,
    glycemicIndex: 'bajo',
    note: 'Como los frejoles, las lentejas son muy buenas para la diabetes. Sacia y no sube mucho el azúcar.',
  },
  {
    name: 'arroz blanco',
    portion: '1 taza cocida',
    carbs_g: 45,
    glycemicIndex: 'alto',
    note: 'El arroz blanco sube el azúcar rápido. Si puedes, reduce la porción y añade más verduras al plato.',
  },
  {
    name: 'papa sancochada',
    portion: '1 papa mediana',
    carbs_g: 30,
    glycemicIndex: 'alto',
    note: 'Hervida es mejor que frita, pero sigue subiendo bastante el azúcar. Combínala con proteína para moderar la subida.',
  },
  {
    name: 'avena',
    portion: '1 taza preparada',
    carbs_g: 28,
    glycemicIndex: 'medio',
    note: 'Muy buen desayuno — la fibra de la avena frena la subida del azúcar. Prepárala sin mucha azúcar.',
  },
  {
    name: 'pan francés',
    portion: '2 panes',
    carbs_g: 30,
    glycemicIndex: 'alto',
    note: 'El pan blanco peruano sube el azúcar rápido. Acompaña con palta o huevo para frenar la subida.',
  },
  {
    name: 'seco de pollo',
    portion: '1 plato con frejoles y arroz',
    carbs_g: 65,
    glycemicIndex: 'alto',
    note: 'Rico en proteína, pero el arroz eleva bastante el azúcar. Los frejoles ayudan; deja la mitad del arroz si puedes.',
  },
  {
    name: 'ensalada mixta',
    portion: '1 plato grande',
    carbs_g: 8,
    glycemicIndex: 'bajo',
    note: 'Perfecta para acompañar cualquier plato. Llena sin subir el azúcar. Más ensalada, menos arroz.',
  },
  {
    name: 'huevo frito',
    portion: '2 huevos',
    carbs_g: 1,
    glycemicIndex: 'bajo',
    note: 'Casi sin carbohidratos. Un excelente complemento del desayuno para no subir el azúcar.',
  },
  {
    name: 'mazamorra morada',
    portion: '1 taza',
    carbs_g: 45,
    glycemicIndex: 'alto',
    note: 'El postre tradicional tiene bastante azúcar y maicena. Una porcita pequeña de vez en cuando, no todos los días.',
  },
  {
    name: 'arroz con leche',
    portion: '1 taza',
    carbs_g: 48,
    glycemicIndex: 'alto',
    note: 'Azúcar y arroz juntos elevan bastante el azúcar. Mejor reservarlo para ocasiones especiales.',
  },
  {
    name: 'picarones',
    portion: '3 picarones medianos',
    carbs_g: 55,
    glycemicIndex: 'alto',
    note: 'Fritos y con miel — suben mucho el azúcar. Mejor disfrutar uno solo en ocasiones especiales.',
  },
  {
    name: 'emoliente',
    portion: '1 vaso (300ml)',
    carbs_g: 15,
    glycemicIndex: 'bajo',
    note: 'Bebida de hierbas andinas. Pídelo con poca azúcar o sin azúcar — así es muy amigable para el azúcar.',
  },
];

/**
 * Find a food entry by name, case-insensitive and accent-insensitive.
 *
 * Uses a simple substring match after normalizing both the query and
 * food names to remove diacritical marks (e.g. "arroz" matches "Arroz").
 *
 * @param query - Free-text user input, e.g. "tallarines verdes"
 * @returns The first matching PeruvianFood, or undefined if no match.
 */
export function findFood(query: string): PeruvianFood | undefined {
  // Normalize: lowercase + remove combining diacritical marks (accents)
  const normalize = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');

  const normalizedQuery = normalize(query);

  return PERUVIAN_FOODS.find((food) => {
    const normalizedName = normalize(food.name);
    // Primary: the food name appears within the (possibly longer) query string —
    // handles conversational input like "¿puedo comer arroz con pollo?".
    if (normalizedQuery.includes(normalizedName)) return true;
    // Fallback: the original direction — query is contained within the food name —
    // keeps single-word partial lookups working.
    return normalizedName.includes(normalizedQuery);
  });
}
