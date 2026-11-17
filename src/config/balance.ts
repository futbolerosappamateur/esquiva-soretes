/**
 * Valores de balance del juego. Todo lo que afecta la dificultad, la velocidad
 * o la puntuación está centralizado acá para poder ajustarlo fácilmente.
 */

/** Escala del mundo: cuántos píxeles internos equivalen a un metro de vereda. */
export const PIXELS_PER_METER = 40;

export const PLAYER_TUNING = {
  /** Velocidades en píxeles por segundo. */
  walkSpeed: 74,
  runSpeed: 124,
  backSpeed: 64,
  depthSpeed: 64,
  accel: 1100,
  decel: 1500,
  /** Segundos manteniendo "avanzar" para empezar a correr. */
  runChargeTime: 0.5,
  /** Salto: velocidad vertical inicial y gravedad (en el eje de altura z). */
  jumpVelocity: 215,
  gravity: 780,
  /** Si se aprieta saltar un poquito antes de aterrizar, el salto se respeta. */
  jumpBufferTime: 0.13,
  /** Duración de la secuencia "pisé un sorete" (sin control). */
  stepStunTime: 1.15,
  /** Invulnerabilidad posterior al impacto. */
  invulnTime: 2.0,
  /** Al pisar una baldosa floja el personaje queda más lento un ratito. */
  looseTileSlowTime: 0.55,
  looseTileSlowFactor: 0.55,
  lives: 3,
  /**
   * Huella de colisión de los pies (rectángulo centrado en los pies).
   * Es un poco más chica que el dibujo para que las colisiones sean justas.
   */
  footprint: { shape: 'rect' as const, w: 10, h: 4 },
  /** Altura de salto por debajo de la cual el personaje "está pisando". */
  groundedHeight: 2,
};

export const SCORING = {
  pointsPerMeter: 10,
  dodgePoints: 50,
  /** Bonus extra cuando el sorete se esquiva por muy poco. */
  closeCallBonus: 25,
  /** Distancia (px) entre huellas que cuenta como "por un pelo". */
  closeCallGap: 3,
  perfectBlockBonus: 1000,
  looseTilePenalty: 100,
  /** Segundos sin esquivar nada antes de perder el combo. */
  comboWindow: 6,
  /** Racha de soretes esquivados necesaria para cada multiplicador. */
  comboLevels: [
    { streak: 0, multiplier: 1 },
    { streak: 5, multiplier: 2 },
    { streak: 12, multiplier: 3 },
    { streak: 22, multiplier: 4 },
    { streak: 35, multiplier: 5 },
  ],
};

export const LEVEL_GEN = {
  /** Vereda libre al comienzo y al final de cada cuadra. */
  startClear: 250,
  endClear: 150,
  /** Celda de la grilla que valida que siempre exista un camino posible. */
  gridCell: 4,
  /** Margen de comodidad alrededor de cada obstáculo para el camino garantizado. */
  pathMargin: 3,
  /** Separación mínima entre obstáculos (además de sus huellas). */
  obstacleGap: 3,
  /** Distancia mínima de los obstáculos a los bordes de cada tramo generado. */
  chunkInnerMargin: 22,
  maxChunkAttempts: 8,
};

export const EFFECTS_TUNING = {
  /** Tiempo mínimo entre frases graciosas para no saturar la pantalla. */
  phraseCooldown: 1.8,
};

/**
 * Estructura y duración de los niveles. El largo de cada cuadra se calcula
 * para que un nivel dure `targetLevelSeconds` en una partida normal.
 */
export const CAMPAIGN_TUNING = {
  blocksPerLevel: 5,
  levelsPerBarrio: 3,
  /** Duración buscada de un nivel (segundos): entre 3 y 5 minutos. */
  targetLevelSeconds: 240,
  /** Velocidad media estimada del jugador (px/s), mezclando caminar, correr y esquivar. */
  estimatedSpeed: 90,
  /** Tiempo medio estimado en cada cruce (espera del semáforo + cruzar). */
  estimatedCrossingSeconds: 9,
  minBlockLength: 2400,
  maxBlockLength: 5600,
};

/** Calcula el largo (px) de cada cuadra de un nivel. */
export function blockLengthFor(durationScale = 1): number {
  const t = CAMPAIGN_TUNING;
  const crossings = t.blocksPerLevel - 1;
  const seconds = (t.targetLevelSeconds - crossings * t.estimatedCrossingSeconds) / t.blocksPerLevel;
  const length = seconds * t.estimatedSpeed * durationScale;
  return Math.round(Math.min(t.maxBlockLength, Math.max(t.minBlockLength, length)) / 16) * 16;
}

/** Cruces peatonales: geometría de la calle, semáforos, tránsito y premios. */
export const CROSSING_TUNING = {
  /** Ancho total de la esquina (ochavas + calzada) y de la calzada. */
  width: 140,
  roadInset: 18,
  /** Separación entre el final de la vereda y el cordón de la esquina. */
  cornerGap: 26,
  lanes: 2,
  /** Ciclo del semáforo (segundos). Corto, para mantener el ritmo arcade. */
  timing: { vehGreen: 4.2, vehYellow: 1.3, allRed1: 1.1, pedGreen: 5.2, pedFlash: 2.2, allRed2: 0.8 },
  /** Los autos frenan antes de la senda con este margen (px). */
  stopMargin: 7,
  /** Aceleración y frenado de los vehículos (px/s²). */
  accel: 160,
  decel: 420,
  /** Distancia mínima entre vehículos detenidos y tiempo de reacción del que viene atrás. */
  minGap: 7,
  headway: 0.45,
  /** Intervalo entre vehículos que entran por carril (segundos). */
  spawnInterval: [1.2, 2.8] as [number, number],
  maxPerLane: 7,
  /** El jugador empieza a "ver" el cruce (y la cámara lo encuadra) desde esta distancia. */
  approachDistance: 280,
  /** Distancia (px) a la que un auto toca bocina si el jugador está en su carril. */
  honkDistance: 70,
  greenBonus: 250,
  /** Bonus adicional por cruzar sin que te toque ningún auto. */
  cleanBonus: 150,
};

/** Estrellas de cada nivel según el puntaje (fracciones de un puntaje de referencia). */
export const STAR_RULES = {
  /** Completar el nivel siempre da al menos una estrella. */
  twoStarsFraction: 0.5,
  threeStarsFraction: 0.8,
  /** Multiplicador de combo "típico" para estimar el puntaje de referencia. */
  referenceMultiplier: 2.2,
};

/** Monedas: moneda persistente para desbloquear personajes y cosméticos. */
export const COIN_TUNING = {
  /** Monedas sueltas en la vereda por cuadra (aprox.). */
  coinsPerBlock: 9,
  /** Puntos que suma recoger una moneda (además de la moneda en sí). */
  pickupPoints: 20,
  /** Monedas por estrella nueva conseguida en un nivel (sólo la primera vez). */
  newStarCoins: 10,
};
