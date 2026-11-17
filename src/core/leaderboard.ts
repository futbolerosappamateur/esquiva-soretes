import { RECORD_RULES } from '../config/balance';

/**
 * Récords y clasificaciones (por ahora locales, guardados en el navegador).
 *
 * Dos sistemas independientes por nivel y modalidad:
 *  - VELOCIDAD: menor tiempo. Sólo partidas oficiales (desde el inicio, sin
 *    checkpoints ni atajos de depuración).
 *  - PUNTUACIÓN: mayor puntaje (las partidas asistidas se muestran marcadas).
 *
 * La lógica de orden y validación es pura (sin navegador) y la persistencia
 * pasa por RecordsRepository: más adelante se puede agregar una
 * implementación remota (Supabase u otro backend). En ese caso los
 * resultados deberán validarse en el servidor y no confiar sólo en los
 * tiempos que envía el navegador.
 */
export type GameMode = 'normal' | 'timeTrial';

export interface RecordEntry {
  /** Identificador único de la partida (evita duplicados). */
  id: string;
  levelId: string;
  mode: GameMode;
  profileId: string;
  nickname: string;
  characterId: string;
  /** Tiempo final en milisegundos (null en récords viejos de la v0.2, que no lo tenían). */
  timeMs: number | null;
  score: number;
  /** Fecha ISO. */
  date: string;
  shoesLeft: number;
  /** Retomó desde un checkpoint o usó un atajo de depuración: no entra al ranking de velocidad. */
  assisted: boolean;
  continues: number;
  /** Importado de la versión anterior (sólo puntaje). */
  legacy?: boolean;
  /** Tiempo acumulado al llegar a cada esquina (para comparar parciales). */
  splits?: number[];
}

export interface SubmitResult {
  added: boolean;
  reason?: 'duplicate' | 'invalid';
}

/** ¿Cuenta para el ranking oficial de velocidad? */
export function isOfficialTime(e: RecordEntry): boolean {
  return !e.assisted && !e.legacy && typeof e.timeMs === 'number' && Number.isFinite(e.timeMs) && e.timeMs > 0;
}

const board = (entries: readonly RecordEntry[], levelId: string, mode: GameMode) => entries.filter((e) => e.levelId === levelId && e.mode === mode);

/** Velocidad: menor tiempo; empate → mayor puntaje → fecha más antigua → id. */
export function compareSpeed(a: RecordEntry, b: RecordEntry): number {
  return (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || b.score - a.score || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

/** Puntuación: mayor puntaje; empate → partida sin asistencia → menor tiempo (sin tiempo al final) → fecha más antigua → id. */
export function compareScore(a: RecordEntry, b: RecordEntry): number {
  return b.score - a.score || Number(a.assisted) - Number(b.assisted) || (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

export function speedRanking(entries: readonly RecordEntry[], levelId: string, mode: GameMode, limit = RECORD_RULES.rankingSize): RecordEntry[] {
  return board(entries, levelId, mode).filter(isOfficialTime).sort(compareSpeed).slice(0, limit);
}

export function scoreRanking(entries: readonly RecordEntry[], levelId: string, mode: GameMode, limit = RECORD_RULES.rankingSize): RecordEntry[] {
  return board(entries, levelId, mode).sort(compareScore).slice(0, limit);
}

/** Mejor tiempo oficial de cada personaje, ordenado de más rápido a más lento. */
export function bestByCharacter(entries: readonly RecordEntry[], levelId: string, mode: GameMode): RecordEntry[] {
  const best = new Map<string, RecordEntry>();
  for (const e of board(entries, levelId, mode).filter(isOfficialTime)) {
    const prev = best.get(e.characterId);
    if (!prev || compareSpeed(e, prev) < 0) best.set(e.characterId, e);
  }
  return [...best.values()].sort(compareSpeed);
}

/** Récords personales de un perfil en un nivel. */
export function personalBest(entries: readonly RecordEntry[], levelId: string, mode: GameMode, profileId: string): { time: RecordEntry | null; score: RecordEntry | null } {
  const mine = board(entries, levelId, mode).filter((e) => e.profileId === profileId);
  const times = mine.filter(isOfficialTime).sort(compareSpeed);
  const scores = [...mine].sort(compareScore);
  return { time: times[0] ?? null, score: scores[0] ?? null };
}

/** Mejor tiempo oficial de un personaje en un nivel (cualquier perfil). */
export function characterBest(entries: readonly RecordEntry[], levelId: string, mode: GameMode, characterId: string): RecordEntry | null {
  return board(entries, levelId, mode).filter((e) => e.characterId === characterId && isOfficialTime(e)).sort(compareSpeed)[0] ?? null;
}

/**
 * Agrega una partida si es válida y no está repetida. `minTimeMs` es el
 * tiempo mínimo posible para ese nivel (nadie lo puede recorrer más rápido).
 */
export function addEntry(entries: RecordEntry[], entry: RecordEntry, minTimeMs: number): SubmitResult {
  if (entries.some((e) => e.id === entry.id)) return { added: false, reason: 'duplicate' };
  const timeOk = entry.timeMs === null || (Number.isFinite(entry.timeMs) && entry.timeMs >= minTimeMs);
  if (!timeOk || !Number.isFinite(entry.score) || entry.score < 0) return { added: false, reason: 'invalid' };
  entries.push(entry);
  pruneBoard(entries, entry.levelId, entry.mode, RECORD_RULES.keepPerBoard);
  return { added: true };
}

/**
 * Mantiene acotada cada clasificación: conserva los mejores tiempos, los
 * mejores puntajes, el mejor de cada personaje y los récords personales.
 */
export function pruneBoard(entries: RecordEntry[], levelId: string, mode: GameMode, keep: number): void {
  const b = board(entries, levelId, mode);
  if (b.length <= keep) return;
  const keepIds = new Set<string>();
  speedRanking(b, levelId, mode, keep / 2).forEach((e) => keepIds.add(e.id));
  scoreRanking(b, levelId, mode, keep / 2).forEach((e) => keepIds.add(e.id));
  bestByCharacter(b, levelId, mode).forEach((e) => keepIds.add(e.id));
  for (const profileId of new Set(b.map((e) => e.profileId))) {
    const pb = personalBest(b, levelId, mode, profileId);
    if (pb.time) keepIds.add(pb.time.id);
    if (pb.score) keepIds.add(pb.score.id);
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.levelId === levelId && e.mode === mode && !keepIds.has(e.id)) entries.splice(i, 1);
  }
}

/** Valida datos guardados (pueden venir rotos). */
export function sanitizeEntries(raw: unknown): RecordEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RecordEntry[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const e = r as Record<string, unknown>;
    if (typeof e.id !== 'string' || seen.has(e.id) || typeof e.levelId !== 'string') continue;
    if (e.mode !== 'normal' && e.mode !== 'timeTrial') continue;
    const mode: GameMode = e.mode;
    const timeMs = typeof e.timeMs === 'number' && Number.isFinite(e.timeMs) && e.timeMs > 0 ? e.timeMs : null;
    const score = typeof e.score === 'number' && Number.isFinite(e.score) ? Math.max(0, Math.floor(e.score)) : 0;
    seen.add(e.id);
    out.push({
      id: e.id,
      levelId: e.levelId,
      mode,
      profileId: typeof e.profileId === 'string' ? e.profileId : 'desconocido',
      nickname: typeof e.nickname === 'string' ? e.nickname.slice(0, 12) : 'JUGADOR',
      characterId: typeof e.characterId === 'string' ? e.characterId : 'desconocido',
      timeMs,
      score,
      date: typeof e.date === 'string' ? e.date : new Date(0).toISOString(),
      shoesLeft: typeof e.shoesLeft === 'number' ? Math.max(0, Math.min(3, Math.floor(e.shoesLeft))) : 0,
      assisted: e.assisted === true,
      continues: typeof e.continues === 'number' ? Math.max(0, Math.floor(e.continues)) : 0,
      legacy: e.legacy === true ? true : undefined,
      splits: Array.isArray(e.splits) ? e.splits.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0).slice(0, 8) : undefined,
    });
  }
  return out;
}

/** Mejor tiempo (oficial) y mejor puntaje de un perfil con un personaje en un nivel. */
export function profileCharacterBest(
  entries: readonly RecordEntry[],
  levelId: string,
  mode: GameMode,
  profileId: string,
  characterId: string,
): { time: RecordEntry | null; score: RecordEntry | null } {
  const mine = board(entries, levelId, mode).filter((e) => e.profileId === profileId && e.characterId === characterId);
  return { time: mine.filter(isOfficialTime).sort(compareSpeed)[0] ?? null, score: [...mine].sort(compareScore)[0] ?? null };
}
