import {
  COIN_TUNING,
  CROSSING_TUNING,
  PIXELS_PER_METER,
  RECORD_RULES,
  SCORING,
  SPEED_BONUS,
  WATER_TUNING,
} from '../../config/balance';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from '../../data/achievements';
import { BARRIOS } from '../../data/campaign';
import { CHARACTERS, isPlayable } from '../../data/characters';
import { MISSIONS } from '../../data/missions';
import { OBSTACLE_TYPES } from '../../entities/obstacles/ObstacleTypes';
import { buildLevel, speedTargets } from '../../world/levelBuilder';
import { AVATARS } from '../avatars';
import { BANNED_WORDS } from '../nicknameRules';

/**
 * Reglas del juego que necesita el servidor para validar resultados.
 *
 * Se calculan a partir del código (los niveles se generan con su semilla, así
 * que son siempre iguales) y se exportan como una migración SQL con
 * `npm run online:rules`. Una prueba avisa si el juego cambió y la migración
 * quedó vieja.
 */

/** Píxeles extra que se puede avanzar después de la última esquina (la cámara frena ~90 px después). */
const END_OVERSHOOT_PX = 120;
const MAX_MULTIPLIER = Math.max(...SCORING.comboLevels.map((l) => l.multiplier));

export interface LevelRules {
  id: string;
  barrioId: string;
  levelIndex: number;
  levelNumber: number;
  environment: string;
  blocks: number;
  crossings: number;
  coins: number;
  dodgeables: number;
  waterLadies: number;
  missionId: string | null;
  missionKind: 'trash' | 'animal' | null;
  missionItems: number;
  missionPoints: number;
  missionCoins: number;
  missionFirstBonus: number;
  starsTwo: number;
  starsThree: number;
  timeExcellentS: number;
  timeGoodS: number;
  timeOkS: number;
  minTimeMs: number;
  maxDistancePoints: number;
  maxDodgePoints: number;
  maxBonusPoints: number;
  maxScore: number;
}

export interface GameRulesData {
  version: string;
  speedBonus: { excellent: number; good: number; ok: number };
  coinsPerNewStar: number;
  maxProfilesPerAccount: number;
  barrios: { id: string; sortOrder: number; name: string }[];
  levels: LevelRules[];
  characters: { id: string; name: string; playable: boolean; starter: boolean; unlockCounter: string | null; unlockTarget: number | null }[];
  achievements: { id: string; label: string }[];
  avatars: { id: string; label: string }[];
  bannedWords: { word: string; match: 'exact' | 'contains' }[];
}

export const MAX_ONLINE_PROFILES = 6;

export function computeLevelRules(): LevelRules[] {
  const out: LevelRules[] = [];
  for (const barrio of BARRIOS) {
    barrio.levels.forEach((level, levelIndex) => {
      const built = buildLevel({ barrioId: barrio.id, levelIndex });
      const { layout } = built;
      const span = layout.length - layout.startX;
      const mission = layout.mission ? MISSIONS[layout.mission.id] : null;
      const dodgeables = layout.obstacles.filter((o) => OBSTACLE_TYPES[o.type].dodgeable).length;
      const targets = level.timeTargets ?? speedTargets(layout);
      const maxDistancePoints = (Math.floor((span + END_OVERSHOOT_PX) / PIXELS_PER_METER) + 1) * SCORING.pointsPerMeter;
      const maxDodgePoints = dodgeables * (SCORING.dodgePoints + SCORING.closeCallBonus) * MAX_MULTIPLIER;
      const maxBonusPoints =
        layout.coins.length * COIN_TUNING.pickupPoints +
        layout.blocks.length * SCORING.perfectBlockBonus +
        layout.crossings.length * (CROSSING_TUNING.greenBonus + CROSSING_TUNING.cleanBonus) +
        (mission?.rewardPoints ?? 0) +
        layout.waterLadies.length * WATER_TUNING.dodgeBonus +
        SPEED_BONUS.points.excellent;
      out.push({
        id: level.id,
        barrioId: barrio.id,
        levelIndex,
        levelNumber: level.number,
        environment: level.environment,
        blocks: layout.blocks.length,
        crossings: layout.crossings.length,
        coins: layout.coins.length,
        dodgeables,
        waterLadies: layout.waterLadies.length,
        missionId: mission?.id ?? null,
        missionKind: mission?.kind ?? null,
        missionItems: mission?.itemsRequired ?? 0,
        missionPoints: mission?.rewardPoints ?? 0,
        missionCoins: mission?.rewardCoins ?? 0,
        missionFirstBonus: mission?.firstTimeBonus ?? 0,
        starsTwo: built.stars.two,
        starsThree: built.stars.three,
        timeExcellentS: targets.excellent,
        timeGoodS: targets.good,
        timeOkS: targets.ok,
        // El mismo mínimo que usa el juego para descartar tiempos imposibles.
        minTimeMs: Math.floor((span / RECORD_RULES.maxPlausibleSpeed) * 1000),
        maxDistancePoints,
        maxDodgePoints,
        maxBonusPoints,
        maxScore: maxDistancePoints + maxDodgePoints + maxBonusPoints,
      });
    });
  }
  return out;
}

export function computeGameRules(): GameRulesData {
  const data: Omit<GameRulesData, 'version'> = {
    speedBonus: { ...SPEED_BONUS.points },
    coinsPerNewStar: COIN_TUNING.newStarCoins,
    maxProfilesPerAccount: MAX_ONLINE_PROFILES,
    barrios: BARRIOS.map((b, i) => ({ id: b.id, sortOrder: i, name: b.name })),
    levels: computeLevelRules(),
    characters: CHARACTERS.map((c) => ({
      id: c.id,
      name: c.name,
      playable: isPlayable(c),
      starter: c.unlock.kind === 'starter',
      unlockCounter: c.unlock.kind === 'starter' ? null : c.unlock.counter,
      unlockTarget: c.unlock.kind === 'starter' ? null : c.unlock.target,
    })),
    achievements: ACHIEVEMENT_IDS.map((id) => ({ id, label: ACHIEVEMENTS[id].label })),
    avatars: AVATARS.map((a) => ({ id: a.id, label: a.label })),
    bannedWords: BANNED_WORDS.map((w) => ({ ...w })),
  };
  return { version: `r-${hash(JSON.stringify(data))}`, ...data };
}

/** FNV-1a de 32 bits (sólo para identificar la versión de las reglas). */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const q = (v: string | number | boolean | null): string => {
  if (v === null) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${v.replace(/'/g, "''")}'`;
};
const row = (values: (string | number | boolean | null)[]) => `  (${values.map(q).join(', ')})`;
const upsert = (table: string, cols: string[], rows: (string | number | boolean | null)[][], key: string) => {
  const updates = cols.filter((c) => c !== key).map((c) => `${c} = excluded.${c}`);
  return `insert into public.${table} (${cols.join(', ')}) values\n${rows.map(row).join(',\n')}\non conflict (${key}) do update set\n  ${updates.join(',\n  ')};\n`;
};

/** Migración que carga (o actualiza) las reglas en la base de datos. */
export function renderRulesSql(data: GameRulesData = computeGameRules()): string {
  const levelIds = data.levels.map((l) => q(l.id)).join(', ');
  return [
    '-- =====================================================================',
    '-- ESQUIVA SORETES · Reglas del juego para validar partidas online.',
    '-- GENERADO con `npm run online:rules` a partir del código: no editar a mano.',
    `-- Versión de las reglas: ${data.version}`,
    '-- =====================================================================',
    '',
    upsert(
      'game_rules',
      ['id', 'version', 'speed_bonus_excellent', 'speed_bonus_good', 'speed_bonus_ok', 'coins_per_new_star', 'max_profiles_per_account'],
      [[1, data.version, data.speedBonus.excellent, data.speedBonus.good, data.speedBonus.ok, data.coinsPerNewStar, data.maxProfilesPerAccount]],
      'id',
    ),
    upsert('game_barrios', ['id', 'sort_order', 'name'], data.barrios.map((b) => [b.id, b.sortOrder, b.name]), 'id'),
    upsert(
      'game_levels',
      [
        'id', 'barrio_id', 'level_index', 'level_number', 'environment', 'active', 'blocks', 'crossings', 'coins', 'dodgeables',
        'water_ladies', 'mission_id', 'mission_kind', 'mission_items', 'mission_points', 'mission_coins', 'mission_first_bonus',
        'stars_two', 'stars_three', 'time_excellent_s', 'time_good_s', 'time_ok_s', 'min_time_ms', 'max_distance_points',
        'max_dodge_points', 'max_bonus_points', 'max_score',
      ],
      data.levels.map((l) => [
        l.id, l.barrioId, l.levelIndex, l.levelNumber, l.environment, true, l.blocks, l.crossings, l.coins, l.dodgeables,
        l.waterLadies, l.missionId, l.missionKind, l.missionItems, l.missionPoints, l.missionCoins, l.missionFirstBonus,
        l.starsTwo, l.starsThree, l.timeExcellentS, l.timeGoodS, l.timeOkS, l.minTimeMs, l.maxDistancePoints,
        l.maxDodgePoints, l.maxBonusPoints, l.maxScore,
      ]),
      'id',
    ),
    `update public.game_levels set active = false where id not in (${levelIds});\n`,
    upsert(
      'game_characters',
      ['id', 'name', 'playable', 'starter', 'unlock_counter', 'unlock_target'],
      data.characters.map((c) => [c.id, c.name, c.playable, c.starter, c.unlockCounter, c.unlockTarget]),
      'id',
    ),
    upsert('game_achievements', ['id', 'label'], data.achievements.map((a) => [a.id, a.label]), 'id'),
    upsert('game_avatars', ['id', 'label'], data.avatars.map((a) => [a.id, a.label]), 'id'),
    'delete from public.game_banned_words;',
    `insert into public.game_banned_words (word, match) values\n${data.bannedWords.map((w) => row([w.word, w.match])).join(',\n')};\n`,
  ].join('\n');
}
