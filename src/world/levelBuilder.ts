import { blockLengthFor, CAMPAIGN_TUNING, CROSSING_TUNING, PIXELS_PER_METER, SCORING, SPEED_BONUS, STAR_RULES, WATER_TUNING } from '../config/balance';
import { lerp } from '../core/math';
import { getLevel, seedFromString, type BarrioDef, type LevelDef, type LevelRef } from '../data/campaign';
import { getEnvironment, type EnvironmentDef } from '../data/environments';
import { OBSTACLE_TYPES } from '../entities/obstacles/ObstacleTypes';
import { generateLevelLayout, type BlockSpec } from './LevelGenerator';
import type { LevelLayout } from './LevelLayout';
import { THEMES, type NeighborhoodTheme } from './themes';

export interface StarThresholds {
  two: number;
  three: number;
}

/** Un nivel listo para jugar: datos de campaña + mundo generado. */
export interface BuiltLevel {
  ref: LevelRef;
  barrio: BarrioDef;
  level: LevelDef;
  env: EnvironmentDef;
  theme: NeighborhoodTheme;
  seed: number;
  layout: LevelLayout;
  stars: StarThresholds;
}

export interface BuildOverrides {
  seed?: number | null;
  environment?: string | null;
}

/** Cuadras del nivel con su largo y su tramo de dificultad. */
export function blockSpecsFor(level: LevelDef): BlockSpec[] {
  const n = Math.min(level.blocks.length, CAMPAIGN_TUNING.blocksPerLevel);
  const length = blockLengthFor(level.durationScale ?? 1);
  const [d0, d1] = level.difficulty;
  return level.blocks.slice(0, n).map((street, i) => ({
    street,
    length,
    difficulty: [lerp(d0, d1, i / n), lerp(d0, d1, (i + 1) / n)] as [number, number],
    script: level.scripts?.[i],
  }));
}

export function levelSeed(level: LevelDef): number {
  return level.seed ?? seedFromString(level.id);
}

export function buildLevel(ref: LevelRef, overrides: BuildOverrides = {}): BuiltLevel {
  const found = getLevel(ref);
  if (!found) throw new Error(`Nivel inexistente: ${ref.barrioId} #${ref.levelIndex + 1}`);
  const { barrio, level } = found;
  const env = getEnvironment(overrides.environment ?? level.environment);
  const theme = THEMES[barrio.theme] ?? THEMES['san-telmo'];
  const seed = overrides.seed ?? levelSeed(level);
  const layout = generateLevelLayout({
    theme,
    env,
    seed,
    blocks: blockSpecsFor(level),
    traffic: level.traffic ?? 1,
    missionBlock: level.missionBlock ?? null,
    missionId: level.missionId,
    waterBlocks: level.waterBlocks,
  });
  return { ref, barrio, level, env, theme, seed, layout, stars: level.stars ?? starThresholds(layout) };
}

/**
 * Puntaje de referencia de un nivel: lo que sumaría una partida muy buena
 * (todos los metros, todos los soretes con un multiplicador típico, todos los
 * cruces en verde y la mitad de las cuadras perfectas).
 */
export function referenceScore(layout: LevelLayout): number {
  const meters = Math.floor((layout.length - layout.startX) / PIXELS_PER_METER);
  const dodgeables = layout.obstacles.filter((o) => OBSTACLE_TYPES[o.type].dodgeable).length;
  return (
    meters * SCORING.pointsPerMeter +
    dodgeables * SCORING.dodgePoints * STAR_RULES.referenceMultiplier +
    layout.crossings.length * (CROSSING_TUNING.greenBonus + CROSSING_TUNING.cleanBonus) +
    layout.blocks.length * SCORING.perfectBlockBonus * 0.5 +
    layout.waterLadies.length * WATER_TUNING.dodgeBonus
  );
}

const round500 = (v: number) => Math.max(500, Math.round(v / 500) * 500);

export function starThresholds(layout: LevelLayout): StarThresholds {
  const ref = referenceScore(layout);
  return { two: round500(ref * STAR_RULES.twoStarsFraction), three: round500(ref * STAR_RULES.threeStarsFraction) };
}

/** Estrellas logradas al completar un nivel (completar ya da una). */
export function starsFor(score: number, thresholds: StarThresholds): number {
  if (score >= thresholds.three) return 3;
  if (score >= thresholds.two) return 2;
  return 1;
}

/** Tiempos (segundos) para el bonus de velocidad: excelente, bueno y aceptable. */
export interface SpeedTargets {
  excellent: number;
  good: number;
  ok: number;
}

/** Umbrales por defecto: fracciones de la duración estimada del nivel (ver SPEED_BONUS). */
export function speedTargets(layout: LevelLayout): SpeedTargets {
  const est = estimatedDuration(layout);
  const f = SPEED_BONUS.fractions;
  return { excellent: Math.round(est * f.excellent), good: Math.round(est * f.good), ok: Math.round(est * f.ok) };
}

/** Duración estimada (segundos) de un nivel en una partida normal. */
export function estimatedDuration(layout: LevelLayout): number {
  const walk = (layout.length - layout.startX) / CAMPAIGN_TUNING.estimatedSpeed;
  return walk + layout.crossings.length * CAMPAIGN_TUNING.estimatedCrossingSeconds;
}
