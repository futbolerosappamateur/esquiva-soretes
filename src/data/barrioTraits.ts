/**
 * Rasgos de un barrio: lo que hace que sus cuadras se jueguen distinto (cómo
 * se ven está en world/themes.ts). Todo es configuración: el generador de
 * niveles los lee y cada barrio de data/campaign.ts declara sólo los que
 * cambia respecto de DEFAULT_TRAITS.
 *
 * Con los valores por defecto el generador arma exactamente los mismos
 * niveles que antes de que existieran los rasgos (los récords siguen valiendo).
 */
export interface BarrioTraits {
  /** Árboles junto al cordón: 0 = ninguno (Lugano), 1 = los normales. */
  trees: number;
  /** Estado de la vereda: 0 = impecable, 1 = toda rota (más baldosas flojas, grietas y parches). */
  brokenSidewalk: number;
  /** Gente caminando por la vereda, donde camina el pibe: 0 = nadie, 1 = hora pico en el centro. */
  crowd: number;
  /** Palomas: 1 = las normales, 2 = el doble (Plaza de Mayo). */
  pigeons: number;
  /** Peatones del fondo (decorativos): cuántos de cada tipo hay por cuadra, en promedio. */
  background: { walker: number; lady: number; tourist: number };
}

export const DEFAULT_TRAITS: BarrioTraits = {
  trees: 1,
  brokenSidewalk: 0.25,
  crowd: 0,
  pigeons: 1,
  background: { walker: 1, lady: 1, tourist: 1 },
};

/** Rasgos completos a partir de los que declara un barrio. */
export function traitsWith(partial?: Partial<BarrioTraits>): BarrioTraits {
  return {
    ...DEFAULT_TRAITS,
    ...partial,
    background: { ...DEFAULT_TRAITS.background, ...partial?.background },
  };
}

/** Si los peatones del fondo son los de siempre (uno de cada tipo por cuadra). */
export function isDefaultBackground(t: BarrioTraits): boolean {
  const d = DEFAULT_TRAITS.background;
  return t.background.walker === d.walker && t.background.lady === d.lady && t.background.tourist === d.tourist;
}
