/**
 * ATELIER · Catálogo Unificado de Dominio (Integración de las 7 Apps Originales)
 * 1) kora-4k-avatar-gen: 13 Arquetipos Supermodelo + 23 atributos DNA + Panel de 5 Expresiones
 * 2) virtual-product-stylist: Categorías + Plantillas de Guión y Escenas Editoriales
 * 3) clonaci_n-3d-fotorrealista-de-prendas-de-vestir: Vistas 3D + Modos Avatar / Flotante
 * 4) pose-manual: Dirección de Pose por Categoría, Plano, Ángulo, Actitud e Intención
 * 5) virtual-stylist-pro: 5 Style Presets + 16 Tipos de Tela + Foco Estructural por Prenda
 * 6) clone-studio: 8 Poses Esqueléticas (13 ángulos) + 15 Fondos Studio/Outdoor/Minimal + Fashion Safety
 * 7) catalog-maker: 21 Plantillas Haute Couture (1 a 9 celdas) + Modos de Encuadre + Resoluciones
 */

export interface SupermodelArchetype {
  id: string;
  name: string;
  description: string;
  dna: {
    ethnicity: string;
    skin_tone: string;
    hair_color: string;
    hair_style: string;
    eye_color: string;
    body_type: string;
    age_apparent: number;
    height_m: number;
    facial_features: string[];
    makeup: string;
  };
  prompts: {
    panel: string;
    ecommerce: string;
  };
}

export const SUPERMODEL_ARCHETYPES: SupermodelArchetype[] = [
  {
    id: 'KORA-01',
    name: '01) KORA-01 · Andina Mediterránea',
    description: 'Andina-mediterránea moderna, pómulos altos, piel oliva clara luminosa, cabello castaño oscuro liso.',
    dna: {
      ethnicity: 'Andean-Mediterranean',
      skin_tone: 'olive',
      hair_color: 'dark brown',
      hair_style: 'long straight',
      eye_color: 'hazel',
      body_type: 'slender',
      age_apparent: 24,
      height_m: 1.78,
      facial_features: ['high cheekbones', 'almond eyes', 'defined jawline'],
      makeup: 'natural editorial',
    },
    prompts: {
      panel:
        'Hoja de referencia horizontal (16:9) dividida en 5 paneles verticales sobre fondo blanco puro (#FFFFFF): 1) Retrato frontal directo, 2) Perfil 3/4 izquierdo, 3) Perfil lateral 90°, 4) Pose editorial con manos cerca del rostro, 5) Mirada sobre el hombro. Mujer joven 23-26 años de belleza andino-mediterránea moderna, pómulos altos, ojos almendrados avellana, piel oliva clara con textura de poros reales, cabello castaño oscuro liso con raya al medio.',
      ecommerce:
        'Fotografía editorial e-commerce de cuerpo entero (3:4) de KORA-01 sobre fondo blanco puro (#FFFFFF), postura erguida natural con peso sutil en una cadera, piel oliva clara con micro-textura real, cabello castaño oscuro liso brillante, iluminación de estudio de 5 puntos.',
    },
  },
  {
    id: 'LINA-02',
    name: '02) LINA-02 · Nórdica Báltica',
    description: 'Nórdica-báltica minimalista, piel porcelana neutra, ojos gris-azulados, cabello rubio ceniza.',
    dna: {
      ethnicity: 'Nordic-Baltic',
      skin_tone: 'fair',
      hair_color: 'ash blonde',
      hair_style: 'sleek low bun',
      eye_color: 'grey-blue',
      body_type: 'slender',
      age_apparent: 25,
      height_m: 1.80,
      facial_features: ['sculpted cheekbones', 'straight nose', 'serene expression'],
      makeup: 'minimalist dewy',
    },
    prompts: {
      panel:
        'Hoja de referencia horizontal (16:9) con 5 tomas de la misma modelo nórdica-báltica (LINA-02) sobre blanco puro (#FFFFFF): frontal, 3/4, perfil, manos al rostro y sobre el hombro. Piel clara neutra con textura real sin retoque plástico, ojos gris-azulados, cabello rubio ceniza recogido en moño bajo pulido.',
      ecommerce:
        'Retrato de cuerpo entero e-commerce (3:4) de LINA-02 sobre fondo blanco #FFFFFF, estética escandinava minimalista, piel clara con poros visibles, cabello rubio ceniza, postura editorial limpia.',
    },
  },
  {
    id: 'SORA-03',
    name: '03) SORA-03 · Asiática Oriental',
    description: 'Asiática oriental contemporánea, piel marfil luminosa, corte bob asimétrico negro azabache.',
    dna: {
      ethnicity: 'East Asian',
      skin_tone: 'light',
      hair_color: 'jet black',
      hair_style: 'wavy bob',
      eye_color: 'dark brown',
      body_type: 'slender',
      age_apparent: 23,
      height_m: 1.76,
      facial_features: ['delicate bone structure', 'monolid almond eyes', 'clean brow line'],
      makeup: 'glass skin editorial',
    },
    prompts: {
      panel:
        'Hoja de contacto horizontal (16:9) de 5 paneles con la misma modelo asiática oriental (SORA-03) en blanco puro (#FFFFFF): frontal, 3/4, perfil 90°, detalle manos y mirada sobre el hombro. Piel marfil luminosa con textura natural, cabello negro azabache en corte bob limpio.',
      ecommerce:
        'Toma de catálogo cuerpo entero (3:4) de SORA-03 en estudio blanco #FFFFFF, silueta arquitectónica vanguardista, cabello bob negro azabache, piel marfil realista.',
    },
  },
  {
    id: 'VALE-04',
    name: '04) VALE-04 · Latina Caribeña',
    description: 'Afro-latina caribeña, piel bronce dorada cálida, rizos definidos con volumen, rasgos expresivos.',
    dna: {
      ethnicity: 'Afro-Latina Caribbean',
      skin_tone: 'tan',
      hair_color: 'dark brown',
      hair_style: 'curly',
      eye_color: 'amber brown',
      body_type: 'athletic',
      age_apparent: 25,
      height_m: 1.77,
      facial_features: ['full lips', 'radiant cheekbones', 'amber eyes'],
      makeup: 'warm bronze glow',
    },
    prompts: {
      panel:
        'Hoja de identidad horizontal (16:9) en 5 paneles sobre fondo blanco (#FFFFFF) de VALE-04: frontal, 3/4, perfil, manos y mirada sobre el hombro. Piel bronce dorada cálida con poros reales, cabello rizado definido con volumen controlado, ojos ámbar.',
      ecommerce:
        'Toma de cuerpo entero e-commerce (3:4) de VALE-04 sobre fondo blanco puro #FFFFFF, porte atlético y elegante, piel bronce dorada realista.',
    },
  },
  {
    id: 'NAYA-05',
    name: '05) NAYA-05 · Franco-Marroquí',
    description: 'Mediterránea franco-marroquí, piel oliva dorada, ojos verdes almendrados, ondas suaves.',
    dna: {
      ethnicity: 'Mediterranean North-African',
      skin_tone: 'olive',
      hair_color: 'chestnut brown',
      hair_style: 'soft editorial waves',
      eye_color: 'green',
      body_type: 'curvy',
      age_apparent: 26,
      height_m: 1.75,
      facial_features: ['defined eyebrows', 'green almond eyes', 'sculpted lips'],
      makeup: 'satin editorial',
    },
    prompts: {
      panel:
        'Hoja de referencia horizontal (16:9) con 5 ángulos consistentes de NAYA-05 en fondo blanco (#FFFFFF). Rasgos franco-marroquíes, piel oliva dorada con micro-textura real, ojos verdes, cabello castaño en ondas suaves.',
      ecommerce:
        'Fotografía e-commerce de cuerpo entero (3:4) de NAYA-05 sobre fondo blanco #FFFFFF, iluminación de estudio equilibrada.',
    },
  },
  {
    id: 'MIRA-06',
    name: '06) MIRA-06 · Indo-Británica',
    description: 'Surasiática contemporánea, piel caramelo cálida, ojos oscuros profundos, melena negra larga.',
    dna: {
      ethnicity: 'South Asian',
      skin_tone: 'tan',
      hair_color: 'black',
      hair_style: 'long straight',
      eye_color: 'dark brown',
      body_type: 'slender',
      age_apparent: 24,
      height_m: 1.76,
      facial_features: ['sharp jawline', 'deep-set expressive eyes', 'aquiline nose'],
      makeup: 'soft matte natural',
    },
    prompts: {
      panel:
        'Hoja de identidad 16:9 de 5 paneles en blanco puro (#FFFFFF) de MIRA-06: frontal, 3/4, perfil, manos al rostro y giro sobre el hombro. Piel caramelo cálida con textura natural de poros, cabello negro largo brillante.',
      ecommerce:
        'Fotografía de cuerpo entero (3:4) de MIRA-06 en ciclorama blanco #FFFFFF, postura de pasarela serena.',
    },
  },
  {
    id: 'TESSA-07',
    name: '07) TESSA-07 · Celta Pelirroja',
    description: 'Celta contemporánea, piel clara con pecas naturales sutiles, cabello cobrizo, ojos verdes.',
    dna: {
      ethnicity: 'Celtic Irish',
      skin_tone: 'fair',
      hair_color: 'copper red',
      hair_style: 'long wavy',
      eye_color: 'emerald green',
      body_type: 'slender',
      age_apparent: 22,
      height_m: 1.79,
      facial_features: ['natural freckles across nose', 'high cheekbones', 'emerald eyes'],
      makeup: 'bare skin editorial',
    },
    prompts: {
      panel:
        'Hoja de referencia 16:9 con 5 vistas consistentes de TESSA-07 sobre blanco #FFFFFF. Piel muy clara con pecas naturales reales y poros visibles, cabello cobrizo largo, ojos verde esmeralda.',
      ecommerce:
        'Toma e-commerce 3:4 de cuerpo entero de TESSA-07 en fondo blanco #FFFFFF, pecas y textura dérmica preservadas.',
    },
  },
  {
    id: 'INES-08',
    name: '08) INES-08 · Ibérica Clásica',
    description: 'Ibérica de alta costura, estructura ósea marcada, piel beige neutra, cabello castaño recogido.',
    dna: {
      ethnicity: 'Southern European Iberian',
      skin_tone: 'medium',
      hair_color: 'dark brown',
      hair_style: 'ponytail',
      eye_color: 'brown',
      body_type: 'athletic',
      age_apparent: 27,
      height_m: 1.78,
      facial_features: ['aristocratic bone structure', 'strong eyebrows', 'defined chin'],
      makeup: 'editorial neutral',
    },
    prompts: {
      panel:
        'Hoja de contacto 16:9 en 5 paneles sobre blanco #FFFFFF de INES-08: frontal, 3/4, perfil, manos y hombro. Belleza ibérica clásica, coleta baja pulida, piel beige neutra con textura hiperrealista.',
      ecommerce:
        'Fotografía de catálogo 3:4 cuerpo entero de INES-08 en fondo blanco #FFFFFF, porte arquitectónico de alta costura.',
    },
  },
  {
    id: 'DARIA-09',
    name: '09) DARIA-09 · Eslava Editorial',
    description: 'Europa del Este, pómulos esculturales, cabello rubio platino corto pixie, mirada magnética.',
    dna: {
      ethnicity: 'Eastern European Slavic',
      skin_tone: 'light',
      hair_color: 'platinum blonde',
      hair_style: 'short pixie',
      eye_color: 'ice blue',
      body_type: 'slender',
      age_apparent: 24,
      height_m: 1.81,
      facial_features: ['hollow cheeks', 'piercing blue eyes', 'androgynous elegance'],
      makeup: 'high-fashion minimal',
    },
    prompts: {
      panel:
        'Hoja de identidad 16:9 con 5 paneles en blanco puro (#FFFFFF) de DARIA-09: corte pixie rubio platino, ojos azul hielo, pómulos esculturales, piel clara con poros visibles.',
      ecommerce:
        'Toma de cuerpo entero 3:4 de DARIA-09 en estudio blanco #FFFFFF, postura de alta moda vanguardista.',
    },
  },
  {
    id: 'ZURI-10',
    name: '10) ZURI-10 · Ébano Escultural',
    description: 'Africana subsahariana de pasarela internacional, piel ébano profunda con brillos especulares reales.',
    dna: {
      ethnicity: 'Sub-Saharan African',
      skin_tone: 'dark',
      hair_color: 'black',
      hair_style: 'short close-cropped',
      eye_color: 'dark brown',
      body_type: 'slender',
      age_apparent: 24,
      height_m: 1.80,
      facial_features: ['regal neck', 'symmetrical high cheekbones', 'luminous dark skin'],
      makeup: 'luminous skin highlight',
    },
    prompts: {
      panel:
        'Hoja de referencia horizontal (16:9) de 5 paneles en blanco puro (#FFFFFF) de ZURI-10: frontal, 3/4, perfil 90°, manos al rostro y giro sobre el hombro. Piel ébano profunda con reflectancia especular natural y poros reales, cabello corto al ras.',
      ecommerce:
        'Fotografía editorial e-commerce 3:4 de cuerpo entero de ZURI-10 en estudio blanco #FFFFFF, iluminación calibrada para piel oscura.',
    },
  },
  {
    id: 'chilean_editorial',
    name: '11) Cono Sur Editorial · Chile/Argentina',
    description: 'Castiza contemporánea del Cono Sur, piel clara-media neutra, cabello castaño liso, look comercial.',
    dna: {
      ethnicity: 'South American Southern Cone',
      skin_tone: 'medium',
      hair_color: 'medium brown',
      hair_style: 'long straight',
      eye_color: 'hazel',
      body_type: 'commercial',
      age_apparent: 25,
      height_m: 1.74,
      facial_features: ['natural smile lines', 'harmonious proportions'],
      makeup: 'commercial fresh',
    },
    prompts: {
      panel:
        'Hoja de contacto 16:9 de 5 paneles en blanco puro (#FFFFFF) de modelo editorial del Cono Sur: frontal, 3/4, perfil, manos y hombro. Piel media neutra hiperrealista, cabello castaño liso.',
      ecommerce:
        'Catálogo comercial 3:4 cuerpo entero sobre fondo blanco #FFFFFF, actitud fresca y cercana.',
    },
  },
];

export const EXPRESSIONS_PANEL_LIST = [
  '1. Curiosidad (cabeza ligeramente inclinada, cejas sutilmente levantadas)',
  '2. Confianza (mirada directa, mentón firme, media sonrisa serena)',
  '3. Diversión Sutil (sonrisa suave en los ojos, comisuras relajadas)',
  '4. Pensativo (mirada ligeramente desviada, rostro relajado e introspectivo)',
  '5. Juguetón (expresión dinámica y espontánea de editorial de moda)',
];

/* ============================================================================
 * 4) MANUAL DE DIRECCIÓN DE POSE (Categorías, Planos, Ángulos y Actitudes)
 * ========================================================================== */
export const POSE_CATEGORIES: Record<string, string[]> = {
  Tops: ['Poleras', 'Blusas', 'Camisas', 'Crop tops', 'Bodies'],
  Bottoms: ['Pantalones', 'Jeans', 'Faldas', 'Shorts', 'Leggings'],
  Chaquetas: ['Blazers', 'Chaquetas', 'Abrigos', 'Parkas', 'Trench'],
  Tejidos: ['Sweaters', 'Cardigans', 'Chalecos', 'Polerones'],
  Vestidos: ['Vestidos cortos', 'Vestidos midi', 'Vestidos largos', 'Enteritos'],
  Conjuntos: ['Dos piezas', 'Sastrería', 'Set deportivo'],
  Accesorios: ['Bolsos', 'Cinturones', 'Pañuelos', 'Joyería'],
};

export const POSE_FRAME_TYPES = [
  'Frontal 1',
  'Frontal 2',
  'Lateral',
  'Espalda',
  'Cuerpo completo',
  'Close-up o detalle',
] as const;

export const POSE_PLANES = [
  'Plano entero (Full shot)',
  'Plano americano (3/4 rodillas arriba)',
  'Plano medio (Cintura arriba)',
  'Plano medio corto (Pecho arriba)',
  'Primer plano detalle textil',
] as const;

export const POSE_CAMERA_ANGLES = [
  'Nivel de ojos (Eye-level neutro)',
  'Contrapicado sutil (Estiliza silueta)',
  'Tres cuartos (3/4 editorial)',
  'Cenital / Detalle',
] as const;

export const POSE_ATTITUDES = [
  'Segura y natural',
  'Relajada y orgánica',
  'Sofisticada de pasarela',
  'Dinámica en movimiento',
  'Minimalista y serena',
] as const;

export const POSE_SUGGESTIONS: Record<string, { pose: string; focus: string }> = {
  Tops: {
    pose: 'Torso despejado hacia cámara, hombros relajados y brazos ligeramente separados para no cubrir costuras ni escote.',
    focus: 'Caída sobre el pecho, construcción del cuello/escote, calce de hombros y terminación de mangas.',
  },
  Bottoms: {
    pose: 'Peso apoyado en una pierna con la otra ligeramente adelantada para definir tiro, pretina y caída de pierna.',
    focus: 'Calce en cintura y cadera, largo de pierna, basta y estructura de bolsillos.',
  },
  Chaquetas: {
    pose: 'Postura estructurada con una mano sutilmente en bolsillo o solapa sin deformar los hombros.',
    focus: 'Estructura de hombreras, solapa, botonadura frontal, forro y caída del faldón.',
  },
  Tejidos: {
    pose: 'Postura cálida y orgánica con ligera flexión de brazo para apreciar el volumen y elasticidad del punto.',
    focus: 'Trama del tejido, cuello, puños acanalados y caída suave sobre el torso.',
  },
  Vestidos: {
    pose: 'Giro sutil de cadera y paso suave hacia adelante para mostrar el movimiento y vuelo de la falda.',
    focus: 'Silueta continua de hombros a ruedo, entalle en cintura y fluidez del textil.',
  },
  Conjuntos: {
    pose: 'Plano entero equilibrado que muestre la proporción entre la pieza superior e inferior sin solapamientos forzados.',
    focus: 'Coordinación cromática, transición en cintura y proporción global del look.',
  },
  Accesorios: {
    pose: 'Encuadre limpio donde la mano o el torso enmarca el accesorio sin competir visualmente.',
    focus: 'Herrajes, costuras, textura del material y escala real respecto al cuerpo.',
  },
};

/* ============================================================================
 * 5) VIRTUAL STYLIST PRO (5 Style Presets + 16 Tipos de Tela + Focus)
 * ========================================================================== */
export interface StylePreset {
  id: string;
  name: string;
  description: string;
  settings: {
    drape: number;
    wrinkle: number;
    sheen: 'matte' | 'subtle sheen' | 'glossy';
    texture: number;
    lighting: string;
    focus: string;
  };
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'minimalist',
    name: 'Minimalist E-Commerce',
    description: 'Caída limpia, arrugas mínimas, luz neutra de catálogo y foco en geometría pura.',
    settings: {
      drape: 55,
      wrinkle: 15,
      sheen: 'matte',
      texture: 60,
      lighting: 'Neutral 5-point studio lighting, pure white cyclorama',
      focus: 'Clean silhouette, exact seams and collar symmetry',
    },
  },
  {
    id: 'formal',
    name: 'Sastrería & Alta Costura',
    description: 'Caída estructurada, textura HD definida, iluminación dramática suave.',
    settings: {
      drape: 30,
      wrinkle: 10,
      sheen: 'subtle sheen',
      texture: 85,
      lighting: 'Sculpted editorial key light with soft fill',
      focus: 'Lapels, structured shoulders, button placket and premium weave',
    },
  },
  {
    id: 'streetwear',
    name: 'Streetwear & Oversize',
    description: 'Caída pesada relajada, pliegues naturales de movimiento y textura de algodón denso.',
    settings: {
      drape: 65,
      wrinkle: 50,
      sheen: 'matte',
      texture: 75,
      lighting: 'Crisp high-contrast urban studio flash',
      focus: 'Oversized drop-shoulder fit, heavy rib cuffs and natural folds',
    },
  },
  {
    id: 'athleisure',
    name: 'Athleisure & Técnico',
    description: 'Ajuste anatómico de segunda piel, tensión elástica y acabado técnico satinado sutil.',
    settings: {
      drape: 45,
      wrinkle: 20,
      sheen: 'subtle sheen',
      texture: 70,
      lighting: 'Clean athletic commercial lighting showing contour',
      focus: 'Ergonomic seams, stretch recovery and waistband fit',
    },
  },
  {
    id: 'vintage',
    name: 'Editorial Orgánico / Lino',
    description: 'Caída fluida con textura orgánica pronunciada y luz cálida.',
    settings: {
      drape: 80,
      wrinkle: 55,
      sheen: 'matte',
      texture: 90,
      lighting: 'Warm diffused daylight editorial studio',
      focus: 'Natural slub weave, fluid movement and organic drape',
    },
  },
];

export const FABRIC_TYPES = [
  'Original (Lock)',
  'Cotton',
  'Denim',
  'Linen',
  'Silk',
  'Wool',
  'Knit',
  'Satin',
  'Leather',
  'Velvet',
  'Corduroy',
  'Tweed',
  'Chiffon',
  'Polyester Blend',
  'Rayon',
] as const;

/* ============================================================================
 * 6) CLONE STUDIO (8 Poses Esqueléticas + 15 Fondos + Fashion Safety)
 * ========================================================================== */
export interface SkeletalPoseValues {
  torsoRotation: number;
  headRotation: number;
  headTilt: number;
  leftShoulderAngle: number;
  leftElbowAngle: number;
  rightShoulderAngle: number;
  rightElbowAngle: number;
  hipTilt: number;
  leftHipAngle: number;
  leftKneeAngle: number;
  rightHipAngle: number;
  rightKneeAngle: number;
  weightShift: number;
}

export interface SkeletalPosePreset {
  id: string;
  name: string;
  category: 'editorial' | 'commercial' | 'dynamic';
  promptDescription: string;
  values: SkeletalPoseValues;
}

export const SKELETAL_POSE_PRESETS: SkeletalPosePreset[] = [
  {
    id: 'standing_straight',
    name: 'Catálogo Recto Simétrico',
    category: 'commercial',
    promptDescription: 'Standing straight facing camera, arms relaxed naturally at sides with slight clearance from waist, balanced weight.',
    values: {
      torsoRotation: 0, headRotation: 0, headTilt: 0,
      leftShoulderAngle: 8, leftElbowAngle: 5, rightShoulderAngle: -8, rightElbowAngle: -5,
      hipTilt: 0, leftHipAngle: 0, leftKneeAngle: 0, rightHipAngle: 0, rightKneeAngle: 0, weightShift: 0,
    },
  },
  {
    id: 'magazine_editorial',
    name: 'Editorial Contrapposto',
    category: 'editorial',
    promptDescription: 'Subtle contrapposto editorial stance, torso angled 15 degrees, weight shifted to right hip, left leg slightly forward.',
    values: {
      torsoRotation: 15, headRotation: -10, headTilt: 4,
      leftShoulderAngle: 12, leftElbowAngle: 25, rightShoulderAngle: -10, rightElbowAngle: -15,
      hipTilt: 6, leftHipAngle: 8, leftKneeAngle: 10, rightHipAngle: -4, rightKneeAngle: 0, weightShift: 20,
    },
  },
  {
    id: 'runway_catwalk',
    name: 'Pasarela en Paso',
    category: 'dynamic',
    promptDescription: 'Confident runway walk mid-stride toward camera, shoulders back, fluid garment movement.',
    values: {
      torsoRotation: -8, headRotation: 5, headTilt: 0,
      leftShoulderAngle: -14, leftElbowAngle: -10, rightShoulderAngle: 14, rightElbowAngle: 12,
      hipTilt: -5, leftHipAngle: 18, leftKneeAngle: 8, rightHipAngle: -12, rightKneeAngle: 15, weightShift: -10,
    },
  },
  {
    id: 'hands_on_hips',
    name: 'Manos en Cintura (Despejado)',
    category: 'commercial',
    promptDescription: 'One hand resting lightly on hip defining waistline without hiding garment front details, confident commercial posture.',
    values: {
      torsoRotation: 10, headRotation: -5, headTilt: 2,
      leftShoulderAngle: 35, leftElbowAngle: 85, rightShoulderAngle: -8, rightElbowAngle: -6,
      hipTilt: 5, leftHipAngle: 4, leftKneeAngle: 6, rightHipAngle: 0, rightKneeAngle: 0, weightShift: 15,
    },
  },
  {
    id: 'lookbook_casual',
    name: 'Lookbook Relajado',
    category: 'commercial',
    promptDescription: 'Relaxed contemporary lookbook posture, soft shoulder line, natural stance.',
    values: {
      torsoRotation: -12, headRotation: 8, headTilt: -3,
      leftShoulderAngle: 10, leftElbowAngle: 15, rightShoulderAngle: -12, rightElbowAngle: -20,
      hipTilt: -4, leftHipAngle: 0, leftKneeAngle: 0, rightHipAngle: 10, rightKneeAngle: 12, weightShift: -15,
    },
  },
  {
    id: 'walking_fluid',
    name: 'Movimiento Fluido',
    category: 'dynamic',
    promptDescription: 'Fluid walking motion showcasing fabric drape and dynamic hem movement.',
    values: {
      torsoRotation: 18, headRotation: -12, headTilt: 3,
      leftShoulderAngle: 16, leftElbowAngle: 18, rightShoulderAngle: -18, rightElbowAngle: -14,
      hipTilt: 4, leftHipAngle: -10, leftKneeAngle: 14, rightHipAngle: 16, rightKneeAngle: 6, weightShift: 12,
    },
  },
  {
    id: 'editorial_profile_3_4',
    name: 'Perfil 3/4 Escultural',
    category: 'editorial',
    promptDescription: 'Three-quarter profile turn highlighting side seam, sleeve construction and garment silhouette.',
    values: {
      torsoRotation: 38, headRotation: -25, headTilt: 2,
      leftShoulderAngle: 10, leftElbowAngle: 12, rightShoulderAngle: -8, rightElbowAngle: -10,
      hipTilt: 5, leftHipAngle: 6, leftKneeAngle: 8, rightHipAngle: -4, rightKneeAngle: 0, weightShift: 10,
    },
  },
  {
    id: 'editorial_seated',
    name: 'Editorial Sentada / Cubo',
    category: 'editorial',
    promptDescription: 'Poised seated pose on minimalist white studio cube, upright spine preserving garment front.',
    values: {
      torsoRotation: 10, headRotation: -6, headTilt: 2,
      leftShoulderAngle: 14, leftElbowAngle: 40, rightShoulderAngle: -12, rightElbowAngle: -35,
      hipTilt: 0, leftHipAngle: 75, leftKneeAngle: 80, rightHipAngle: 70, rightKneeAngle: 85, weightShift: 0,
    },
  },
];

export interface BackgroundPreset {
  id: string;
  name: string;
  category: 'studio' | 'outdoor' | 'minimal';
  hexPreview: string;
  promptDirective: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'studio_white_cyc', name: 'Estudio Blanco Ciclorama (#FFFFFF)', category: 'studio', hexPreview: '#FFFFFF', promptDirective: 'Pure seamless #FFFFFF white studio cyclorama with soft natural floor contact shadow only.' },
  { id: 'studio_warm_grey', name: 'Estudio Gris Cemento Suave', category: 'studio', hexPreview: '#E5E4E0', promptDirective: 'Neutral warm light-grey studio backdrop (#E5E4E0) with diffused commercial lighting.' },
  { id: 'studio_charcoal_dark', name: 'Estudio Carbón Editorial', category: 'studio', hexPreview: '#27272A', promptDirective: 'Matte charcoal dark studio backdrop (#27272A) with subtle rim light separating the subject.' },
  { id: 'studio_sand_warm', name: 'Estudio Arena Cálido', category: 'studio', hexPreview: '#EAE0D5', promptDirective: 'Warm sand-toned seamless studio backdrop (#EAE0D5) with soft daylight-balanced key light.' },
  { id: 'studio_spotlight_drama', name: 'Estudio Foco Editorial', category: 'studio', hexPreview: '#D4D4D8', promptDirective: 'High-fashion editorial studio backdrop with soft circular key-light gradient.' },
  { id: 'minimal_pure_white', name: 'Minimal Blanco Puro E-Commerce', category: 'minimal', hexPreview: '#FFFFFF', promptDirective: 'Strict e-commerce pure #FFFFFF background, zero environment props, neutral color temperature.' },
  { id: 'minimal_window_shadow', name: 'Sombra Ventana Minimal', category: 'minimal', hexPreview: '#F4F1EA', promptDirective: 'Minimalist off-white plaster wall with soft architectural daylight window shadow.' },
  { id: 'minimal_soft_beige', name: 'Minimal Lino Beige Suave', category: 'minimal', hexPreview: '#EFECE6', promptDirective: 'Minimalist warm beige linen-toned studio environment (#EFECE6), clean and distraction-free.' },
  { id: 'minimal_concrete_panel', name: 'Minimal Microcemento', category: 'minimal', hexPreview: '#DCDCDC', promptDirective: 'Smooth architectural micro-cement studio wall, neutral color cast.' },
  { id: 'outdoor_sunlit_terrace', name: 'Exterior Terraza Luz Solar', category: 'outdoor', hexPreview: '#E8DFD1', promptDirective: 'Sunlit architectural stone terrace with shallow depth of field (f/2.8 bokeh) and natural daylight.' },
  { id: 'outdoor_urban_street', name: 'Exterior Calle Urbana Chic', category: 'outdoor', hexPreview: '#CBD5E1', promptDirective: 'Clean European limestone city street out-of-focus background, neutral daylight.' },
  { id: 'outdoor_mediterranean_wall', name: 'Exterior Muro Mediterráneo', category: 'outdoor', hexPreview: '#F5EBE0', promptDirective: 'Sun-washed whitewashed Mediterranean courtyard wall, soft natural shadows.' },
];

export const COMMERCIAL_FASHION_CATALOG_PREAMBLE = `CONTEXT: Professional commercial fashion e-commerce catalog production and technical garment visualization.
All garments (including bodysuits, swimwear, activewear, intimates, or tailored apparel) are presented strictly in a respectful, non-sensual, high-fashion retail catalog context on an adult studio model.`;

/* ============================================================================
 * 7) CATALOG MAKER (Plantillas Haute Couture + Resoluciones + FitModes)
 * ========================================================================== */
export interface HauteCoutureCell {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  w: number; // 0..1 normalized
  h: number; // 0..1 normalized
  role?: 'hero' | 'detail' | 'standard';
}

export interface HauteCoutureTemplate {
  id: string;
  name: string;
  count: number;
  description: string;
  cells: HauteCoutureCell[];
}

export const HAUTE_COUTURE_TEMPLATES: HauteCoutureTemplate[] = [
  { id: 'hc_1_a', name: '1 Imagen · Hero Portada Solitaria', count: 1, description: 'Portada editorial a página completa.', cells: [{ x: 0, y: 0, w: 1, h: 1, role: 'hero' }] },
  { id: 'hc_2_a', name: '2 Imágenes · Díptico Vertical (2 Columnas)', count: 2, description: 'Dos columnas simétricas de cuerpo entero.', cells: [{ x: 0, y: 0, w: 0.5, h: 1, role: 'hero' }, { x: 0.5, y: 0, w: 0.5, h: 1, role: 'standard' }] },
  { id: 'hc_2_b', name: '2 Imágenes · Díptico Horizontal (2 Filas)', count: 2, description: 'Dos filas editoriales horizontales.', cells: [{ x: 0, y: 0, w: 1, h: 0.5, role: 'hero' }, { x: 0, y: 0.5, w: 1, h: 0.5, role: 'detail' }] },
  { id: 'hc_3_a', name: '3 Imágenes · Hero Left + 2 Apiladas', count: 3, description: 'Columna hero a la izquierda (58%) y 2 vistas a la derecha.', cells: [{ x: 0, y: 0, w: 0.58, h: 1, role: 'hero' }, { x: 0.58, y: 0, w: 0.42, h: 0.5, role: 'standard' }, { x: 0.58, y: 0.5, w: 0.42, h: 0.5, role: 'detail' }] },
  { id: 'hc_3_b', name: '3 Imágenes · 2 Apiladas + Hero Right', count: 3, description: 'Dos vistas a la izquierda y Hero dominante a la derecha.', cells: [{ x: 0, y: 0, w: 0.42, h: 0.5, role: 'standard' }, { x: 0, y: 0.5, w: 0.42, h: 0.5, role: 'detail' }, { x: 0.42, y: 0, w: 0.58, h: 1, role: 'hero' }] },
  { id: 'hc_3_c', name: '3 Imágenes · Hero Top + 2 Inferiores', count: 3, description: 'Hero superior (58%) + 2 vistas inferiores.', cells: [{ x: 0, y: 0, w: 1, h: 0.58, role: 'hero' }, { x: 0, y: 0.58, w: 0.5, h: 0.42, role: 'standard' }, { x: 0.5, y: 0.58, w: 0.5, h: 0.42, role: 'detail' }] },
  { id: 'hc_4_a', name: '4 Imágenes · Cuadrícula 2×2 Clásica', count: 4, description: 'Cuatro celdas simétricas (Frontal, Lateral, Espalda, Detalle).', cells: [{ x: 0, y: 0, w: 0.5, h: 0.5, role: 'hero' }, { x: 0.5, y: 0, w: 0.5, h: 0.5, role: 'standard' }, { x: 0, y: 0.5, w: 0.5, h: 0.5, role: 'standard' }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5, role: 'detail' }] },
  { id: 'hc_4_b', name: '4 Imágenes · Hero Top + 3 Inferiores', count: 4, description: 'Hero superior dominante + 3 vistas inferiores.', cells: [{ x: 0, y: 0, w: 1, h: 0.55, role: 'hero' }, { x: 0, y: 0.55, w: 1 / 3, h: 0.45, role: 'standard' }, { x: 1 / 3, y: 0.55, w: 1 / 3, h: 0.45, role: 'standard' }, { x: 2 / 3, y: 0.55, w: 1 / 3, h: 0.45, role: 'detail' }] },
  { id: 'hc_5_b', name: '5 Imágenes · Hero Center + 4 Laterales', count: 5, description: 'Columna central dominante flanqueada por 4 vistas.', cells: [{ x: 0, y: 0, w: 0.3, h: 0.5, role: 'standard' }, { x: 0, y: 0.5, w: 0.3, h: 0.5, role: 'detail' }, { x: 0.3, y: 0, w: 0.4, h: 1, role: 'hero' }, { x: 0.7, y: 0, w: 0.3, h: 0.5, role: 'standard' }, { x: 0.7, y: 0.5, w: 0.3, h: 0.5, role: 'detail' }] },
  { id: 'hc_5_a', name: '5 Imágenes · 2 Izquierda + 3 Derecha', count: 5, description: 'Dos retratos a la izquierda + 3 detalles a la derecha.', cells: [{ x: 0, y: 0, w: 0.41, h: 0.5, role: 'hero' }, { x: 0, y: 0.5, w: 0.41, h: 0.5, role: 'standard' }, { x: 0.41, y: 0, w: 0.59, h: 1 / 3, role: 'standard' }, { x: 0.41, y: 1 / 3, w: 0.59, h: 1 / 3, role: 'detail' }, { x: 0.41, y: 2 / 3, w: 0.59, h: 1 / 3, role: 'detail' }] },
  { id: 'hc_5_c', name: '5 Imágenes · 2 Superiores + 3 Inferiores', count: 5, description: 'Díptico superior + tríptico inferior.', cells: [{ x: 0, y: 0, w: 0.5, h: 0.51, role: 'hero' }, { x: 0.5, y: 0, w: 0.5, h: 0.51, role: 'standard' }, { x: 0, y: 0.51, w: 1 / 3, h: 0.49, role: 'standard' }, { x: 1 / 3, y: 0.51, w: 1 / 3, h: 0.49, role: 'detail' }, { x: 2 / 3, y: 0.51, w: 1 / 3, h: 0.49, role: 'detail' }] },
  { id: 'hc_6_c', name: '6 Imágenes · 2 Columnas × 3 Filas Clásico', count: 6, description: 'Seis celdas verticales en 2 columnas × 3 filas.', cells: [{ x: 0, y: 0, w: 0.5, h: 1 / 3 }, { x: 0.5, y: 0, w: 0.5, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 0.5, h: 1 / 3 }, { x: 0.5, y: 1 / 3, w: 0.5, h: 1 / 3 }, { x: 0, y: 2 / 3, w: 0.5, h: 1 / 3 }, { x: 0.5, y: 2 / 3, w: 0.5, h: 1 / 3 }] },
  { id: 'hc_6_b', name: '6 Imágenes · 3 Columnas × 2 Filas', count: 6, description: 'Seis retratos verticales en 3 columnas × 2 filas.', cells: [{ x: 0, y: 0, w: 1 / 3, h: 0.5 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.5 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 }, { x: 0, y: 0.5, w: 1 / 3, h: 0.5 }, { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 }, { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 }] },
  { id: 'hc_6_a', name: '6 Imágenes · Hero Left + 5 Asimétrico', count: 6, description: 'Hero vertical izquierdo + 5 celdas asimétricas.', cells: [{ x: 0, y: 0, w: 0.42, h: 1, role: 'hero' }, { x: 0.42, y: 0, w: 0.29, h: 0.5 }, { x: 0.71, y: 0, w: 0.29, h: 0.5 }, { x: 0.42, y: 0.5, w: 0.193, h: 0.5 }, { x: 0.613, y: 0.5, w: 0.193, h: 0.5 }, { x: 0.806, y: 0.5, w: 0.194, h: 0.5 }] },
  { id: 'hc_7_b', name: '7 Imágenes · Hero Left + 6 Mosaico', count: 7, description: 'Hero izquierdo (42%) + grilla 2×3 derecha.', cells: [{ x: 0, y: 0, w: 0.42, h: 1, role: 'hero' }, { x: 0.42, y: 0, w: 0.29, h: 1 / 3 }, { x: 0.71, y: 0, w: 0.29, h: 1 / 3 }, { x: 0.42, y: 1 / 3, w: 0.29, h: 1 / 3 }, { x: 0.71, y: 1 / 3, w: 0.29, h: 1 / 3 }, { x: 0.42, y: 2 / 3, w: 0.29, h: 1 / 3 }, { x: 0.71, y: 2 / 3, w: 0.29, h: 1 / 3 }] },
  { id: 'hc_8_a', name: '8 Imágenes · Cuadrícula 2×4 de Lujo', count: 8, description: 'Ocho celdas simétricas en 2 columnas × 4 filas.', cells: [{ x: 0, y: 0, w: 0.5, h: 0.25 }, { x: 0.5, y: 0, w: 0.5, h: 0.25 }, { x: 0, y: 0.25, w: 0.5, h: 0.25 }, { x: 0.5, y: 0.25, w: 0.5, h: 0.25 }, { x: 0, y: 0.5, w: 0.5, h: 0.25 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.25 }, { x: 0, y: 0.75, w: 0.5, h: 0.25 }, { x: 0.5, y: 0.75, w: 0.5, h: 0.25 }] },
  { id: 'hc_9_b', name: '9 Imágenes · Hero Left + 8 Asimétrico', count: 9, description: 'Hero vertical izquierdo + 8 celdas en grilla 2×4.', cells: [{ x: 0, y: 0, w: 0.42, h: 1, role: 'hero' }, { x: 0.42, y: 0, w: 0.29, h: 0.25 }, { x: 0.71, y: 0, w: 0.29, h: 0.25 }, { x: 0.42, y: 0.25, w: 0.29, h: 0.25 }, { x: 0.71, y: 0.25, w: 0.29, h: 0.25 }, { x: 0.42, y: 0.5, w: 0.29, h: 0.25 }, { x: 0.71, y: 0.5, w: 0.29, h: 0.25 }, { x: 0.42, y: 0.75, w: 0.29, h: 0.25 }, { x: 0.71, y: 0.75, w: 0.29, h: 0.25 }] },
  { id: 'hc_9_a', name: '9 Imágenes · Luxury Grid 3×3', count: 9, description: 'Nueve celdas simétricas en cuadrícula 3×3.', cells: [{ x: 0, y: 0, w: 1 / 3, h: 1 / 3 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3 }, { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, role: 'hero' }, { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 }, { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3 }, { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 }] },
];

export const KORA_DNA_SCHEMA: Record<string, { label: string; options: string[] }> = {
  etnia_origen: { label: 'Etnia / Origen', options: ['Europea', 'Latinoamericana (Chile)', 'Africana / Afrodescendiente', 'Asiática', 'Mediterránea', 'Mixta'] },
  encuadre: { label: 'Encuadre / Cámara', options: ['Cuerpo Entero', 'Plano Americano (3/4)', 'Primer Plano (Retrato)'] },
  pose: { label: 'Pose Editorial Base', options: ['Postura Erguida Catálogo', 'Postura Dinámica', 'Momento Espontáneo', 'Pose de Poder High-Fashion', 'Editorial Sentada'] },
  vestuario: { label: 'Vestuario Base del Avatar', options: ['Conjunto Deportivo Lycra Blanca', 'Minimalista Negro High-Fashion', 'Seda Arquitectónica Avant-Garde', 'Conjunto Streetwear de Lujo'] },
  facial_expression: { label: 'Expresión Facial', options: ['Serenidad Etérea', 'Mirada Intensa', 'Sonrisa Sutil', 'Labios Ligeramente Entreabiertos'] },
  tipo_cuerpo: { label: 'Morfología Corporal', options: ['Esbelta moda', 'Proporcionada', 'Atlética', 'Curvilínea', 'Inclusiva plus', 'Ligeramente Curva', 'Atlética Delgada', 'Petite'] },
  color_piel: { label: 'Tono Biológico de Piel', options: ['Marfil Pálido', 'Porcelana clara', 'Bronceado Cálido', 'Beige neutro', 'Bronce medio', 'Tierra Profunda', 'Chocolate oscuro', 'Ébano profundo'] },
  skin_pore_visibility: { label: 'Micro-Topología Epidermal', options: ['Hiperrealista', 'Notable', 'Sutil', 'Micro-arrugas y Líneas', 'Venas Subdérmicas'] },
  footwear_style: { label: 'Calzado Base', options: ['Tacones de Aguja', 'Botas de Suela Gruesa', 'Sandalias de Plataforma', 'Zapatillas de Diseñador', 'Descalza'] },
  hand_detail: { label: 'Anatomía de Manos', options: ['Articuladas (anatomía precisa)', 'Hiperrealista (con textura de piel)', 'Estándar'] },
  layer_hiperrealismo: { label: 'Capa Master Hiperrealismo', options: ['Precisión Clínica', 'Profundidad Atmosférica (Narrativa)', 'Claridad Surrealista (Volumétrica)', 'Estética de Estado Onírico'] },
  rasgos_faciales: { label: 'Arquitectura Ósea Facial', options: ['Clásicos simétricos', 'Angulosos editoriales', 'Suaves naturales', 'Andróginos modernos'] },
  eye_detail: { label: 'Física Ocular', options: ['Iris Luminoso', 'Micro-Vascularidad Sutil', 'Destello Reflejado', 'Realismo Estándar'] },
  makeup_style: { label: 'Acabado de Maquillaje', options: ['Natural Sutil', 'Editorial Atrevido', 'Glamour High Fashion', 'Maquillaje Hiper-detallado', 'Ninguno'] },
  color_ojos: { label: 'Color de Iris', options: ['Verde avellana', 'Azul gris profundo', 'Ámbar natural', 'Marrón intenso', 'Negro profundo'] },
  cabello_color: { label: 'Cromatismo Capilar', options: ['Castaño oscuro', 'Rubio platino natural', 'Rubio dorado', 'Castaño claro', 'Negro azabache', 'Rojo cobrizo'] },
  cabello_estilo: { label: 'Arquitectura Capilar', options: ['Largo suelto natural', 'Coleta pulida editorial', 'Bob geométrico', 'Peinado hacia atrás', 'Rizos voluminosos', 'Recogido alto pasarela', 'Ondulado suave real', 'Wolf Cut', 'Pixie asimétrico'] },
  fondo_estudio: { label: 'Atmósfera de Estudio', options: ['Blanco Puro High-Key', 'Gris de Estudio Suave', 'Degradado Sutil', 'Foco Dramático', 'Estudio Cinemático', 'Resplandor de Hora Dorada'] },
  lighting_setup: { label: 'Esquema de Iluminación', options: ['Estudio Estándar 5 Puntos', 'Iluminación Rembrandt', 'Iluminación Mariposa', 'Luz de Contorno (Rim Light)', 'Softbox Difuso', 'Flash Directo Duro'] },
  post_processing: { label: 'Etalonaje / Salida Master', options: ['Salida Raw 4K', 'Grano de Película Analógica', 'Editorial de Alto Contraste', 'Resplandor Suave (Bloom)', 'Realce de Color Vívido'] },
  micro_detail: { label: 'Micro-Detalle Biológico', options: ['Vello Facial Sutil (Peach Fuzz)', 'Micro-arrugas y Líneas', 'Venas Subdérmicas', 'Sudor y Humedad', 'Estándar'] },
  human_authenticity: { label: 'Autenticidad Humana (SSS)', options: ['Calidez Biológica (SSS)', 'Imperfecciones Sutiles (Pecas/Lunares)', 'Esencia Humana Pura (Sin Filtros)', 'Micro-expresión'] },
};

export const CLONE_HAIR_COLORS = [
  { label: 'Original (Avatar)', value: 'original', hex: '#6366f1' },
  { label: 'Negro Azabache', value: '#09080b', hex: '#09080b' },
  { label: 'Castaño Chocolate', value: '#382218', hex: '#382218' },
  { label: 'Castaño Miel', value: '#724e35', hex: '#724e35' },
  { label: 'Rubio Ceniza', value: '#b39977', hex: '#b39977' },
  { label: 'Rubio Dorado', value: '#deb887', hex: '#deb887' },
  { label: 'Rubio Platino', value: '#f0e3cc', hex: '#f0e3cc' },
  { label: 'Cobrizo Editorial', value: '#9a3622', hex: '#9a3622' },
  { label: 'Borgoña Profundo', value: '#581b23', hex: '#581b23' },
  { label: 'Plata / Canoso', value: '#8b909a', hex: '#8b909a' },
];

export const CLONE_EYE_COLORS = [
  { label: 'Original (Avatar)', value: 'original', hex: '#6366f1' },
  { label: 'Marrón Oscuro', value: '#24140b', hex: '#24140b' },
  { label: 'Avellana / Hazel', value: '#6b4728', hex: '#6b4728' },
  { label: 'Ámbar', value: '#b57c2c', hex: '#b57c2c' },
  { label: 'Verde Esmeralda', value: '#2e6f40', hex: '#2e6f40' },
  { label: 'Azul Hielo', value: '#5b8fa8', hex: '#5b8fa8' },
  { label: 'Gris Tormenta', value: '#71797e', hex: '#71797e' },
];

export const CLONE_FOOTWEAR = [
  { id: 'reference', label: 'Calzado Original del Avatar' },
  { id: 'heels', label: 'Stilettos / Tacón de Aguja' },
  { id: 'boots', label: 'Botas Editoriales de Cuero' },
  { id: 'sneakers', label: 'Sneakers Minimalistas de Lujo' },
  { id: 'sandals', label: 'Sandalias de Tiras Finas' },
  { id: 'loafers', label: 'Mocasines Sastreros' },
];

export const STRUCTURED_GARMENT_FOCUS: Record<string, string[]> = {
  CHAQUETAS: ['Solapas y estructuración de hombros', 'Botonadura frontal y ojales', 'Caída de mangas y puños sastreros', 'Forro interior y costuras de entalle'],
  TEJIDOS: ['Trama macro del punto y relieve 3D', 'Cuello acanalado y elasticidad', 'Caída orgánica sobre el torso', 'Terminación de puños y ruedo'],
  TOPS: ['Construcción del escote/cuello', 'Caída limpia sobre el pecho', 'Costuras de hombros y sisa', 'Basta inferior y fluidez'],
  BOTTOMS: ['Calce de pretina y tiro', 'Caída longitudinal de pierna', 'Bolsillos, presillas y cierre', 'Terminación de basta sobre calzado'],
  VESTIDOS: ['Entalle en cintura y silueta continua', 'Vuelo y caída dinámica de falda', 'Escote y sujeción superior', 'Textura superficial bajo luz de estudio'],
  CONJUNTOS: ['Proporción entre pieza superior e inferior', 'Transición limpia en cintura', 'Coherencia cromática y textil 1:1'],
  ACCESORIOS: ['Herrajes metálicos y brillo especular', 'Costuras de marroquinería', 'Escala real respecto a la mano/cuerpo'],
};

export function mirrorPoseValues(v: SkeletalPoseValues): SkeletalPoseValues {
  return {
    torsoRotation: -v.torsoRotation,
    headRotation: -v.headRotation,
    headTilt: -v.headTilt,
    leftShoulderAngle: -v.rightShoulderAngle,
    leftElbowAngle: -v.rightElbowAngle,
    rightShoulderAngle: -v.leftShoulderAngle,
    rightElbowAngle: -v.leftElbowAngle,
    hipTilt: -v.hipTilt,
    leftHipAngle: v.rightHipAngle,
    leftKneeAngle: v.rightKneeAngle,
    rightHipAngle: v.leftHipAngle,
    rightKneeAngle: v.leftKneeAngle,
    weightShift: -v.weightShift,
  };
}

export function getHauteCoutureTemplate(templateId: string, assetCount: number): HauteCoutureTemplate | undefined {
  if (templateId && templateId !== 'AUTO' && templateId !== 'GRID') {
    const found = HAUTE_COUTURE_TEMPLATES.find((t) => t.id === templateId);
    if (found) return found;
  }
  if (templateId === 'AUTO') {
    return HAUTE_COUTURE_TEMPLATES.find((t) => t.count === assetCount);
  }
  return undefined;
}

export const CATALOG_RESOLUTIONS: Record<string, { width: number; height: number; label: string }> = {
  '1000x1500': { width: 1000, height: 1500, label: '1000×1500 (2:3 Estándar)' },
  '1500x2250': { width: 1500, height: 2250, label: '1500×2250 (2:3 HD)' },
  '2000x3000': { width: 2000, height: 3000, label: '2000×3000 (2:3 Print 4K)' },
  '1200x1600': { width: 1200, height: 1600, label: '1200×1600 (3:4 E-Commerce)' },
  '1600x1600': { width: 1600, height: 1600, label: '1600×1600 (1:1 Social/Lookbook)' },
};

