import { ABILITY_TUNING } from '../config/balance';

/**
 * Habilidades especiales (se activan con E o con el botón especial del celular).
 * Los valores de duración y recarga están centralizados en config/balance.ts.
 */
export type AbilityId = 'dash' | 'doubleJump' | 'turbo' | 'sprint' | 'broom' | 'hose' | 'sniff' | 'whistle';

export interface AbilityInfo {
  id: AbilityId;
  name: string;
  description: string;
  /** Frame del ícono (hoja de íconos). */
  icon: string;
  /** Dónde se puede usar: en cualquier lado, sólo en el aire o sólo en una esquina con semáforo. */
  usage: 'any' | 'air' | 'crossing';
}

export const ABILITIES: Record<AbilityId, AbilityInfo> = {
  dash: {
    id: 'dash',
    name: 'ESQUIVE RÁPIDO',
    description: 'UN PASO RELÁMPAGO HACIA DONDE TE MOVÉS. LOS SORETES NO TE TOCAN MIENTRAS DURA.',
    icon: 'ab-dash',
    usage: 'any',
  },
  doubleJump: {
    id: 'doubleJump',
    name: 'SALTO DOBLE',
    description: 'EN EL AIRE, VOLVÉ A SALTAR (SALTO O E) PARA UN SEGUNDO IMPULSO.',
    icon: 'ab-double-jump',
    usage: 'air',
  },
  turbo: {
    id: 'turbo',
    name: 'TURBO',
    description: 'TRES SEGUNDOS A TODA VELOCIDAD. OJO: DESPUÉS CUESTA FRENAR.',
    icon: 'ab-turbo',
    usage: 'any',
  },
  sprint: {
    id: 'sprint',
    name: 'SPRINT',
    description: 'CINCO SEGUNDOS MÁS RÁPIDO SIN PERDER EL CONTROL. NO JUNTA MONEDAS MIENTRAS CORRE.',
    icon: 'ab-sprint',
    usage: 'any',
  },
  broom: {
    id: 'broom',
    name: 'ESCOBAZO',
    description: 'BARRE ADELANTE: CORRE LAS HOJAS, DESCUBRE SORETES ESCONDIDOS Y JUNTA BASURA.',
    icon: 'ab-broom',
    usage: 'any',
  },
  hose: {
    id: 'hose',
    name: 'MANGUERAZO',
    description: 'DOS SEGUNDOS DE CHORRO: LAVA LAS HOJAS Y DESCUBRE LO QUE ESCONDEN. DEJA CHARCOS.',
    icon: 'ab-hose',
    usage: 'any',
  },
  sniff: {
    id: 'sniff',
    name: 'OLFATO CANINO',
    description: 'LOS PERROS MARCAN LOS SORETES QUE HAY MÁS ADELANTE, AUNQUE ESTÉN ESCONDIDOS.',
    icon: 'ab-sniff',
    usage: 'any',
  },
  whistle: {
    id: 'whistle',
    name: 'SILBATAZO',
    description: 'EN UNA ESQUINA, FRENA EL TRÁNSITO Y HABILITA EL PASO EN CUANTO LA SENDA QUEDA LIBRE.',
    icon: 'ab-whistle',
    usage: 'crossing',
  },
};

export function abilityCooldown(id: AbilityId): number {
  return ABILITY_TUNING[id].cooldown;
}

/** Duración del efecto (0 = instantáneo). */
export function abilityDuration(id: AbilityId): number {
  const t = ABILITY_TUNING[id] as { duration?: number; stop?: number; protection?: number };
  return t.duration ?? t.stop ?? t.protection ?? 0;
}
