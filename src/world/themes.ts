import { CORNER_SPECS, FACADE_SPECS } from '../graphics/textures/facadeTextures';

/**
 * Un barrio define la estética de sus cuadras. Para sumar un barrio nuevo
 * (Palermo, La Boca, Almagro...) se agrega una entrada con sus fachadas,
 * árboles y autos, sin tocar el motor del juego.
 */
export interface NeighborhoodTheme {
  id: string;
  name: string;
  facadeIds: string[];
  facadeWidths: Record<string, number>;
  cornerStartId: string;
  cornerEndId: string;
  /** Texturas de árboles disponibles con su peso de aparición. */
  trees: { variant: number; weight: number }[];
  /** Cantidad de estilos de autos estacionados. */
  carVariants: number;
  skyColor: number;
}

const widths: Record<string, number> = {};
for (const spec of [...FACADE_SPECS, ...CORNER_SPECS]) widths[spec.id] = spec.width;

export const THEMES: Record<string, NeighborhoodTheme> = {
  'san-telmo': {
    id: 'san-telmo',
    name: 'SAN TELMO',
    facadeIds: FACADE_SPECS.map((s) => s.id),
    facadeWidths: widths,
    cornerStartId: 'esquina-inicio',
    cornerEndId: 'esquina-final',
    trees: [
      { variant: 0, weight: 3 },
      { variant: 1, weight: 3 },
      { variant: 2, weight: 2 },
    ],
    carVariants: 8,
    skyColor: 0x8fd0f2,
  },
};
