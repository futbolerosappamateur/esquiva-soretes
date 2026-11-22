import type { BarrioTraits } from './barrioTraits';
import type { EnvironmentId } from './environments';

/**
 * Estructura de la campaña: CIUDAD → BARRIOS → NIVELES → CUADRAS.
 *
 * Todo es configuración: las cuadras no se programan a mano. Cada nivel
 * enumera sus calles y su dificultad, y el generador arma veredas,
 * obstáculos, cruces y decoración a partir de estos datos.
 */

/** Una cuadra: la calle que se recorre y las dos esquinas. */
export interface StreetBlock {
  street: string;
  from: string;
  to: string;
}

/** Patrón obligatorio en un punto de una cuadra (0 = comienzo, 1 = esquina). */
export interface ScriptedPattern {
  at: number;
  pattern: string;
}

export interface LevelDef {
  /** Identificador único y estable (se usa en el guardado). */
  id: string;
  /** 1, 2 o 3 dentro del barrio. */
  number: number;
  name: string;
  /** Ambientación (día, noche, otoño...). No queda atada al número de nivel. */
  environment: EnvironmentId;
  /** Las cuadras en orden (la cantidad sale de CAMPAIGN_TUNING.blocksPerLevel). */
  blocks: StreetBlock[];
  /** Dificultad al comienzo y al final del nivel (0 = tranqui, 1 = campo minado). */
  difficulty: [number, number];
  /** Multiplica la duración estimada del nivel (1 = valor de configuración). */
  durationScale?: number;
  /** Semilla fija (por defecto se deriva del id: el nivel es siempre igual). */
  seed?: number;
  /** Guiones de patrones por cuadra (índice de cuadra → patrones). */
  scripts?: Record<number, ScriptedPattern[]>;
  /** Puntajes para 2 y 3 estrellas (si no se indican, se calculan solos). */
  stars?: { two: number; three: number };
  /** Tránsito más o menos intenso que el normal (1 = normal). */
  traffic?: number;
  /** Cuadra (índice) donde aparece la misión del nivel. */
  missionBlock?: number;
  /** Misión del nivel (por defecto, la basura del portero). */
  missionId?: string;
  /** Cuadras (índices) donde una vecina riega la vereda. */
  waterBlocks?: number[];
  /** Tiempos (segundos) para el bonus de velocidad; si no se indican, se calculan solos. */
  timeTargets?: { excellent: number; good: number; ok: number };
}

export interface BarrioDef {
  id: string;
  name: string;
  /** Nombre tal como figura en los datos geográficos oficiales. */
  geoName: string;
  comuna: number;
  /** Tema visual de las veredas (ver world/themes.ts). */
  theme: string;
  /** Lo que hace distinto a este barrio al jugarlo (ver data/barrioTraits.ts). */
  traits?: Partial<BarrioTraits>;
  /** Niveles jugables. Vacío = "próximamente". */
  levels: LevelDef[];
  /** Si sus niveles son un recorrido provisional (se avisa en pantalla). */
  provisional?: boolean;
}

/** La primera cuadra del juego presenta cada obstáculo antes de combinarlos. */
const INTRO_SCRIPT: ScriptedPattern[] = [
  { at: 0.12, pattern: 'tiles' },
  { at: 0.3, pattern: 'leaves' },
  { at: 0.5, pattern: 'giant' },
  { at: 0.7, pattern: 'leaves' },
  { at: 0.88, pattern: 'giant' },
];

const route = (street: string, corners: string[]): StreetBlock[] =>
  corners.slice(0, -1).map((from, i) => ({ street, from, to: corners[i + 1] }));

const SAN_TELMO_SOUTH = ['INDEPENDENCIA', 'ESTADOS UNIDOS', 'CARLOS CALVO', 'HUMBERTO 1°', 'SAN JUAN', 'COCHABAMBA'];
const MONSERRAT_NORTH = ['INDEPENDENCIA', 'CHILE', 'MÉXICO', 'VENEZUELA', 'BELGRANO', 'MORENO'];

/*
 * Versalles: el barrio de prueba, donde se sacan las fotos para el arte
 * definitivo. Casas bajas, árboles, tranquilidad, perros, vecinas regando y
 * todos hinchas de Vélez. El recorrido son las cuadras que se fotografían: todo
 * el pasaje Aguaribay (3 cuadras) y dos de Madero. FALTAN LAS ESQUINAS: mientras
 * tanto el juego muestra sólo el nombre de la calle.
 */
const VERSALLES_ROUTE: StreetBlock[] = [
  { street: 'PASAJE AGUARIBAY', from: '', to: '' },
  { street: 'PASAJE AGUARIBAY', from: '', to: '' },
  { street: 'PASAJE AGUARIBAY', from: '', to: '' },
  { street: 'MADERO', from: '', to: '' },
  { street: 'MADERO', from: '', to: '' },
];

const VERSALLES: BarrioDef = {
  id: 'versalles',
  name: 'VERSALLES',
  geoName: 'Versalles',
  comuna: 10,
  theme: 'versalles',
  // Tranquilo de gente, pero lleno de perros (y de lo que dejan): nadie apurado por la
  // vereda, pocas palomas y muchos paseadores y vecinas.
  traits: { crowd: 0, pigeons: 0.6, brokenSidewalk: 0.2, background: { walker: 1.8, lady: 1.4, tourist: 0 } },
  provisional: true,
  levels: [
    {
      id: 'versalles-1',
      number: 1,
      name: 'LA SIESTA EN AGUARIBAY',
      environment: 'day',
      blocks: VERSALLES_ROUTE,
      difficulty: [0.35, 0.85],
      traffic: 0.6,
      missionBlock: 2,
      missionId: 'lost-dog',
      waterBlocks: [1, 3],
    },
    {
      id: 'versalles-2',
      number: 2,
      name: 'AGUARIBAY DE NOCHE',
      environment: 'night',
      blocks: VERSALLES_ROUTE,
      difficulty: [0.45, 0.92],
      traffic: 0.5,
      missionBlock: 1,
    },
    {
      id: 'versalles-3',
      number: 3,
      name: 'OTOÑO EN AGUARIBAY',
      environment: 'autumn',
      blocks: VERSALLES_ROUTE,
      difficulty: [0.55, 0.98],
      traffic: 0.6,
      missionBlock: 3,
      missionId: 'lost-dog',
      waterBlocks: [1, 2, 4],
    },
  ],
};

const SAN_TELMO: BarrioDef = {
  id: 'san-telmo',
  name: 'SAN TELMO',
  geoName: 'San Telmo',
  comuna: 1,
  theme: 'san-telmo',
  levels: [
    {
      id: 'san-telmo-1',
      number: 1,
      name: 'DEFENSA A PLENO SOL',
      environment: 'day',
      blocks: route('DEFENSA', SAN_TELMO_SOUTH),
      difficulty: [0.0, 0.62],
      scripts: { 0: INTRO_SCRIPT },
      missionBlock: 1,
      waterBlocks: [3],
    },
    {
      id: 'san-telmo-2',
      number: 2,
      name: 'BOLÍVAR DE NOCHE',
      environment: 'night',
      blocks: route('BOLÍVAR', [...SAN_TELMO_SOUTH].reverse()),
      difficulty: [0.2, 0.78],
      traffic: 0.85,
      missionBlock: 2,
      missionId: 'lost-dog',
    },
    {
      id: 'san-telmo-3',
      number: 3,
      name: 'PERÚ EN OTOÑO',
      environment: 'autumn',
      blocks: route('PERÚ', SAN_TELMO_SOUTH),
      difficulty: [0.35, 0.92],
      missionBlock: 1,
      waterBlocks: [2, 3],
    },
  ],
};

const MONSERRAT: BarrioDef = {
  id: 'monserrat',
  name: 'MONSERRAT',
  geoName: 'Monserrat',
  comuna: 1,
  theme: 'monserrat',
  // El centro: la vereda llena de gente apurada, palomas de la Plaza de Mayo y pocos árboles.
  traits: { crowd: 0.8, pigeons: 1.8, trees: 0.6, background: { walker: 0.6, lady: 1, tourist: 1.4 } },
  provisional: true,
  levels: [
    {
      id: 'monserrat-1',
      number: 1,
      name: 'DEFENSA RUMBO A LA PLAZA',
      environment: 'day',
      blocks: route('DEFENSA', MONSERRAT_NORTH),
      difficulty: [0.3, 0.8],
      traffic: 1.15,
      missionBlock: 2,
      missionId: 'lost-dog',
      waterBlocks: [1, 3],
    },
    {
      id: 'monserrat-2',
      number: 2,
      name: 'PERÚ A LA NOCHE',
      environment: 'night',
      blocks: route('PERÚ', [...MONSERRAT_NORTH].reverse()),
      difficulty: [0.42, 0.88],
      traffic: 1.0,
      missionBlock: 1,
    },
    {
      id: 'monserrat-3',
      number: 3,
      name: 'PIEDRAS EN OTOÑO',
      environment: 'autumn',
      blocks: route('PIEDRAS', MONSERRAT_NORTH),
      difficulty: [0.52, 0.96],
      traffic: 1.2,
      missionBlock: 3,
      missionId: 'lost-dog',
      waterBlocks: [2, 4],
    },
  ],
};

/** Barrio "próximamente": aparece en el mapa pero todavía no tiene niveles. */
const soon = (id: string, name: string, geoName: string, comuna: number, traits?: Partial<BarrioTraits>): BarrioDef => ({
  id,
  name,
  geoName,
  comuna,
  theme: 'san-telmo',
  traits,
  levels: [],
});

/*
 * Rasgos ya pensados para los barrios del lanzamiento que todavía no tienen
 * niveles (se pueden probar en cualquier nivel con ?rasgos=<barrio>).
 */
const LA_BOCA_TRAITS: Partial<BarrioTraits> = { crowd: 0.5, trees: 0.4, brokenSidewalk: 0.5, background: { walker: 0.6, lady: 0.8, tourist: 2.5 } };
const PALERMO_TRAITS: Partial<BarrioTraits> = { crowd: 0.35, pigeons: 0.8, brokenSidewalk: 0.15, background: { walker: 2.5, lady: 1, tourist: 0.8 } };
const LUGANO_TRAITS: Partial<BarrioTraits> = { crowd: 0.2, trees: 0, brokenSidewalk: 1, background: { walker: 1, lady: 1, tourist: 0 } };

/**
 * Los 48 barrios en el orden de la campaña (cada uno se desbloquea al
 * completar el anterior). Se puede reordenar libremente.
 */
export const BARRIOS: BarrioDef[] = [
  SAN_TELMO,
  MONSERRAT,
  // El barrio de prueba del arte. Tercero para no cambiar el progreso guardado ni las
  // reglas del servidor (se prueba directo con ?level=versalles-1).
  VERSALLES,
  soon('san-nicolas', 'SAN NICOLÁS', 'San Nicolas', 1),
  soon('puerto-madero', 'PUERTO MADERO', 'Puerto Madero', 1),
  soon('retiro', 'RETIRO', 'Retiro', 1),
  soon('recoleta', 'RECOLETA', 'Recoleta', 2),
  soon('balvanera', 'BALVANERA', 'Balvanera', 3),
  soon('san-cristobal', 'SAN CRISTÓBAL', 'San Cristobal', 3),
  soon('constitucion', 'CONSTITUCIÓN', 'Constitucion', 1),
  soon('barracas', 'BARRACAS', 'Barracas', 4),
  soon('la-boca', 'LA BOCA', 'La Boca', 4, LA_BOCA_TRAITS),
  soon('parque-patricios', 'PARQUE PATRICIOS', 'Parque Patricios', 4),
  soon('nueva-pompeya', 'NUEVA POMPEYA', 'Nueva Pompeya', 4),
  soon('boedo', 'BOEDO', 'Boedo', 5),
  soon('parque-chacabuco', 'PARQUE CHACABUCO', 'Parque Chacabuco', 7),
  soon('caballito', 'CABALLITO', 'Caballito', 6),
  soon('almagro', 'ALMAGRO', 'Almagro', 5),
  soon('villa-crespo', 'VILLA CRESPO', 'Villa Crespo', 15),
  soon('palermo', 'PALERMO', 'Palermo', 14, PALERMO_TRAITS),
  soon('colegiales', 'COLEGIALES', 'Colegiales', 13),
  soon('belgrano', 'BELGRANO', 'Belgrano', 13),
  soon('nunez', 'NÚÑEZ', 'Nuñez', 13),
  soon('saavedra', 'SAAVEDRA', 'Saavedra', 12),
  soon('coghlan', 'COGHLAN', 'Coghlan', 12),
  soon('villa-urquiza', 'VILLA URQUIZA', 'Villa Urquiza', 12),
  soon('villa-pueyrredon', 'VILLA PUEYRREDÓN', 'Villa Pueyrredon', 12),
  soon('agronomia', 'AGRONOMÍA', 'Agronomia', 15),
  soon('parque-chas', 'PARQUE CHAS', 'Parque Chas', 15),
  soon('villa-ortuzar', 'VILLA ORTÚZAR', 'Villa Ortuzar', 15),
  soon('chacarita', 'CHACARITA', 'Chacarita', 15),
  soon('la-paternal', 'LA PATERNAL', 'Paternal', 15),
  soon('villa-gral-mitre', 'VILLA GRAL. MITRE', 'Villa Gral. Mitre', 11),
  soon('villa-santa-rita', 'VILLA SANTA RITA', 'Villa Santa Rita', 11),
  soon('villa-del-parque', 'VILLA DEL PARQUE', 'Villa Del Parque', 11),
  soon('villa-devoto', 'VILLA DEVOTO', 'Villa Devoto', 11),
  soon('monte-castro', 'MONTE CASTRO', 'Monte Castro', 10),
  soon('villa-real', 'VILLA REAL', 'Villa Real', 10),
  soon('liniers', 'LINIERS', 'Liniers', 9),
  soon('mataderos', 'MATADEROS', 'Mataderos', 9),
  soon('parque-avellaneda', 'PARQUE AVELLANEDA', 'Parque Avellaneda', 9),
  soon('villa-lugano', 'VILLA LUGANO', 'Villa Lugano', 8, LUGANO_TRAITS),
  soon('villa-riachuelo', 'VILLA RIACHUELO', 'Villa Riachuelo', 8),
  soon('villa-soldati', 'VILLA SOLDATI', 'Villa Soldati', 8),
  soon('flores', 'FLORES', 'Flores', 7),
  soon('floresta', 'FLORESTA', 'Floresta', 10),
  soon('velez-sarsfield', 'VÉLEZ SARSFIELD', 'Velez Sarsfield', 10),
  soon('villa-luro', 'VILLA LURO', 'Villa Luro', 10),
];

export const CITY_NAME = 'BUENOS AIRES';
export const FIRST_BARRIO_ID = BARRIOS[0].id;

const BY_ID = new Map(BARRIOS.map((b) => [b.id, b]));

export function getBarrio(id: string): BarrioDef | undefined {
  return BY_ID.get(id);
}

export function barrioIndex(id: string): number {
  return BARRIOS.findIndex((b) => b.id === id);
}

/** Barrio siguiente en la campaña (o null si es el último). */
export function nextBarrio(id: string): BarrioDef | null {
  const i = barrioIndex(id);
  return i >= 0 && i + 1 < BARRIOS.length ? BARRIOS[i + 1] : null;
}

export function previousBarrio(id: string): BarrioDef | null {
  const i = barrioIndex(id);
  return i > 0 ? BARRIOS[i - 1] : null;
}

export interface LevelRef {
  barrioId: string;
  levelIndex: number;
}

export function getLevel(ref: LevelRef): { barrio: BarrioDef; level: LevelDef } | null {
  const barrio = getBarrio(ref.barrioId);
  const level = barrio?.levels[ref.levelIndex];
  return barrio && level ? { barrio, level } : null;
}

/** Normaliza nombres para comparar con los datos geográficos (sin tildes, mayúsculas). */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Semilla estable derivada de un texto (FNV-1a). */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
