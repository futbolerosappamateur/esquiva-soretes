/**
 * Logros persistentes: contadores por perfil. Se acreditan junto con las
 * monedas (al completar cada cuadra y al terminar el nivel), así reintentar
 * desde un checkpoint no los suma dos veces.
 */
export type AchievementId =
  | 'trashDeposited'
  | 'safeCrossings'
  | 'animalMissions'
  | 'waterJetsDodged'
  | 'flawlessLevels'
  | 'flawlessNightLevels'
  | 'poopsDodged'
  | 'levelsCompleted';

export interface AchievementDef {
  id: AchievementId;
  label: string;
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  trashDeposited: { id: 'trashDeposited', label: 'RESIDUOS EN EL TACHO' },
  safeCrossings: { id: 'safeCrossings', label: 'CRUCES SEGUROS' },
  animalMissions: { id: 'animalMissions', label: 'MISIONES CON ANIMALES' },
  waterJetsDodged: { id: 'waterJetsDodged', label: 'CHORROS ESQUIVADOS' },
  flawlessLevels: { id: 'flawlessLevels', label: 'NIVELES SIN PERDER ZAPATILLAS' },
  flawlessNightLevels: { id: 'flawlessNightLevels', label: 'NIVELES NOCTURNOS SIN PERDER ZAPATILLAS' },
  poopsDodged: { id: 'poopsDodged', label: 'SORETES ESQUIVADOS' },
  levelsCompleted: { id: 'levelsCompleted', label: 'NIVELES COMPLETADOS' },
};

export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

export type AchievementCounts = Partial<Record<AchievementId, number>>;
