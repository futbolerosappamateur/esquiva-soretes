import {
  addEntry,
  bestByCharacter,
  characterBest,
  personalBest,
  profileCharacterBest,
  sanitizeEntries,
  scoreRanking,
  speedRanking,
  type GameMode,
  type RecordEntry,
  type SubmitResult,
} from './leaderboard';
import { loadRaw, saveJSON } from './storage';

/**
 * Capa de persistencia de los récords. Hoy hay una sola implementación
 * (LocalStorage). Para compartir récords entre dispositivos se puede sumar
 * otra (por ejemplo, Supabase) que respete esta misma interfaz; en ese caso
 * el servidor debe validar cada resultado (tiempos posibles, partida
 * completa, sin checkpoints) en lugar de confiar en lo que manda el navegador.
 */
export interface RecordsRepository {
  submit(entry: RecordEntry, minTimeMs: number): SubmitResult;
  speedRanking(levelId: string, mode: GameMode, limit?: number): RecordEntry[];
  scoreRanking(levelId: string, mode: GameMode, limit?: number): RecordEntry[];
  bestByCharacter(levelId: string, mode: GameMode): RecordEntry[];
  personalBest(levelId: string, mode: GameMode, profileId: string): { time: RecordEntry | null; score: RecordEntry | null };
  characterBest(levelId: string, mode: GameMode, characterId: string): RecordEntry | null;
  profileCharacterBest(levelId: string, mode: GameMode, profileId: string, characterId: string): { time: RecordEntry | null; score: RecordEntry | null };
  /** true cuando ya se importaron los récords de la v0.2 (se hace una sola vez). */
  readonly legacyImported: boolean;
  /** Importa récords viejos (sólo si todavía no existen) y marca la importación como hecha. */
  importLegacy(entries: RecordEntry[]): void;
  /** Borra los récords de un perfil (al eliminarlo). */
  removeProfile(profileId: string): void;
}

const KEY = 'leaderboard';

class LocalRecordsRepository implements RecordsRepository {
  private entries: RecordEntry[];
  private legacyDone: boolean;

  constructor() {
    const raw = loadRaw(KEY) as { entries?: unknown; legacyImported?: unknown } | null;
    this.entries = sanitizeEntries(raw?.entries);
    this.legacyDone = raw?.legacyImported === true;
  }

  get legacyImported(): boolean {
    return this.legacyDone;
  }

  private persist(): void {
    saveJSON(KEY, { version: 1, legacyImported: this.legacyDone, entries: this.entries });
  }

  submit(entry: RecordEntry, minTimeMs: number): SubmitResult {
    const res = addEntry(this.entries, entry, minTimeMs);
    if (res.added) this.persist();
    return res;
  }

  speedRanking(levelId: string, mode: GameMode, limit?: number): RecordEntry[] {
    return speedRanking(this.entries, levelId, mode, limit);
  }

  scoreRanking(levelId: string, mode: GameMode, limit?: number): RecordEntry[] {
    return scoreRanking(this.entries, levelId, mode, limit);
  }

  bestByCharacter(levelId: string, mode: GameMode): RecordEntry[] {
    return bestByCharacter(this.entries, levelId, mode);
  }

  personalBest(levelId: string, mode: GameMode, profileId: string) {
    return personalBest(this.entries, levelId, mode, profileId);
  }

  characterBest(levelId: string, mode: GameMode, characterId: string): RecordEntry | null {
    return characterBest(this.entries, levelId, mode, characterId);
  }

  profileCharacterBest(levelId: string, mode: GameMode, profileId: string, characterId: string) {
    return profileCharacterBest(this.entries, levelId, mode, profileId, characterId);
  }

  importLegacy(entries: RecordEntry[]): void {
    for (const e of entries) {
      if (this.entries.some((x) => x.id === e.id)) continue;
      this.entries.push(e);
    }
    this.legacyDone = true;
    this.persist();
  }

  removeProfile(profileId: string): void {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.profileId !== profileId);
    if (this.entries.length !== before) this.persist();
  }
}

export const recordsRepo: RecordsRepository = new LocalRecordsRepository();
