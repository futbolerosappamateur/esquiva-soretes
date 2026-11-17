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
