import { POOP_FRAMES, TEX } from '../../graphics/keys';
import type { Footprint } from '../../systems/Collision';

/**
 * Registro de tipos de obstáculo. Para agregar uno nuevo:
 *  1. Sumar su id a ObstacleTypeId y su definición en OBSTACLE_TYPES.
 *  2. Dibujar (o cargar) su textura con la clave indicada.
 *  3. Usarlo desde un patrón de generación (world/patterns.ts).
 * El comportamiento al pisarlo se define con `effect`.
 */
export type ObstacleTypeId = 'poop' | 'giant' | 'camo' | 'looseTile';

export interface ObstacleVariant {
  texture: string;
  frame: string;
  /** Frame que se muestra después de pisarlo. */
  usedFrame?: string;
  /** Huella real en el suelo (proporcional al área de apoyo del dibujo). */
  footprint: Footprint;
  /** Origen vertical del sprite: fila donde está el centro de la huella. */
  originY: number;
  usedOriginY?: number;
}

export interface ObstacleTypeDef {
  id: ObstacleTypeId;
  label: string;
  /** "life": ensucia una zapatilla · "penalty": resta puntos. */
  effect: 'life' | 'penalty';
  /** Cuenta como sorete esquivado al superarlo. */
  dodgeable: boolean;
  /** Altura de salto (z) por encima de la cual se lo pasa sin tocarlo. */
  clearHeight: number;
  /** "pile": tiene volumen y se ordena por profundidad · "decal": está pegado al piso. */
  layer: 'pile' | 'decal';
  variants: ObstacleVariant[];
}

export const OBSTACLE_TYPES: Record<ObstacleTypeId, ObstacleTypeDef> = {
  poop: {
    id: 'poop',
    label: 'SORETE',
    effect: 'life',
    dodgeable: true,
    clearHeight: 3,
    layer: 'pile',
    variants: [
      { texture: TEX.poops, frame: POOP_FRAMES.pile, usedFrame: POOP_FRAMES.squash, footprint: { shape: 'ellipse', w: 11, h: 5 }, originY: 11 / 14, usedOriginY: 5 / 8 },
      { texture: TEX.poops, frame: POOP_FRAMES.log, usedFrame: POOP_FRAMES.squash, footprint: { shape: 'ellipse', w: 13, h: 4 }, originY: 6 / 9, usedOriginY: 5 / 8 },
      { texture: TEX.poops, frame: POOP_FRAMES.nuggets, usedFrame: POOP_FRAMES.squash, footprint: { shape: 'ellipse', w: 11, h: 4 }, originY: 6.5 / 9, usedOriginY: 5 / 8 },
    ],
  },
  giant: {
    id: 'giant',
    label: 'SORETE GIGANTE',
    effect: 'life',
    dodgeable: true,
    clearHeight: 11,
    layer: 'pile',
    variants: [
      { texture: TEX.poops, frame: POOP_FRAMES.giant, usedFrame: POOP_FRAMES.giantSquash, footprint: { shape: 'ellipse', w: 26, h: 9 }, originY: 21 / 26, usedOriginY: 8 / 13 },
    ],
  },
  camo: {
    id: 'camo',
    label: 'CAMUFLADO',
    effect: 'life',
    dodgeable: true,
    clearHeight: 3,
    layer: 'pile',
    variants: [
      { texture: TEX.poops, frame: POOP_FRAMES.camo, usedFrame: POOP_FRAMES.squash, footprint: { shape: 'ellipse', w: 9, h: 4 }, originY: 6.5 / 9, usedOriginY: 5 / 8 },
    ],
  },
  looseTile: {
    id: 'looseTile',
    label: 'BALDOSA FLOJA',
    effect: 'penalty',
    dodgeable: false,
    clearHeight: 1,
    layer: 'decal',
    variants: [{ texture: TEX.looseTile, frame: 'idle', usedFrame: 'triggered', footprint: { shape: 'rect', w: 12, h: 5 }, originY: 4 / 10, usedOriginY: 5 / 12 }],
  },
};

export function variantOf(type: ObstacleTypeId, variant: number): ObstacleVariant {
  const def = OBSTACLE_TYPES[type];
  return def.variants[Math.abs(variant) % def.variants.length];
}
