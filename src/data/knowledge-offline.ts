/**
 * Offline knowledge digest — concise, paraphrased Spanish snippets distilled
 * from the curated PDFs (docs/rag-docs/). Bundled in the SPA so education
 * questions get a real, cited answer with no signal. Never doses/diagnosis.
 *
 * Each entry: keywords are lowercase, accent-free tokens used for matching.
 * Content is paraphrased in warm, plain Peruvian Spanish for low-literacy
 * adults. Medication entries are reminders only — never doses, never diagnosis.
 */
export interface OfflineKnowledgeEntry {
  id: string;
  topic: string;
  keywords: string[];
  content: string;
  source: string;
}

export const KNOWLEDGE_OFFLINE: OfflineKnowledgeEntry[] = [
  // ── Método del plato ──────────────────────────────────────────────
  {
    id: 'off-plato',
    topic: 'método del plato',
    keywords: ['plato', 'metodo del plato', 'porcion', 'porciones', 'cuanto servir', 'como servir', 'como sirvo'],
    content:
      'El método del plato es una forma sencilla de servir: llena la mitad del plato con verduras, un cuarto con una proteína (pollo, pescado, huevo o menestras) y un cuarto con carbohidrato (arroz, papa, camote o fideos). Así controlas la cantidad sin necesidad de pesar la comida.',
    source: 'ADA — Método del plato',
  },
  {
    id: 'off-plato-2',
    topic: 'método del plato',
    keywords: ['verduras', 'ensalada', 'brocoli', 'mitad del plato', 'sin almidon'],
    content:
      'Llena la mitad del plato con verduras de las que tienen poco almidón, como ensalada de hojas verdes, brócoli, vainita, zanahoria o espinaca. Estas casi no suben el azúcar, así que puedes servirte buena cantidad y te llenan.',
    source: 'ADA — Método del plato',
  },
  {
    id: 'off-plato-3',
    topic: 'método del plato',
    keywords: ['tamano plato', 'plato nueve pulgadas', 'plato pequeno', 'medir comida', 'mano'],
    content:
      'Usa un plato del tamaño normal (como de nueve pulgadas), no uno muy grande. Una buena guía con la mano: una porción de carne o pescado es del tamaño de la palma; una porción de queso, del tamaño del pulgar. Sirve y guarda lo que sobra para después.',
    source: 'ADA — Planificación de comidas',
  },
  {
    id: 'off-plato-4',
    topic: 'método del plato',
    keywords: ['horarios', 'comer regular', 'saltarse comidas', 'cinco comidas', 'refrigerio', 'comidas balanceadas'],
    content:
      'Trata de comer a tus horas y no saltarte comidas, porque llegar con mucha hambre te hace comer de más. Reparte tus comidas en el día (por ejemplo desayuno, un refrigerio, almuerzo, otro refrigerio y cena) con cantidades parecidas de carbohidrato en cada una.',
    source: 'Guía clínica (MINSA)',
  },

  // ── Carbohidratos buenos ──────────────────────────────────────────
  {
    id: 'off-carbo-1',
    topic: 'carbohidratos buenos',
    keywords: ['carbohidrato', 'carbohidratos', 'arroz', 'papa', 'fideos', 'pan', 'azucar sube'],
    content:
      'Los carbohidratos (arroz, papa, fideos, pan, dulces) son los que más suben el azúcar. No los tienes que eliminar, pero sí cuidar la cantidad y elegir los integrales. Los carbohidratos integrales suben el azúcar más despacio porque tienen fibra.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-carbo-2',
    topic: 'carbohidratos buenos',
    keywords: ['integral', 'integrales', 'arroz integral', 'pan integral', 'quinua', 'avena', 'grano entero'],
    content:
      'Prefiere los granos enteros: arroz integral, quinua, avena o pan integral en vez de pan blanco, arroz blanco o fideos blancos. Al comprar pan o fideos, busca que diga "integral" como primer ingrediente; suben el azúcar más despacio y te llenan más.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-carbo-3',
    topic: 'carbohidratos buenos',
    keywords: ['jugo', 'fruta entera', 'naranja', 'jugo de fruta', 'tomar jugo'],
    content:
      'Mejor come la fruta entera que tomarla en jugo. Para un vaso de jugo de naranja se usan varias naranjas, así que entra mucha azúcar de golpe y se pierde la fibra. La fruta entera te llena más y sube el azúcar más despacio.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-carbo-4',
    topic: 'carbohidratos buenos',
    keywords: ['acompanar', 'proteina con carbohidrato', 'nueces', 'azucar de golpe'],
    content:
      'Cuando comas un carbohidrato, acompáñalo con algo de proteína o grasa buena, como un huevo, un poco de queso o un puñadito de nueces. Así el azúcar sube más despacio y te quedas satisfecho por más tiempo.',
    source: 'Guías de diabetes',
  },

  // ── Fibra ─────────────────────────────────────────────────────────
  {
    id: 'off-fibra-1',
    topic: 'fibra',
    keywords: ['fibra', 'integral', 'avena', 'menestra', 'menestras', 'frejol', 'lenteja', 'verdura', 'quinua'],
    content:
      'Los alimentos con fibra —avena, menestras, verduras, quinua, pan integral, frutas con cáscara— hacen que el azúcar suba más despacio después de comer. Trata de incluir algo de fibra en cada comida.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-fibra-2',
    topic: 'fibra',
    keywords: ['beneficio fibra', 'estrenimiento', 'colesterol', 'corazon', 'llenar', 'saciedad'],
    content:
      'La fibra es tu amiga: ayuda a controlar el azúcar, baja el colesterol, cuida tu corazón, mejora la digestión y te hace sentir lleno por más tiempo. La encuentras en frutas, verduras, granos enteros y menestras.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-fibra-3',
    topic: 'fibra',
    keywords: ['mas fibra', 'como agregar fibra', 'desayuno fibra', 'agregar menestras', 'cascara'],
    content:
      'Para sumar fibra: empieza el día con avena o pan integral, comienza el almuerzo con una ensalada, agrega lentejas o frejoles a tus sopas y guisos, y come frutas y verduras con cáscara cuando se pueda.',
    source: 'Guías de diabetes',
  },

  // ── Azúcares ocultos ──────────────────────────────────────────────
  {
    id: 'off-azucar-1',
    topic: 'azúcares ocultos',
    keywords: ['azucar oculta', 'azucares ocultos', 'azucar escondida', 'azucar agregada', 'productos'],
    content:
      'El azúcar no solo está en los dulces. Muchos productos envasados tienen azúcar escondida, hasta algunos salados como las salsas. Por eso conviene aprender a leer la etiqueta antes de comprar.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-azucar-2',
    topic: 'azúcares ocultos',
    keywords: ['etiqueta', 'leer etiqueta', 'etiqueta nutricional', 'ingredientes', 'azucares totales'],
    content:
      'En la etiqueta, mira los "azúcares totales" y la lista de ingredientes. Los ingredientes van del que más tiene al que menos; si un tipo de azúcar aparece al inicio, el producto tiene bastante azúcar agregada.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-azucar-3',
    topic: 'azúcares ocultos',
    keywords: ['nombres del azucar', 'jarabe', 'miel', 'glucosa', 'fructosa', 'sacarosa', 'osa'],
    content:
      'El azúcar tiene muchos nombres. Ojo con jarabes (de maíz, de arroz), miel, agave, melaza y casi todo lo que termina en "-osa" (glucosa, fructosa, sacarosa, dextrosa). Todos son azúcar agregada aunque suenen diferente.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-azucar-4',
    topic: 'azúcares ocultos',
    keywords: ['sin azucar', 'light', 'bajo en azucar', 'libre de azucar', 'procesado'],
    content:
      'Que diga "sin azúcar" o "bajo en azúcar" no significa que sea sano. Muchos de esos productos siguen siendo ultraprocesados y poco nutritivos. Cuando puedas, elige alimentos naturales como frutas y verduras en vez de productos envasados.',
    source: 'Guías de diabetes',
  },

  // ── Comer fuera de casa ───────────────────────────────────────────
  {
    id: 'off-fuera-1',
    topic: 'comer fuera de casa',
    keywords: ['comer fuera', 'restaurante', 'fuera de casa', 'salir a comer', 'pedir comida'],
    content:
      'Al comer fuera, decide antes qué vas a pedir para no tentarte. Las porciones de los restaurantes suelen ser grandes: come la mitad y pide que te empaqueten el resto para llevar. Toma un vaso grande de agua al sentarte.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-fuera-2',
    topic: 'comer fuera de casa',
    keywords: ['frito', 'a la parrilla', 'al horno', 'al vapor', 'salsas aparte', 'pedir saludable'],
    content:
      'Elige comida al horno, a la parrilla, asada o al vapor en vez de frita, empanizada o muy cremosa. Pide las salsas y aderezos aparte y usa solo un poquito. Cambia las papas fritas por verduras o ensalada.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-fuera-3',
    topic: 'comer fuera de casa',
    keywords: ['pan en la mesa', 'piqueo', 'chips', 'entrada', 'compartir plato'],
    content:
      'Si ponen pan o piqueos en la mesa antes de pedir, pide que se los lleven o sírvete poco. Comparte el plato principal o el postre con alguien, así disfrutas el sabor sin comer de más.',
    source: 'Guías de diabetes',
  },

  // ── Buffet ────────────────────────────────────────────────────────
  {
    id: 'off-buffet-1',
    topic: 'buffet',
    keywords: ['buffet', 'bufe', 'mesa de comida', 'todo lo que pueda comer', 'servirse'],
    content:
      'En un buffet, primero da una vuelta y mira todo antes de servirte. Luego elige uno o dos de tus platos favoritos y completa con opciones saludables. Sírvete porciones pequeñas de lo frito, dulce o muy graso.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-buffet-2',
    topic: 'buffet',
    keywords: ['armar plato buffet', 'verduras buffet', 'una sola vez', 'repetir'],
    content:
      'Arma tu plato como el método del plato: mitad de verduras, un cuarto de proteína sin grasa (pollo sin piel, pescado o frejoles) y un cuarto de carbohidrato. Con una sola pasada por la mesa suele ser suficiente; disfruta más de la compañía que de la comida.',
    source: 'Guías de diabetes',
  },

  // ── Postres ───────────────────────────────────────────────────────
  {
    id: 'off-postre-1',
    topic: 'postres',
    keywords: ['postre', 'postres', 'dulce', 'dulces', 'puedo comer postre', 'antojo'],
    content:
      'Tener diabetes no te prohíbe los postres para siempre. Con un poco de planificación puedes darte un gusto de vez en cuando y en poca cantidad. La clave es que sea ocasional, en porción pequeña y comerlo despacio para saborearlo.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-postre-2',
    topic: 'postres',
    keywords: ['cambiar postre', 'fruta de postre', 'chocolate amargo', 'sustituir dulce'],
    content:
      'Si te provoca algo dulce, prueba la fruta como postre, que llena y nutre. El chocolate amargo es una opción menos dulce que el de leche. Si vas a comer un postre, reduce otros carbohidratos (arroz, pan) en esa comida.',
    source: 'Guías de diabetes',
  },

  // ── Fiestas / Navidad ─────────────────────────────────────────────
  {
    id: 'off-fiesta-1',
    topic: 'fiestas y navidad',
    keywords: ['fiesta', 'fiestas', 'navidad', 'ano nuevo', 'celebracion', 'reunion'],
    content:
      'En fiestas, navidad o año nuevo puedes disfrutar sin descuidarte. Come cerca de tu hora habitual y no te saltes comidas para "ahorrar" para el festín, porque llegarías con mucha hambre. Llena al menos la mitad del plato con verduras.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-fiesta-2',
    topic: 'fiestas y navidad',
    keywords: ['comer despacio', 'repetir fiesta', 'paneton', 'alcohol fiesta', 'llevar plato'],
    content:
      'En las fiestas come despacio: el cuerpo tarda unos 20 minutos en avisar que ya está lleno, así que espera antes de repetir. Elige los platos que de verdad disfrutas. Si tomas alcohol, hazlo con moderación y nunca con el estómago vacío.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-fiesta-3',
    topic: 'fiestas y navidad',
    keywords: ['caminar despues de comer', 'moverse fiesta', 'actividad fiesta'],
    content:
      'Después de una comida grande de fiesta, una caminata corta, aunque sean 10 minutos, ayuda a digerir y a bajar el estrés. Invita a tu familia a acompañarte; moverse un poco siempre suma.',
    source: 'Guías de diabetes',
  },

  // ── Actividad física ──────────────────────────────────────────────
  {
    id: 'off-ejercicio-1',
    topic: 'actividad física',
    keywords: ['ejercicio', 'actividad fisica', 'caminar', 'caminata', 'moverse', 'que ejercicio'],
    content:
      'Moverte ayuda mucho: baja el azúcar porque tu cuerpo usa mejor la insulina, cuida tu corazón y te da ánimo. Algo tan simple como caminar a buen paso ya cuenta. Lo importante es hacerlo seguido y que sea algo que disfrutes.',
    source: 'OPS — Actividad física',
  },
  {
    id: 'off-ejercicio-2',
    topic: 'actividad física',
    keywords: ['cuanto ejercicio', '30 minutos', '150 minutos', 'cuanto caminar', 'frecuencia'],
    content:
      'Una buena meta es moverte unos 30 minutos casi todos los días, hasta llegar a unas 150 minutos a la semana, como una caminata rápida o montar bicicleta. Si recién empiezas, hazlo poquito a poco y aumenta de a pocos.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-ejercicio-3',
    topic: 'actividad física',
    keywords: ['ejercicio en casa', 'escaleras', 'sedentarismo', 'estar sentado', 'movimiento diario'],
    content:
      'No necesitas un gimnasio. Sube por las escaleras en vez del ascensor, camina a la tienda, baila tu música favorita o haz las labores de la casa. Lo clave es pasar menos tiempo sentado y moverte durante el día.',
    source: 'OPS — Actividad física',
  },
  {
    id: 'off-ejercicio-edad-1',
    topic: 'actividad física en edad avanzada',
    keywords: ['adulto mayor', 'edad avanzada', 'persona mayor', 'ejercicio mayores', 'tercera edad', 'abuelo'],
    content:
      'Las personas mayores con diabetes también ganan mucho moviéndose: mejoran la fuerza, el equilibrio y el ánimo, y se reducen las caídas. Conviene hacer actividad suave y segura, a su ritmo, e idealmente revisada por su personal de salud.',
    source: 'OPS — Actividad física (edad avanzada)',
  },
  {
    id: 'off-ejercicio-edad-2',
    topic: 'actividad física en edad avanzada',
    keywords: ['equilibrio', 'fuerza', 'caidas', 'fragil', 'levantarse', 'huesos'],
    content:
      'En la edad avanzada ayudan los ejercicios de fuerza y de equilibrio, como pararse y sentarse de una silla o caminatas cortas, para mantener los músculos y prevenir caídas. Empieza despacio y, si te sientes mal, descansa y avisa a tu médico.',
    source: 'OPS — Actividad física (edad avanzada)',
  },
  {
    id: 'off-ejercicio-4',
    topic: 'actividad física',
    keywords: ['zapatos ejercicio', 'revisar pies ejercicio', 'agua ejercicio', 'cuidado al hacer ejercicio'],
    content:
      'Para hacer ejercicio sin riesgo, usa calzado cómodo, toma agua y revisa tus pies después por si hay ampollas o heridas. Si tienes molestias, mareos o dolor en el pecho, detente y consulta a tu médico.',
    source: 'OPS — Actividad física',
  },

  // ── Cuidado de los pies ───────────────────────────────────────────
  {
    id: 'off-pies-1',
    topic: 'cuidado de los pies',
    keywords: ['pie', 'pies', 'herida', 'ampolla', 'unas', 'zapatos', 'callo', 'revisar pies'],
    content:
      'Revisa tus pies todos los días buscando heridas, ampollas o cambios de color. Lávalos y sécalos bien, sobre todo entre los dedos, y usa zapatos cómodos que no aprieten. Si ves una herida que no sana, consulta a tu médico ese mismo día.',
    source: 'OPS — Cuidado de los pies',
  },
  {
    id: 'off-pies-2',
    topic: 'cuidado de los pies',
    keywords: ['por que pies', 'neuropatia', 'no siento', 'hormigueo', 'ardor', 'perder sensibilidad'],
    content:
      'La diabetes puede dañar los nervios de los pies y hacer que pierdas sensibilidad. Por eso a veces no sientes una herida o una rozadura y se complica sin que te des cuenta. Si notas hormigueo, ardor o adormecimiento, cuéntale a tu médico.',
    source: 'OPS — Cuidado de los pies',
  },
  {
    id: 'off-pies-3',
    topic: 'cuidado de los pies',
    keywords: ['descalzo', 'caminar descalzo', 'agua caliente', 'cortar unas', 'medias', 'calzado'],
    content:
      'No camines descalzo, ni en casa, para no lastimarte sin sentirlo. Antes de ponerte los zapatos, revisa que no tengan piedritas adentro. Prueba el agua con la mano o el codo antes de lavarte, y corta las uñas con cuidado, rectas.',
    source: 'OPS — Cuidado de los pies',
  },
  {
    id: 'off-pies-4',
    topic: 'cuidado de los pies',
    keywords: ['herida no sana', 'urgencia pie', 'pie diabetico', 'ulcera', 'infeccion pie', 'enrojecimiento'],
    content:
      'Una herida en el pie que no cicatriza es una urgencia: en la diabetes sana lento y se infecta fácil. Si ves una llaga, enrojecimiento, hinchazón o mal olor, no esperes y busca atención médica lo antes posible.',
    source: 'OPS — Cuidado de los pies',
  },

  // ── Medicamentos (recordatorios, nunca dosis) ─────────────────────
  {
    id: 'off-medicamento-1',
    topic: 'medicamentos',
    keywords: ['medicamento', 'medicamentos', 'pastilla', 'pastillas', 'tomar remedio', 'tratamiento'],
    content:
      'Toma tus medicamentos tal como te los indicó tu médico, incluso los días que te sientas bien. Nunca cambies ni dejes tu tratamiento por tu cuenta: si quieres ajustar algo, conversa primero con tu médico.',
    source: 'CDC — Medicamentos',
  },
  {
    id: 'off-medicamento-2',
    topic: 'medicamentos',
    keywords: ['metformina', 'olvide pastilla', 'no dejar de tomar', 'sentirse bien', 'dejar medicamento'],
    content:
      'Aunque te sientas mejor, no dejes de tomar tu medicamento sin hablar con tu médico. Si te olvidaste de una toma o tienes dudas sobre cómo o cuándo tomarlo, pregúntale a tu médico o a tu farmacéutico; ellos te orientan.',
    source: 'CDC — Medicamentos',
  },
  {
    id: 'off-medicamento-3',
    topic: 'medicamentos',
    keywords: ['lista medicamentos', 'efectos', 'nauseas', 'avisar medico', 'mezclar remedios', 'vitaminas'],
    content:
      'Ten una lista de todo lo que tomas, incluso vitaminas o remedios para el dolor o el resfrío, y muéstrala a tu médico y farmacéutico, porque algunos no se llevan bien juntos. Avisa si sientes algo nuevo, como náuseas, picazón o malestar.',
    source: 'CDC — Medicamentos',
  },
  {
    id: 'off-medicamento-4',
    topic: 'medicamentos',
    keywords: ['guardar medicamento', 'farmaceutico', 'precio medicamento', 'ahorrar', 'preguntar farmacia'],
    content:
      'El farmacéutico puede ayudarte mucho: te explica para qué sirve cada medicamento, cómo guardarlo y, a veces, cómo gastar menos. Si tienes dificultad para pagar tus medicinas, coméntalo con tu médico o farmacéutico para buscar opciones.',
    source: 'CDC — Medicamentos',
  },

  // ── Complicaciones ────────────────────────────────────────────────
  {
    id: 'off-complicacion-1',
    topic: 'complicaciones',
    keywords: ['complicacion', 'complicaciones', 'prevenir', 'evitar complicaciones', 'cuidarse'],
    content:
      'Muchas complicaciones se pueden prevenir o retrasar. La receta es conocida: come saludable, muévete, toma tus medicamentos, no fumes y ve a tus controles. Mantener el azúcar y la presión cuidadas protege tu corazón, ojos, riñones y pies.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-complicacion-2',
    topic: 'complicaciones',
    keywords: ['vista', 'ojos', 'ceguera', 'retina', 'cataratas', 'examen de ojos'],
    content:
      'El azúcar alto por mucho tiempo puede dañar los ojos y afectar la vista. Por eso conviene hacerte un examen de los ojos una vez al año, o más seguido si tu médico lo indica, aunque veas bien.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-complicacion-3',
    topic: 'complicaciones',
    keywords: ['rinon', 'rinones', 'rinion', 'enfermedad renal', 'prueba de rinones'],
    content:
      'La diabetes puede dañar los riñones poco a poco y al inicio no se siente nada. Por eso es importante hacerte las pruebas de riñones que te pida tu médico y cuidar tu azúcar y tu presión.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-complicacion-4',
    topic: 'complicaciones',
    keywords: ['corazon', 'infarto', 'derrame', 'presion alta', 'colesterol', 'fumar'],
    content:
      'Las personas con diabetes tienen más riesgo de problemas del corazón y derrames. Cuidar la presión y el colesterol y dejar de fumar reduce mucho ese riesgo. Fumar duplica el peligro para el corazón, así que dejarlo ayuda bastante.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-complicacion-5',
    topic: 'complicaciones',
    keywords: ['encias', 'dientes', 'dental', 'boca', 'salud mental', 'animo', 'depresion'],
    content:
      'La diabetes también afecta las encías y los dientes, así que cuida tu boca y visita al dentista. Y si te sientes triste o sin ánimo, cuéntale a tu médico: el ánimo es parte de tu salud y también se puede atender.',
    source: 'Guías de diabetes',
  },

  // ── Citas y cuidado general ───────────────────────────────────────
  {
    id: 'off-cita-1',
    topic: 'citas y cuidado general',
    keywords: ['cita', 'citas', 'control', 'medico', 'consulta', 'chequeo', 'ir al doctor'],
    content:
      'Ve a tus controles aunque te sientas bien, porque muchas complicaciones avanzan sin avisar. En las visitas revisan tu presión, tu peso, tus pies y tu tratamiento. Atenderte a tiempo ayuda a prevenir problemas.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-cita-2',
    topic: 'citas y cuidado general',
    keywords: ['a1c', 'hemoglobina', 'control azucar', 'cada 3 meses', 'cada 6 meses', 'examenes'],
    content:
      'Lleva un registro de tus controles de azúcar y compártelo en tus citas. Tu médico te pedirá pruebas cada cierto tiempo (como la de hemoglobina A1c) y, una vez al año, exámenes de ojos, riñones, colesterol y un chequeo completo de los pies.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-cita-3',
    topic: 'citas y cuidado general',
    keywords: ['vacuna', 'gripe', 'influenza', 'neumonia', 'prevenir enfermedad'],
    content:
      'Las vacunas son parte del cuidado de tu diabetes. Conviene ponerte la vacuna de la gripe cada año y otras que te recomiende tu médico, porque una infección puede descontrolar tu azúcar.',
    source: 'Guías de diabetes',
  },
  {
    id: 'off-cuidado-diario',
    topic: 'citas y cuidado general',
    keywords: ['cada dia', 'rutina diaria', 'autocuidado', 'que hacer cada dia', 'habitos'],
    content:
      'Cada día puedes cuidarte así: revisa tu azúcar según te indiquen, mira tus pies, toma tus medicamentos, muévete un rato y come saludable. Pequeños hábitos repetidos cada día son los que mejor controlan la diabetes.',
    source: 'Guías de diabetes',
  },

  // ── Alimentos peruanos (qué comer / sustituir) ────────────────────
  {
    id: 'off-peru-1',
    topic: 'alimentos peruanos',
    keywords: ['alimentos peruanos', 'comida peruana', 'natural', 'casero', 'ultraprocesado', 'comida chatarra'],
    content:
      'En el Perú tenemos una rica variedad de alimentos naturales. Prefiere preparar comidas caseras con alimentos naturales y aprovecha nuestra cocina, en vez de productos ultraprocesados o comida chatarra como gaseosas, galletas y snacks de bolsa.',
    source: 'Guías alimentarias peruanas',
  },
  {
    id: 'off-peru-2',
    topic: 'alimentos peruanos',
    keywords: ['carnes blancas', 'pescado', 'pollo', 'carne roja', 'menestras proteina', 'huevo'],
    content:
      'Como proteína, prefiere pescado o carnes blancas como pollo o pavo, y come las carnes rojas con moderación, eligiendo cortes magros. Las menestras peruanas —frejol, lenteja, pallar, garbanzo— son una buena fuente de proteína y fibra.',
    source: 'Guía clínica (MINSA)',
  },
  {
    id: 'off-peru-3',
    topic: 'alimentos peruanos',
    keywords: ['tuberculos', 'papa', 'camote', 'yuca', 'oca', 'cereales integrales', 'carbohidrato complejo'],
    content:
      'Entre los carbohidratos, prefiere los complejos: tubérculos como papa, camote, yuca u oca, cereales integrales y menestras. Cuida la porción (un cuarto del plato) y, cuando puedas, combínalos con verduras para que el azúcar suba más despacio.',
    source: 'Guía clínica (MINSA)',
  },
  {
    id: 'off-peru-4',
    topic: 'alimentos peruanos',
    keywords: ['frutas y verduras', 'cinco porciones', 'verduras peru', 'frutas peru', 'porciones al dia'],
    content:
      'Trata de comer frutas y verduras varias veces al día (al menos cinco porciones). El Perú tiene mucha variedad: espinaca, vainita, zapallo, zanahoria, papaya, manzana o granadilla. Llénate de colores en el plato.',
    source: 'Guía clínica (MINSA)',
  },
  {
    id: 'off-peru-5',
    topic: 'alimentos peruanos',
    keywords: ['aceite', 'grasa buena', 'grasa saturada', 'manteca', 'frituras', 'sal'],
    content:
      'Para cocinar, usa aceites vegetales como oliva, girasol o canola y evita las grasas como manteca o aceite recalentado. Reduce la sal y no le agregues más sal a la comida ya servida. Prefiere preparaciones al horno, guisadas o al vapor antes que fritas.',
    source: 'Guía clínica (MINSA)',
  },
  {
    id: 'off-peru-6',
    topic: 'alimentos peruanos',
    keywords: ['agua', 'tomar agua', 'gaseosa', 'jugo envasado', 'bebida azucarada', 'que tomar'],
    content:
      'La mejor bebida es el agua. Evita las gaseosas y los jugos envasados, que tienen mucha azúcar. Si quieres algo con sabor, prueba agua con un toque de limón o infusiones sin azúcar.',
    source: 'Guía clínica (MINSA)',
  },
];
