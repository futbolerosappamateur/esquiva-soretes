/**
 * Patrón obligatorio en un punto de la cuadra (0 = comienzo, 1 = esquina).
 * Sirve para presentar cada obstáculo de forma aislada antes de mezclarlos.
 */
export interface ScriptedPattern {
  at: number;
  pattern: string;
}

/**
 * Cuadras jugables. Cada una es pura configuración: el generador arma la
 * vereda, los obstáculos y la decoración a partir de estos datos.
 */
export interface BlockDefinition {
  theme: string;
  /** Número de cuadra dentro de la partida (1, 2, 3...). */
  number: number;
  street: string;
  fromStreet: string;
  /** Calle de la esquina de llegada (aparece en el cartel). */
  toStreet: string;
  /** Largo de la vereda en píxeles internos. */
  length: number;
  /** Dificultad al principio y al final de la cuadra (0 = tranqui, 1 = campo minado). */
  difficulty: [number, number];
  script?: ScriptedPattern[];
}

/** La primera cuadra presenta cada tipo de obstáculo antes de combinarlos. */
const INTRO_SCRIPT: ScriptedPattern[] = [
  { at: 0.1, pattern: 'tiles' },
  { at: 0.27, pattern: 'leaves' },
  { at: 0.44, pattern: 'giant' },
  { at: 0.6, pattern: 'leaves' },
  { at: 0.76, pattern: 'giant' },
  { at: 0.9, pattern: 'tileRow' },
];

/** Recorrido por la calle Defensa, en San Telmo. */
const SAN_TELMO: Omit<BlockDefinition, 'number'>[] = [
  { theme: 'san-telmo', street: 'DEFENSA', fromStreet: 'INDEPENDENCIA', toStreet: 'ESTADOS UNIDOS', length: 6000, difficulty: [0.0, 0.42], script: INTRO_SCRIPT },
  { theme: 'san-telmo', street: 'DEFENSA', fromStreet: 'ESTADOS UNIDOS', toStreet: 'CARLOS CALVO', length: 6200, difficulty: [0.25, 0.6] },
  { theme: 'san-telmo', street: 'DEFENSA', fromStreet: 'CARLOS CALVO', toStreet: 'HUMBERTO 1°', length: 6200, difficulty: [0.42, 0.74] },
  { theme: 'san-telmo', street: 'DEFENSA', fromStreet: 'HUMBERTO 1°', toStreet: 'SAN JUAN', length: 6400, difficulty: [0.58, 0.86] },
  { theme: 'san-telmo', street: 'DEFENSA', fromStreet: 'SAN JUAN', toStreet: 'COCHABAMBA', length: 6400, difficulty: [0.7, 0.94] },
  { theme: 'san-telmo', street: 'DEFENSA', fromStreet: 'COCHABAMBA', toStreet: 'JUAN DE GARAY', length: 6600, difficulty: [0.8, 1.0] },
  { theme: 'san-telmo', street: 'DEFENSA', fromStreet: 'JUAN DE GARAY', toStreet: 'BRASIL', length: 6600, difficulty: [0.88, 1.0] },
];

/** Cantidad de cuadras diseñadas antes del modo "sin fin". */
export const DESIGNED_BLOCKS = SAN_TELMO.length;

/**
 * Devuelve la cuadra pedida. Pasadas las cuadras diseñadas, el recorrido
 * sigue en modo sin fin con la dificultad al máximo.
 */
export function getBlock(index: number): BlockDefinition {
  const i = Math.max(0, index);
  if (i < SAN_TELMO.length) return { ...SAN_TELMO[i], number: i + 1 };
  const base = SAN_TELMO[(i - SAN_TELMO.length) % SAN_TELMO.length];
  return { ...base, number: i + 1, difficulty: [0.9, 1.0], length: 6600 };
}
