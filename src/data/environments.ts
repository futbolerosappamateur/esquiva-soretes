/**
 * Ambientaciones visuales. Cada nivel elige una por id: no quedan atadas a
 * un número de nivel. Las que tienen `ready: false` están preparadas como
 * estructura (se pueden probar con ?env=rain, por ejemplo) pero todavía no
 * tienen gráficos propios completos.
 */
export type EnvironmentId = 'day' | 'night' | 'autumn' | 'winter' | 'spring' | 'summer' | 'rain';

export type SkyKind = 'day' | 'night' | 'dusk' | 'overcast';
export type FoliageKind = 'summer' | 'autumn' | 'spring' | 'bare';

export interface EnvironmentDef {
  id: EnvironmentId;
  /** Nombre corto que se muestra en las tarjetas de nivel. */
  label: string;
  ready: boolean;
  sky: SkyKind;
  /** Tinte multiplicativo para fachadas, vereda y calle (0xffffff = sin cambios). */
  worldTint: number;
  /** Tinte para personajes, obstáculos y objetos jugables (siempre más claro: se tienen que distinguir). */
  actorTint: number;
  /** Fachadas con ventanas iluminadas (texturas nocturnas). */
  nightFacades: boolean;
  /** Proporción de ventanas encendidas cuando hay fachadas nocturnas. */
  litWindowRatio: number;
  lampsLit: boolean;
  /** Proporción de faroles que titilan (suave, sin destellos fuertes). */
  flickerRatio: number;
  /** Opacidad de las sombras de los personajes. */
  shadowAlpha: number;
  foliage: FoliageKind;
  /** Hojas sueltas extra por cada 100 px de vereda. */
  looseLeaves: number;
  /** Hojas cayendo de los árboles (partículas). */
  fallingLeaves: boolean;
  /** Multiplicadores de dificultad del generador. */
  leafPileWeight: number;
  camoChance: number;
  /** Multiplicador de la cantidad de autos en los cruces. */
  traffic: number;
  /** Lluvia (estructura preparada). */
  rain: boolean;
  cloudAlpha: number;
}

const BASE: Omit<EnvironmentDef, 'id' | 'label'> = {
  ready: true,
  sky: 'day',
  worldTint: 0xffffff,
  actorTint: 0xffffff,
  nightFacades: false,
  litWindowRatio: 0,
  lampsLit: false,
  flickerRatio: 0,
  shadowAlpha: 0.3,
  foliage: 'summer',
  looseLeaves: 0,
  fallingLeaves: false,
  leafPileWeight: 1,
  camoChance: 1,
  traffic: 1,
  rain: false,
  cloudAlpha: 1,
};

export const ENVIRONMENTS: Record<EnvironmentId, EnvironmentDef> = {
  day: { ...BASE, id: 'day', label: 'DÍA' },
  night: {
    ...BASE,
    id: 'night',
    label: 'NOCHE',
    sky: 'night',
    worldTint: 0x6d76b0,
    actorTint: 0xd8def5,
    nightFacades: true,
    litWindowRatio: 0.45,
    lampsLit: true,
    flickerRatio: 0.25,
    shadowAlpha: 0.45,
    traffic: 0.8,
    cloudAlpha: 0.35,
  },
  autumn: {
    ...BASE,
    id: 'autumn',
    label: 'OTOÑO',
    sky: 'dusk',
    worldTint: 0xfff0dc,
    foliage: 'autumn',
    looseLeaves: 2.2,
    fallingLeaves: true,
    leafPileWeight: 2.4,
    camoChance: 1.25,
  },
  // --- Preparadas para próximas versiones ---------------------------------
  winter: {
    ...BASE,
    id: 'winter',
    label: 'INVIERNO',
    ready: false,
    sky: 'overcast',
    worldTint: 0xdfe6f2,
    foliage: 'bare',
    cloudAlpha: 1,
  },
  spring: { ...BASE, id: 'spring', label: 'PRIMAVERA', ready: false, foliage: 'spring', looseLeaves: 0.8 },
  summer: { ...BASE, id: 'summer', label: 'VERANO', ready: false, worldTint: 0xfff6e6, traffic: 1.1 },
  rain: {
    ...BASE,
    id: 'rain',
    label: 'LLUVIA',
    ready: false,
    sky: 'overcast',
    worldTint: 0xa9b2c6,
    actorTint: 0xe6eaf5,
    shadowAlpha: 0.2,
    rain: true,
    cloudAlpha: 1,
  },
};

export function getEnvironment(id: string | null | undefined): EnvironmentDef {
  return (id && ENVIRONMENTS[id as EnvironmentId]) || ENVIRONMENTS.day;
}
