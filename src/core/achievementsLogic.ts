import type { AchievementCounts, AchievementId } from '../data/achievements';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import type { SaveData } from './progress';

/**
 * Logros: los eventos de la partida se acumulan como "pendientes" y se
 * acreditan al perfil junto con las monedas (al completar cada cuadra y al
 * terminar el nivel). Así un evento se cuenta una sola vez aunque se
 * reintente desde un checkpoint.
 */
export function addPending(pending: AchievementCounts, id: AchievementId, amount = 1): void {
  pending[id] = (pending[id] ?? 0) + Math.max(0, amount);
}

/** Suma los pendientes al perfil y los vacía. */
export function bankAchievements(save: SaveData, pending: AchievementCounts): void {
  for (const [id, amount] of Object.entries(pending) as [AchievementId, number][]) {
    if (!amount) continue;
    save.achievements[id] = (save.achievements[id] ?? 0) + amount;
    pending[id] = 0;
  }
}

export function unlockProgress(save: SaveData, def: CharacterDef): { current: number; target: number; done: boolean } {
  if (def.unlock.kind === 'starter') return { current: 1, target: 1, done: true };
  const current = save.achievements[def.unlock.counter] ?? 0;
  return { current: Math.min(current, def.unlock.target), target: def.unlock.target, done: current >= def.unlock.target };
}

/**
 * Desbloquea los personajes cuyo desafío ya se cumplió. Devuelve los nuevos.
 * Los personajes "futuros" registran su desafío pero no se habilitan todavía.
 */
export function checkCharacterUnlocks(save: SaveData): CharacterDef[] {
  const unlocked: CharacterDef[] = [];
  for (const def of CHARACTERS) {
    if (def.unlock.kind !== 'achievement') continue;
    if (save.unlocks.characters.includes(def.id)) continue;
    if (unlockProgress(save, def).done) {
      save.unlocks.characters.push(def.id);
      unlocked.push(def);
    }
  }
  return unlocked;
}
