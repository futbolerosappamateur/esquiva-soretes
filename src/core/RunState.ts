import { PLAYER_TUNING } from '../config/balance';
import type { LevelRef } from '../data/campaign';

/** Qué le pasó a cada zapatilla perdida (para el ícono de la HUD). */
export type LifeMark = 'poop' | 'car';

/** Estado del puntaje que se puede guardar y restaurar (checkpoints). */
export interface ScoreSnapshot {
  score: number;
  bestStreak: number;
  dodged: number;
  closeCalls: number;
  hits: number;
  looseTiles: number;
  distancePoints: number;
  dodgePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  metersAwarded: number;
}

/**
 * Punto de control: se registra al completar cada cuadra. Guarda todo lo
 * necesario para retomar desde la esquina, sin poder cobrar dos veces los
 * bonus ni las monedas de lo que se juega después.
 */
export interface Checkpoint {
  /** Cuadras completadas al llegar a esta esquina. */
  blocksCompleted: number;
  x: number;
  y: number;
  score: ScoreSnapshot;
  coins: number;
  crossingsDone: number;
  missionDone: boolean;
  carHits: number;
}

/** Estado de una partida de un nivel. */
export interface RunState {
  levelRef: LevelRef;
  /** Semilla forzada por depuración (?seed); null = la del nivel. */
  seed: number | null;
  lives: number;
  lifeMarks: LifeMark[];
  /** Soretes pisados (determina qué tan sucias se ven las zapatillas). */
  poopHits: number;
  /** Monedas juntadas en la partida y cuántas ya se acreditaron a la billetera. */
  coins: number;
  coinsBanked: number;
  /** Veces que se retomó desde un checkpoint. */
  continues: number;
  checkpoint: Checkpoint | null;
  /** Soretes esquivados que ya se sumaron a las estadísticas guardadas. */
  dodgesSubmitted: number;
  missionDone: boolean;
  /** Bonus de primera vez de una misión ganado y todavía no acreditado (se guarda con las monedas). */
  missionFirstPending: string | null;
  crossingsDone: number;
  carHits: number;
}

export function createRun(levelRef: LevelRef, seed: number | null = null): RunState {
  return {
    levelRef: { ...levelRef },
    seed,
    lives: PLAYER_TUNING.lives,
    lifeMarks: [],
    poopHits: 0,
    coins: 0,
    coinsBanked: 0,
    continues: 0,
    checkpoint: null,
    dodgesSubmitted: 0,
    missionDone: false,
    missionFirstPending: null,
    crossingsDone: 0,
    carHits: 0,
  };
}

/**
 * Partida nueva que retoma desde el último checkpoint: zapatillas limpias,
 * y puntaje, monedas y misiones exactamente como estaban en esa esquina.
 */
export function runFromCheckpoint(run: RunState): RunState {
  const cp = run.checkpoint;
  if (!cp) return createRun(run.levelRef, run.seed);
  return {
    ...createRun(run.levelRef, run.seed),
    coins: cp.coins,
    // Lo de antes del checkpoint ya se acreditó al llegar a esa esquina.
    coinsBanked: cp.coins,
    continues: run.continues + 1,
    checkpoint: { ...cp, score: { ...cp.score } },
    dodgesSubmitted: run.dodgesSubmitted,
    missionDone: cp.missionDone,
    crossingsDone: cp.crossingsDone,
    carHits: cp.carHits,
  };
}

/** Monedas pendientes de acreditar (y las marca como acreditadas). */
export function takeUnbankedCoins(run: RunState): number {
  const delta = Math.max(0, run.coins - run.coinsBanked);
  run.coinsBanked = run.coins;
  return delta;
}
