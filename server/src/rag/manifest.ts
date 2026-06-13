export interface ManifestEntry {
  /** Exact PDF filename in docs/rag-docs/. */
  file: string;
  /** Stable short id used as the chunk id prefix and doc_id. */
  docId: string;
  /** Human source label shown in citations. */
  source: string;
  sourceUrl?: string;
  /** Topic tag (kebab-case). */
  topic: string;
  /** Whether this doc may feed the offline digest (false = too detailed/online-only). */
  offline: boolean;
}

export const MANIFEST: ManifestEntry[] = [
  { file: 'Metodo del plato (SEGUN LA ADA, american diabetes association).pdf', docId: 'plato-ada', source: 'ADA — Método del plato', topic: 'metodo-plato', offline: true },
  { file: 'Planificación de comidas para personas con diabetes (METODO DEL PLATO, lo primordial si se cocina).pdf', docId: 'planif-comidas', source: 'ADA — Planificación de comidas', topic: 'metodo-plato', offline: true },
  { file: 'Recomendaciones para carbohidratos buenos (mejorar su dieta).pdf', docId: 'carbohidratos', source: 'Guías de diabetes', topic: 'carbohidratos', offline: true },
  { file: 'Recomendaciones para comer fibra (carbohidrato que ayuda a manejar la diabetes).pdf', docId: 'fibra', source: 'Guías de diabetes', topic: 'fibra', offline: true },
  { file: 'Cómo identificar azúcares ocultos en los alimentos comunes.pdf', docId: 'azucares-ocultos', source: 'Guías de diabetes', topic: 'azucares-ocultos', offline: true },
  { file: 'Recomendaciones para comer en un buffet (si puede, solo hay que enseñarle como).pdf', docId: 'buffet', source: 'Guías de diabetes', topic: 'comer-fuera', offline: true },
  { file: 'Recomendaciones para comer fuera de casa.pdf', docId: 'comer-fuera', source: 'Guías de diabetes', topic: 'comer-fuera', offline: true },
  { file: 'Recomendaciones para comer postres en diabeticos.pdf', docId: 'postres', source: 'Guías de diabetes', topic: 'postres', offline: true },
  { file: 'Alimentacion en diabetes en fiestas, navidad, año nuevo.pdf', docId: 'fiestas', source: 'Guías de diabetes', topic: 'fiestas', offline: true },
  { file: 'Recomendaciones de actividad fisica en diabetes OPS.pdf', docId: 'actividad-ops', source: 'OPS — Actividad física', topic: 'actividad-fisica', offline: true },
  { file: 'Recomendaciones sobre actividad fisica en edad avanzada.pdf', docId: 'actividad-edad', source: 'OPS — Actividad física (edad avanzada)', topic: 'actividad-fisica', offline: true },
  { file: 'Recomendaciones para el autocuidado de los pies - OPS.pdf', docId: 'pies-ops', source: 'OPS — Cuidado de los pies', topic: 'cuidado-pies', offline: true },
  { file: 'Recomendaciones sobre sus medicamentos para la diabetes _ Diabetes _ CDC.pdf', docId: 'medicamentos-cdc', source: 'CDC — Medicamentos', topic: 'medicamentos', offline: true },
  { file: 'Recomendaciones para el cuidado de su diabetes (citas con el medico, complicaciones).pdf', docId: 'cuidado-diabetes', source: 'Guías de diabetes', topic: 'cuidado-general', offline: true },
  { file: 'Recomendaciones para evitar las complicaciones.pdf', docId: 'complicaciones', source: 'Guías de diabetes', topic: 'complicaciones', offline: true },
  { file: 'Guia diagnostico, clinico y tratamiento (recomendaciones alimentarias).pdf', docId: 'guia-clinica', source: 'Guía clínica (MINSA)', topic: 'recomendaciones-alimentarias', offline: true },
  { file: 'Guias alimentarias en la poblacion peruana (de aca se saca los alimentos que hay en el peru, no la información de alimentacion de la diabetes).pdf', docId: 'guias-peru', source: 'Guías alimentarias peruanas', topic: 'alimentos-peru', offline: true },
  { file: 'Tablas peruanas de composición de alimentos (alimentos peruanos al detallado, su energia, kcal, etc, opcional, mas detallado).pdf', docId: 'tablas-composicion', source: 'Tablas peruanas de composición', topic: 'composicion-alimentos', offline: false },
];

export function manifestFor(file: string): ManifestEntry | undefined {
  return MANIFEST.find((m) => m.file === file);
}
