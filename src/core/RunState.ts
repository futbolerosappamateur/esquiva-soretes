import { PLAYER_TUNING } from '../config/balance';
import { randomSeed } from './rng';

/**
 * Estado de una partida completa. Viaja entre cuadras: el puntaje y las
 * zapatillas limpias se conservan al pasar a la siguiente cuadra.
 */
export interface RunState {
  seed: number;
  blockIndex: number;
  score: number;
  lives: number;
  totalDistanceM: number;
  totalDodged: number;
  blocksCompleted: number;
  /** Soretes esquivados que ya se sumaron a las estadísticas guardadas. */
  dodgesSubmitted: number;
}

export function createRun(seed: number = randomSeed()): RunState {
  return {
    seed,
    blockIndex: 0,
    score: 0,
    lives: PLAYER_TUNING.lives,
    totalDistanceM: 0,
    totalDodged: 0,
    blocksCompleted: 0,
    dodgesSubmitted: 0,
  };
}
