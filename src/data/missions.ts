/**
 * Misiones. Las recompensas en monedas se acreditan junto con el resto de
 * las monedas de la partida (al completar cada cuadra): repetir una misión
 * reintentando desde un checkpoint no da monedas extra.
 */
export interface MissionDef {
  id: string;
  title: string;
  description: string;
  /** Objetos a juntar antes de entregar. */
  itemsRequired: number;
  rewardCoins: number;
  /** Bonus de monedas sólo la primera vez que se completa en cada nivel. */
  firstTimeBonus: number;
  rewardPoints: number;
  implemented: boolean;
}

export const MISSIONS: Record<string, MissionDef> = {
  'trash-to-bin': {
    id: 'trash-to-bin',
    title: 'VEREDA LIMPIA',
    description: 'JUNTÁ 3 RESIDUOS Y TIRALOS EN EL TACHO.',
    itemsRequired: 3,
    rewardCoins: 6,
    firstTimeBonus: 15,
    rewardPoints: 300,
    implemented: true,
  },
  // --- Próximas misiones (estructura preparada) ---------------------------
  'rescue-cat': {
    id: 'rescue-cat',
    title: 'MICHI EN APUROS',
    description: 'BAJÁ AL GATO DEL ÁRBOL Y LLEVALO A SU CASA.',
    itemsRequired: 1,
    rewardCoins: 10,
    firstTimeBonus: 20,
    rewardPoints: 500,
    implemented: false,
  },
  'collect-fruit': {
    id: 'collect-fruit',
    title: 'FRUTA AL PISO',
    description: 'JUNTÁ LAS FRUTAS QUE SE LE CAYERON AL VERDULERO.',
    itemsRequired: 5,
    rewardCoins: 8,
    firstTimeBonus: 15,
    rewardPoints: 400,
    implemented: false,
  },
};

/** Clave para recordar el bonus de primera vez de una misión en un nivel. */
export function missionFirstKey(missionId: string, levelId: string): string {
  return `${missionId}@${levelId}`;
}
