import { BARRIOS, FIRST_BARRIO_ID, getBarrio, nextBarrio, type BarrioDef, type LevelRef } from '../data/campaign';
import { ACHIEVEMENT_IDS, type AchievementCounts } from '../data/achievements';
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacter, isPlayable, STARTER_CHARACTERS } from '../data/characters';

/**
 * Progreso guardado (formato versión 2) y las reglas de la campaña.
 * Todo son funciones puras sobre objetos: se pueden probar sin navegador.
 */
export const SAVE_VERSION = 3;

export interface LevelProgress {
  completed: boolean;
  stars: number;
  bestScore: number;
  plays: number;
}

export interface BarrioProgress {
  unlocked: boolean;
  completed: boolean;
  levels: Record<string, LevelProgress>;
}

export interface SaveData {
  version: number;
  barrios: Record<string, BarrioProgress>;
  /** Último barrio visitado (ahí aparece la ficha en el mapa). */
  currentBarrio: string;
  /** Barrios cuya animación de desbloqueo ya se mostró en el mapa. */
  seenUnlocks: string[];
  wallet: { coins: number; totalEarned: number };
  unlocks: { characters: string[]; cosmetics: string[]; rewards: string[] };
  selectedCharacter: string;
  missions: { completions: Record<string, number>; firstRewards: string[] };
  stats: { levelsCompleted: number; crossings: number; carHits: number };
  /** Contadores de logros (desbloquean personajes). */
  achievements: AchievementCounts;
  /** Personajes cuya notificación de desbloqueo ya se mostró. */
  seenCharacters: string[];
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    barrios: { [FIRST_BARRIO_ID]: { unlocked: true, completed: false, levels: {} } },
    currentBarrio: FIRST_BARRIO_ID,
    seenUnlocks: [FIRST_BARRIO_ID],
    wallet: { coins: 0, totalEarned: 0 },
    unlocks: { characters: [...STARTER_CHARACTERS], cosmetics: [], rewards: [] },
    selectedCharacter: DEFAULT_CHARACTER_ID,
    missions: { completions: {}, firstRewards: [] },
    stats: { levelsCompleted: 0, crossings: 0, carHits: 0 },
    achievements: {},
    seenCharacters: [...STARTER_CHARACTERS],
  };
}

// ---------------------------------------------------------------------------
// Migración y validación (datos de LocalStorage: pueden venir rotos o viejos)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

function sanitizeLevel(v: unknown): LevelProgress {
  const o = isObj(v) ? v : {};
  return { completed: o.completed === true, stars: num(o.stars, 0, 0, 3), bestScore: num(o.bestScore), plays: num(o.plays) };
}

/**
 * Convierte cualquier dato guardado (o nada) al formato actual.
 * - Sin datos o datos de la v0.1 (que no tenía progreso): progreso nuevo.
 * - Versiones futuras desconocidas o datos corruptos: se rescata lo que se pueda.
 * Nunca toca los récords ni las preferencias (se guardan en otras claves).
 */
export function migrateSave(raw: unknown): SaveData {
  const base = createDefaultSave();
  if (!isObj(raw)) return base;
  // v1 → v2: no existía progreso de campaña; sólo puede haber restos sueltos.
  const save = base;
  if (isObj(raw.barrios)) {
    for (const [id, value] of Object.entries(raw.barrios)) {
      if (!getBarrio(id) || !isObj(value)) continue;
      const levels: Record<string, LevelProgress> = {};
      if (isObj(value.levels)) for (const [lid, lv] of Object.entries(value.levels)) levels[lid] = sanitizeLevel(lv);
      save.barrios[id] = { unlocked: value.unlocked === true || id === FIRST_BARRIO_ID, completed: value.completed === true, levels };
    }
  }
  if (typeof raw.currentBarrio === 'string' && getBarrio(raw.currentBarrio)) save.currentBarrio = raw.currentBarrio;
  save.seenUnlocks = Array.from(new Set([FIRST_BARRIO_ID, ...strList(raw.seenUnlocks).filter((id) => getBarrio(id))]));
  if (isObj(raw.wallet)) save.wallet = { coins: num(raw.wallet.coins), totalEarned: num(raw.wallet.totalEarned) };
  if (isObj(raw.unlocks)) {
    // Sólo personajes que existen y se pueden elegir (Don Tito pasó a ser un personaje futuro).
    const known = (id: string) => CHARACTERS.some((c) => c.id === id) && isPlayable(getCharacter(id));
    save.unlocks = {
      characters: Array.from(new Set([...STARTER_CHARACTERS, ...strList(raw.unlocks.characters).filter(known)])),
      cosmetics: strList(raw.unlocks.cosmetics),
      rewards: strList(raw.unlocks.rewards),
    };
  }
  if (typeof raw.selectedCharacter === 'string' && save.unlocks.characters.includes(raw.selectedCharacter)) save.selectedCharacter = raw.selectedCharacter;
  if (isObj(raw.missions)) {
    const completions: Record<string, number> = {};
    if (isObj(raw.missions.completions)) for (const [k, v] of Object.entries(raw.missions.completions)) completions[k] = num(v);
    save.missions = { completions, firstRewards: strList(raw.missions.firstRewards) };
  }
  if (isObj(raw.stats)) save.stats = { levelsCompleted: num(raw.stats.levelsCompleted), crossings: num(raw.stats.crossings), carHits: num(raw.stats.carHits) };
  if (isObj(raw.achievements)) {
    for (const id of ACHIEVEMENT_IDS) {
      const v = num(raw.achievements[id]);
      if (v > 0) save.achievements[id] = v;
    }
  }
  save.seenCharacters = Array.from(new Set([...STARTER_CHARACTERS, ...strList(raw.seenCharacters)]));
  // Coherencia: un barrio completo desbloquea el siguiente aunque el dato se haya perdido.
  for (const b of BARRIOS) {
    if (save.barrios[b.id]?.completed) {
      const next = nextBarrio(b.id);
      if (next) ensureBarrio(save, next.id).unlocked = true;
    }
  }
  save.version = SAVE_VERSION;
  return save;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function ensureBarrio(save: SaveData, id: string): BarrioProgress {
  if (!save.barrios[id]) save.barrios[id] = { unlocked: false, completed: false, levels: {} };
  return save.barrios[id];
}

export function isBarrioUnlocked(save: SaveData, id: string): boolean {
  return id === FIRST_BARRIO_ID || save.barrios[id]?.unlocked === true;
}

export function isBarrioCompleted(save: SaveData, id: string): boolean {
  return save.barrios[id]?.completed === true;
}

export function levelProgress(save: SaveData, levelId: string): LevelProgress {
  for (const b of Object.values(save.barrios)) if (b.levels[levelId]) return b.levels[levelId];
  return { completed: false, stars: 0, bestScore: 0, plays: 0 };
}

/** Nivel 1 abierto con el barrio; cada nivel siguiente se abre al completar el anterior. */
export function isLevelUnlocked(save: SaveData, ref: LevelRef): boolean {
  const barrio = getBarrio(ref.barrioId);
  if (!barrio || !barrio.levels[ref.levelIndex] || !isBarrioUnlocked(save, ref.barrioId)) return false;
  if (ref.levelIndex === 0) return true;
  return levelProgress(save, barrio.levels[ref.levelIndex - 1].id).completed;
}

/** La contrarreloj de un nivel se habilita después de completarlo una vez en modo normal. */
export function isTimeTrialUnlocked(save: SaveData, levelId: string): boolean {
  return levelProgress(save, levelId).completed;
}

export function barrioStars(save: SaveData, barrio: BarrioDef): { stars: number; max: number } {
  const stars = barrio.levels.reduce((acc, l) => acc + levelProgress(save, l.id).stars, 0);
  return { stars, max: barrio.levels.length * 3 };
}

/** Porcentaje de progreso de un barrio: estrellas conseguidas sobre el máximo. */
export function barrioProgressPercent(save: SaveData, barrio: BarrioDef): number {
  const { stars, max } = barrioStars(save, barrio);
  return max === 0 ? 0 : Math.round((stars / max) * 100);
}

export function completedLevels(save: SaveData, barrio: BarrioDef): number {
  return barrio.levels.filter((l) => levelProgress(save, l.id).completed).length;
}

/** Texto con lo que hace falta para desbloquear un barrio. */
export function unlockRequirement(barrioId: string): string {
  const i = BARRIOS.findIndex((b) => b.id === barrioId);
  if (i <= 0) return '';
  return `COMPLETÁ ${BARRIOS[i - 1].name} PARA DESBLOQUEARLO`;
}

// ---------------------------------------------------------------------------
// Cambios
// ---------------------------------------------------------------------------

export interface LevelResultInput {
  score: number;
  stars: number;
}

export interface LevelResultOutcome {
  firstCompletion: boolean;
  newRecord: boolean;
  previousBest: number;
  /** Estrellas nuevas conseguidas (sobre las que ya tenía). */
  newStars: number;
  totalStars: number;
  barrioCompleted: boolean;
  /** Barrio que se desbloqueó con este resultado (o null). */
  unlockedBarrio: string | null;
}

/**
 * Registra un nivel completado: estrellas (nunca bajan), récord del nivel,
 * desbloqueo del nivel siguiente y, al completar los tres, del barrio siguiente.
 * Las estrellas no impiden avanzar: completar alcanza.
 */
export function applyLevelResult(save: SaveData, ref: LevelRef, result: LevelResultInput): LevelResultOutcome {
  const barrio = getBarrio(ref.barrioId);
  const level = barrio?.levels[ref.levelIndex];
  if (!barrio || !level) throw new Error('Nivel inexistente');
  const bp = ensureBarrio(save, barrio.id);
  bp.unlocked = true;
  const prev = bp.levels[level.id] ?? { completed: false, stars: 0, bestScore: 0, plays: 0 };
  const stars = Math.max(prev.stars, Math.min(3, Math.max(1, result.stars)));
  const outcome: LevelResultOutcome = {
    firstCompletion: !prev.completed,
    newRecord: result.score > prev.bestScore,
    previousBest: prev.bestScore,
    newStars: stars - prev.stars,
    totalStars: stars,
    barrioCompleted: false,
    unlockedBarrio: null,
  };
  bp.levels[level.id] = { completed: true, stars, bestScore: Math.max(prev.bestScore, Math.floor(result.score)), plays: prev.plays + 1 };
  if (outcome.firstCompletion) save.stats.levelsCompleted++;

  const allDone = barrio.levels.every((l) => bp.levels[l.id]?.completed);
  if (allDone && !bp.completed) {
    bp.completed = true;
    outcome.barrioCompleted = true;
    const next = nextBarrio(barrio.id);
    if (next) {
      const np = ensureBarrio(save, next.id);
      if (!np.unlocked) {
        np.unlocked = true;
        outcome.unlockedBarrio = next.id;
      }
    }
  }
  return outcome;
}

/** Barrios desbloqueados cuya animación todavía no se vio en el mapa. */
export function pendingUnlocks(save: SaveData): string[] {
  return BARRIOS.filter((b) => isBarrioUnlocked(save, b.id) && !save.seenUnlocks.includes(b.id)).map((b) => b.id);
}

export function markUnlockSeen(save: SaveData, id: string): void {
  if (!save.seenUnlocks.includes(id)) save.seenUnlocks.push(id);
}

export function creditCoins(save: SaveData, amount: number): void {
  const a = Math.max(0, Math.floor(amount));
  save.wallet.coins += a;
  save.wallet.totalEarned += a;
}

export function spendCoins(save: SaveData, amount: number): boolean {
  if (amount < 0 || save.wallet.coins < amount) return false;
  save.wallet.coins -= amount;
  return true;
}

/** Reinicia el progreso de la campaña (los récords y las preferencias se guardan aparte y no se tocan). */
export function resetProgress(): SaveData {
  return createDefaultSave();
}

// ---------------------------------------------------------------------------
// Perfiles locales (archivo de guardado versión 3)
// ---------------------------------------------------------------------------

export interface ProfileRecord {
  id: string;
  nickname: string;
  createdAt: string;
  data: SaveData;
}

/** Archivo completo: varios perfiles, cada uno con su propio progreso. */
export interface SaveFile {
  version: 3;
  activeProfileId: string;
  profiles: ProfileRecord[];
}

export const MAX_PROFILES = 6;
export const NICKNAME_MAX = 10;
const NICK_CHARS = /[^A-ZÑÁÉÍÓÚÜ0-9 ]/g;

/** Apodo válido: mayúsculas, números y espacios, hasta 10 caracteres. */
export function sanitizeNickname(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.toUpperCase().replace(NICK_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
}

let idCounter = 0;
export function newProfileId(): string {
  idCounter++;
  return `p-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createProfile(nickname: string, data: SaveData = createDefaultSave()): ProfileRecord {
  return { id: newProfileId(), nickname: sanitizeNickname(nickname) || 'JUGADOR', createdAt: new Date().toISOString(), data };
}

export function createSaveFile(): SaveFile {
  const first = createProfile('JUGADOR 1');
  return { version: 3, activeProfileId: first.id, profiles: [first] };
}

/**
 * Convierte cualquier guardado al formato con perfiles:
 *  - v0.1 / sin datos: un perfil nuevo.
 *  - v0.2 (un solo progreso): pasa a ser el perfil "JUGADOR 1", sin perder nada.
 *  - v0.3: se valida cada perfil.
 */
export function migrateSaveFile(raw: unknown): SaveFile {
  if (isObj(raw) && Array.isArray(raw.profiles)) {
    const profiles: ProfileRecord[] = [];
    for (const p of raw.profiles.slice(0, MAX_PROFILES)) {
      if (!isObj(p)) continue;
      const id = typeof p.id === 'string' && p.id ? p.id : newProfileId();
      if (profiles.some((x) => x.id === id)) continue;
      profiles.push({
        id,
        nickname: sanitizeNickname(p.nickname) || `JUGADOR ${profiles.length + 1}`,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        data: migrateSave(p.data),
      });
    }
    if (profiles.length === 0) return createSaveFile();
    const active = typeof raw.activeProfileId === 'string' && profiles.some((p) => p.id === raw.activeProfileId) ? raw.activeProfileId : profiles[0].id;
    return { version: 3, activeProfileId: active, profiles };
  }
  const first = createProfile('JUGADOR 1', migrateSave(raw));
  return { version: 3, activeProfileId: first.id, profiles: [first] };
}
