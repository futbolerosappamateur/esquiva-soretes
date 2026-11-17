import { BARRIOS } from '../data/campaign';
import type { RecordEntry } from './leaderboard';
import { levelProgress } from './progress';
import { recordsRepo } from './recordsRepository';
import { saveStore } from './save';

/**
 * Importa los récords de puntaje de la v0.2 (guardados por nivel en el
 * progreso) a la nueva tabla de récords, para que no se pierdan. No tenían
 * tiempo ni personaje: aparecen en el ranking de puntuación y nunca en el de
 * velocidad. Se hace una sola vez: después, los puntajes nuevos del progreso
 * ya tienen su propio registro completo y no hay que duplicarlos.
 */
export function importLegacyRecords(): void {
  if (recordsRepo.legacyImported) return;
  const entries: RecordEntry[] = [];
  for (const profile of saveStore.profiles()) {
    for (const barrio of BARRIOS) {
      for (const level of barrio.levels) {
        const lp = levelProgress(profile.data as never, level.id);
        if (lp.bestScore <= 0) continue;
        entries.push({
          id: `legacy-${profile.id}-${level.id}`,
          levelId: level.id,
          mode: 'normal',
          profileId: profile.id,
          nickname: profile.nickname,
          characterId: 'desconocido',
          timeMs: null,
          score: lp.bestScore,
          date: profile.createdAt,
          shoesLeft: 0,
          assisted: false,
          continues: 0,
          legacy: true,
        });
      }
    }
  }
  recordsRepo.importLegacy(entries);
}
