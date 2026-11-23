import type { AchievementCounts } from '../data/achievements';
import type { GameMode } from '../core/leaderboard';
import type { RunReport } from './types';

/**
 * Arma el informe de una partida para el servidor a partir del resultado
 * que ya calcula el juego (LevelResult cumple esta interfaz). Es una función
 * pura: no lee nada del navegador.
 */
export interface RunReportSource {
  run: {
    runId: string;
    parentRunId?: string | null;
    continues: number;
    startElapsedMs: number;
    splits: number[];
    crossingsDone: number;
    carHits: number;
    missionsDone: number;
  };
  levelId: string;
  mode: GameMode;
  characterId: string;
  completed: boolean;
  timeMs: number;
  score: number;
  assisted: boolean;
  assistReasons: ('checkpoint' | 'debug')[];
  startBlock: number;
  blocksCompleted: number;
  shoesLeft: number;
  distancePoints: number;
  dodgePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  crossingBonus: number;
  speedBonus: number;
  dodged: number;
  bestStreak: number;
  closeCalls: number;
  attempt: { dodged: number; crossings: number; carHits: number; missions: number; coinsBanked: number; achievements: AchievementCounts };
}

const int = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

export function buildRunReport(src: RunReportSource, clientVersion: string, now: Date = new Date()): RunReport {
  const achievements: AchievementCounts = {};
  for (const [id, n] of Object.entries(src.attempt.achievements) as [keyof AchievementCounts, number | undefined][]) {
    if (n && n > 0) achievements[id] = int(n);
  }
  const splits = src.run.splits.map(int);
  return {
    clientRunId: src.run.runId,
    parentRunId: src.run.parentRunId ?? null,
    levelId: src.levelId,
    mode: src.mode,
    characterId: src.characterId,
    completed: src.completed,
    timeMs: int(src.timeMs),
    startTimeMs: int(src.run.startElapsedMs),
    score: int(src.score),
    assisted: src.assisted,
    assistReasons: [...new Set(src.assistReasons)],
    continues: int(src.run.continues),
    startBlock: int(src.startBlock),
    blocksCompleted: int(src.blocksCompleted),
    shoesLeft: int(src.shoesLeft),
    breakdown: {
      distance: int(src.distancePoints),
      dodge: int(src.dodgePoints),
      bonus: int(src.bonusPoints),
      penalty: int(src.penaltyPoints),
      crossing: int(src.crossingBonus),
      speed: int(src.speedBonus),
    },
    counts: {
      dodged: int(src.dodged),
      bestStreak: int(src.bestStreak),
      closeCalls: int(src.closeCalls),
      crossings: int(src.run.crossingsDone),
      carHits: int(src.run.carHits),
      missions: int(src.run.missionsDone),
    },
    attempt: {
      dodged: int(src.attempt.dodged),
      crossings: int(src.attempt.crossings),
      carHits: int(src.attempt.carHits),
      missions: int(src.attempt.missions),
      coinsBanked: int(src.attempt.coinsBanked),
      achievements,
    },
    splits,
    playedAt: now.toISOString(),
    clientVersion,
    events: { v: 1, splits },
  };
}
