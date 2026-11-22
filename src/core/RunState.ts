import { PLAYER_TUNING } from '../config/balance';
import type { AchievementCounts } from '../data/achievements';
import type { LevelRef } from '../data/campaign';
import { DEFAULT_CHARACTER_ID } from '../data/characters';
import type { GameMode } from './leaderboard';

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
  /** Tiempo del cronómetro al llegar a la esquina y parciales de cada esquina. */
  elapsedMs: number;
  splits: number[];
  missionsDone: number;
}

/** Estado de una partida de un nivel. */
export interface RunState {
  levelRef: LevelRef;
  /** Identificador único del intento (evita registrar dos veces el mismo récord). */
  runId: string;
  /** Intento del que viene (al retomar desde una esquina), o null. */
  parentRunId: string | null;
  mode: GameMode;
  /** Personaje elegido: no cambia durante la partida (ni al reintentar desde un checkpoint). */
  characterId: string;
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
  /** Partida asistida (checkpoint o atajo de depuración): no entra al ranking de velocidad. */
  assisted: boolean;
  checkpoint: Checkpoint | null;
  /** Soretes esquivados que ya se sumaron a las estadísticas guardadas. */
  dodgesSubmitted: number;
  missionDone: boolean;
  /** Misiones completadas en la partida (para la pantalla de resultados). */
  missionsDone: number;
  /** Bonus de primera vez de una misión ganado y todavía no acreditado (se guarda con las monedas). */
  missionFirstPending: string | null;
  crossingsDone: number;
  carHits: number;
  /** Logros de esta partida todavía no acreditados al perfil. */
  achievements: AchievementCounts;
  /** Tiempo con el que arranca el cronómetro (al retomar desde un checkpoint). */
  startElapsedMs: number;
  splits: number[];
}

let runCounter = 0;
export function newRunId(): string {
  runCounter++;
  return `r-${Date.now().toString(36)}-${runCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export interface RunOptions {
  seed?: number | null;
  mode?: GameMode;
  characterId?: string;
}

export function createRun(levelRef: LevelRef, opts: RunOptions = {}): RunState {
  return {
    levelRef: { ...levelRef },
    runId: newRunId(),
    parentRunId: null,
    mode: opts.mode ?? 'normal',
    characterId: opts.characterId ?? DEFAULT_CHARACTER_ID,
    seed: opts.seed ?? null,
    lives: PLAYER_TUNING.lives,
    lifeMarks: [],
    poopHits: 0,
    coins: 0,
    coinsBanked: 0,
    continues: 0,
    assisted: false,
    checkpoint: null,
    dodgesSubmitted: 0,
    missionDone: false,
    missionsDone: 0,
    missionFirstPending: null,
    crossingsDone: 0,
    carHits: 0,
    achievements: {},
    startElapsedMs: 0,
    splits: [],
  };
}

/**
 * Partida nueva que retoma desde el último checkpoint: zapatillas limpias,
 * y puntaje, monedas, misiones y cronómetro exactamente como estaban en esa
 * esquina. Queda marcada como asistida (no entra al ranking de velocidad).
 */
export function runFromCheckpoint(run: RunState): RunState {
  const cp = run.checkpoint;
  if (!cp) return createRun(run.levelRef, { seed: run.seed, mode: run.mode, characterId: run.characterId });
  return {
    ...createRun(run.levelRef, { seed: run.seed, mode: run.mode, characterId: run.characterId }),
    parentRunId: run.runId,
    coins: cp.coins,
    // Lo de antes del checkpoint ya se acreditó al llegar a esa esquina.
    coinsBanked: cp.coins,
    continues: run.continues + 1,
    assisted: true,
    checkpoint: { ...cp, score: { ...cp.score }, splits: [...cp.splits] },
    dodgesSubmitted: run.dodgesSubmitted,
    missionDone: cp.missionDone,
    missionsDone: cp.missionsDone,
    crossingsDone: cp.crossingsDone,
    carHits: cp.carHits,
    startElapsedMs: cp.elapsedMs,
    splits: [...cp.splits],
  };
}

/** Monedas pendientes de acreditar (y las marca como acreditadas). */
export function takeUnbankedCoins(run: RunState): number {
  const delta = Math.max(0, run.coins - run.coinsBanked);
  run.coinsBanked = run.coins;
  return delta;
}
