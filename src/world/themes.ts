import { CORNER_SPECS, FACADE_SPECS, VERSALLES_SPECS } from '../graphics/facadeSpecs';

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
for (const spec of [...FACADE_SPECS, ...CORNER_SPECS, ...VERSALLES_SPECS]) widths[spec.id] = spec.width;

export const THEMES: Record<string, NeighborhoodTheme> = {
  // Casas bajas (de una planta y algunas de dos), muchos árboles y vecinos hinchas de Vélez.
  versalles: {
    id: 'versalles',
    name: 'VERSALLES',
    facadeIds: [...VERSALLES_SPECS.map((s) => s.id), 'casa-rosa', 'casa-ocre', 'casa-bordo'],
    facadeWidths: widths,
    cornerStartId: 'esquina-inicio',
    cornerEndId: 'esquina-final',
    trees: [
      { variant: 0, weight: 4 },
      { variant: 1, weight: 3 },
      { variant: 2, weight: 1 },
    ],
    carVariants: 8,
    skyColor: 0x8fd0f2,
  },
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
  // Provisional: reutiliza las fachadas de San Telmo con otra mezcla de árboles.
  monserrat: {
    id: 'monserrat',
    name: 'MONSERRAT',
    facadeIds: FACADE_SPECS.filter((s) => s.floors >= 1).map((s) => s.id),
    facadeWidths: widths,
    cornerStartId: 'esquina-inicio',
    cornerEndId: 'esquina-final',
    trees: [
      { variant: 0, weight: 4 },
      { variant: 1, weight: 4 },
      { variant: 2, weight: 1 },
    ],
    carVariants: 8,
    skyColor: 0x8fd0f2,
  },
};
