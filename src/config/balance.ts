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

// ---------------------------------------------------------------------------
// v0.3: habilidades, cronómetro y récords
// ---------------------------------------------------------------------------

/**
 * Habilidades especiales (tecla E / botón especial). Duraciones y recargas en
 * segundos de juego activo: la recarga no avanza mientras el juego está en pausa.
 */
export const ABILITY_TUNING = {
  dash: { cooldown: 12, distance: 46, protection: 0.32, step: 2 },
  doubleJump: { cooldown: 10, velocityFactor: 0.92 },
  turbo: { cooldown: 20, duration: 3, speed: 1.65, accel: 1.4, decel: 0.45, brakeAfter: 1.2 },
  sprint: { cooldown: 18, duration: 5, speed: 1.4, accel: 1.35, depth: 1.2 },
  broom: { cooldown: 15, stop: 0.6, reach: 72, halfDepth: 26 },
  hose: { cooldown: 22, duration: 2, reach: 96, halfDepth: 14, puddleEvery: 0.35 },
  sniff: { cooldown: 25, duration: 6, range: 300 },
  whistle: { cooldown: 30, duration: 3 },
};

/** Ventajas pasivas y pequeñas desventajas (valores de las habilidades pasivas). */
export const PASSIVE_TUNING = {
  /** Portero: alcance para juntar basura (multiplicador). */
  porteroPickup: 2,
  /** Paseador: distancia a la que sus perros "huelen" un sorete camuflado. */
  dogDetect: 70,
  /** Paseador: cada cuánto se pueden enredar las correas (segundos en movimiento) y cuánto frena. */
  tangleEvery: [24, 42] as [number, number],
  tangleTime: 1.2,
  tangleSpeed: 0.55,
  /** Policía: los autos le tocan bocina desde más lejos. */
  policeHonk: 1.7,
  /** Charcos del manguerazo: resbalan (frenado reducido) por este tiempo. */
  puddleSlipTime: 0.6,
  puddleSlipDecel: 0.35,
};

/** Bonus por terminar rápido (modo normal, partida no asistida). */
export const SPEED_BONUS = {
  points: { excellent: 2000, good: 1000, ok: 500 },
  /**
   * Umbrales por defecto como fracción de la duración estimada del nivel
   * (cada nivel puede definir sus propios tiempos en data/campaign.ts).
   */
  fractions: { excellent: 0.74, good: 0.86, ok: 1.0 },
};

/** Validez de los tiempos: ningún récord puede ser más rápido que esto. */
export const RECORD_RULES = {
  /** Velocidad máxima teórica (px/s) usada para descartar tiempos imposibles. */
  maxPlausibleSpeed: 240,
  /** Cantidad de puestos que se muestran en cada ranking. */
  rankingSize: 10,
  /** Entradas que se conservan por nivel y modalidad (las demás se descartan). */
  keepPerBoard: 40,
};

/**
 * Vecina que riega la vereda: el chorro cruza la vereda desde las fachadas
 * hacia el cordón, con aviso previo, y SIEMPRE deja libre un carril junto al
 * cordón (además, entre chorro y chorro se puede pasar por cualquier lado).
 * Mojarse no quita vidas: resta unos puntos y frena un poquito.
 */
export const WATER_TUNING = {
  /** Duración (s) de cada fase del ciclo: quieta, aviso y chorro. */
  idle: 1.8,
  telegraph: 0.7,
  spray: 1.5,
  /** Medio ancho (px) de la franja que moja. */
  halfWidth: 12,
  /** Carril seco mínimo (px) junto al cordón. */
  minLane: 22,
  /** Hasta dónde llega cada chorro (fracción de la vereda), en orden cíclico. */
  reaches: [0.5, 1, 0.7, 1, 0.45],
  /** Altura de salto que alcanza para pasar por arriba del chorro. */
  hitZ: 12,
  /** Tiempo sin volver a mojar al mismo jugador. */
  hitCooldown: 1.4,
  /** Distancia a la que "cuenta" haber pasado con el chorro activo. */
  nearDist: 110,
  penalty: 50,
  dodgeBonus: 100,
  slipTime: 0.9,
  slipDecel: 0.35,
};

/**
 * Gente caminando por la vereda (el centro en hora pico): caminan por la zona
 * jugable en los dos sentidos, esquivan los soretes y los árboles, y algunos
 * (los atentos) también se corren para no chocar al pibe; los que van con el
 * celular, no. Chocarse no quita vidas: resta puntos y frena, como mojarse.
 * A una persona no se la puede saltar (mide más de lo que salta el pibe).
 */
export const CROWD_TUNING = {
  /** Distancia media (px) entre peatones con `crowd: 1` y dificultad máxima. */
  spacingAtFull: 130,
  /** Cuánto más gente hay al final de un nivel difícil que al principio de uno fácil. */
  densityByDifficulty: [0.55, 1.15] as [number, number],
  /** Velocidad al caminar (px/s): entre la de una señora y la de alguien apurado. */
  speed: [14, 30] as [number, number],
  /** Probabilidad de que vaya mirando el celular (no se corre), según la dificultad. */
  distracted: [0.2, 0.55] as [number, number],
  /** Huella en el piso (para chocar y para esquivar). */
  footprint: { shape: 'rect' as const, w: 10, h: 5 },
  /** Cuánto mira hacia adelante para esquivar (px). */
  lookAhead: 30,
  /** Margen (px) que deja al pasar al lado de un sorete o de otra persona. */
  avoidMargin: 4,
  /** Velocidad (px/s) con la que se corre hacia el costado. */
  sideSpeed: 34,
  /** Franja de profundidad por la que caminan (dentro de la zona jugable). */
  yMin: 146,
  yMax: 200,
  /** Choque: puntos que resta, frenada y tiempo sin volver a chocar con la misma persona. */
  bumpPenalty: 40,
  bumpCooldown: 1.2,
  /** Después de un choque, la persona se queda quieta un instante (s). */
  bumpPause: 0.6,
};
