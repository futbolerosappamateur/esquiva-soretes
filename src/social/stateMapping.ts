import { ACHIEVEMENT_IDS, type AchievementCounts } from '../data/achievements';
import { BARRIOS } from '../data/campaign';
import { CHARACTERS, DEFAULT_CHARACTER_ID, isPlayable, STARTER_CHARACTERS } from '../data/characters';
import type { GameMode, RecordEntry } from '../core/leaderboard';
import { migrateSave, type SaveData } from '../core/progress';
import type { ImportPayload, ProfileState } from './types';

/**
 * Traducción entre el progreso guardado en el servidor y el formato local
 * del juego. El servidor manda: al sincronizar, el progreso local de un
 * perfil online se reemplaza por el del servidor (sólo se conservan
 * preferencias de este dispositivo, como el último barrio visitado).
 */
export function saveFromServer(state: ProfileState, local: SaveData | null): SaveData {
  const barrios: Record<string, { unlocked: boolean; completed: boolean; levels: Record<string, { completed: boolean; stars: number; bestScore: number; plays: number }> }> = {};
  BARRIOS.forEach((b, i) => {
    const levels: (typeof barrios)[string]['levels'] = {};
    for (const l of b.levels) {
      const s = state.levels[l.id];
      if (s) levels[l.id] = { completed: s.completed, stars: s.stars, bestScore: s.bestScore, plays: s.plays };
    }
    const completed = b.levels.length > 0 && b.levels.every((l) => state.levels[l.id]?.completed);
    const prev = i > 0 ? barrios[BARRIOS[i - 1].id] : null;
    // Un barrio donde ya se completó algún nivel nunca queda bloqueado (por ejemplo,
    // si después se sumó un barrio antes en la campaña).
    const unlocked = i === 0 || prev?.completed === true || Object.values(levels).some((l) => l.completed);
    if (unlocked || Object.keys(levels).length > 0) barrios[b.id] = { unlocked, completed, levels };
  });

  const known = new Set(CHARACTERS.filter(isPlayable).map((c) => c.id));
  const characters = Array.from(new Set([...STARTER_CHARACTERS, ...state.characters.map((c) => c.id).filter((id) => known.has(id))]));
  const achievements: AchievementCounts = {};
  for (const id of ACHIEVEMENT_IDS) {
    const v = state.achievements[id];
    if (typeof v === 'number' && v > 0) achievements[id] = v;
  }
  const unlockedBarrios = Object.entries(barrios).filter(([, b]) => b.unlocked).map(([id]) => id);
  const favorite = state.profile.favoriteCharacter;
  const selected =
    local && characters.includes(local.selectedCharacter)
      ? local.selectedCharacter
      : favorite && characters.includes(favorite)
        ? favorite
        : DEFAULT_CHARACTER_ID;

  return migrateSave({
    barrios,
    currentBarrio: local && unlockedBarrios.includes(local.currentBarrio) ? local.currentBarrio : unlockedBarrios[unlockedBarrios.length - 1],
    // En un dispositivo nuevo no se repiten los avisos de lo que ya estaba desbloqueado.
    seenUnlocks: local ? local.seenUnlocks : unlockedBarrios,
    wallet: { coins: state.stats.coins, totalEarned: state.stats.coinsEarned },
    unlocks: { characters, cosmetics: local?.unlocks.cosmetics ?? [], rewards: local?.unlocks.rewards ?? [] },
    selectedCharacter: selected,
    missions: { completions: local?.missions.completions ?? {}, firstRewards: [...state.missionRewards] },
    stats: { levelsCompleted: state.stats.levelsCompleted, crossings: state.stats.crossings, carHits: state.stats.carHits },
    achievements,
    seenCharacters: local ? local.seenCharacters : characters,
  });
}

/** Ids de partida que acepta el servidor (letras, números, punto, guion y guion bajo). */
const safeId = (id: string) => id.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 56);

/**
 * Progreso y récords de un perfil local, para importarlos a un perfil
 * online (quedan como "no verificados": nunca entran a rankings oficiales).
 */
export function importPayloadFrom(save: SaveData, bestEntries: RecordEntry[]): ImportPayload {
  const levels: ImportPayload['levels'] = {};
  for (const b of Object.values(save.barrios)) {
    for (const [id, l] of Object.entries(b.levels)) {
      if (l.completed) levels[id] = { completed: true, stars: l.stars, bestScore: l.bestScore, plays: l.plays };
    }
  }
  const seen = new Set<string>();
  const records: ImportPayload['records'] = [];
  for (const e of bestEntries) {
    const id = safeId(e.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    records.push({ id, levelId: e.levelId, mode: e.mode, characterId: e.characterId, timeMs: e.timeMs, score: e.score, date: e.date, assisted: e.assisted });
  }
  return {
    levels,
    coins: save.wallet.coins,
    achievements: { ...save.achievements },
    missionRewards: [...save.missions.firstRewards],
    records,
  };
}

/** Mejores marcas de un perfil local en cada nivel y modalidad (lo que vale la pena importar). */
export function localBestEntries(
  personalBest: (levelId: string, mode: GameMode) => { time: RecordEntry | null; score: RecordEntry | null },
): RecordEntry[] {
  const out: RecordEntry[] = [];
  for (const b of BARRIOS) {
    for (const l of b.levels) {
      for (const mode of ['normal', 'timeTrial'] as GameMode[]) {
        const pb = personalBest(l.id, mode);
        if (pb.time) out.push(pb.time);
        if (pb.score && pb.score.id !== pb.time?.id) out.push(pb.score);
      }
    }
  }
  return out;
}
