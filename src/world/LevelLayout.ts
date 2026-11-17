import type { ObstacleTypeId } from '../entities/obstacles/ObstacleTypes';
import type { Footprint } from '../systems/Collision';
import { PROP_FRAMES, TEX } from '../graphics/keys';

/** Resultado del generador: todo lo que hay en una cuadra, sin gráficos. */
export interface ObstaclePlacement {
  type: ObstacleTypeId;
  x: number;
  y: number;
  variant: number;
}

export type PropKind = 'tree' | 'lamp' | 'bin' | 'binBags' | 'busStop';

export interface PropPlacement {
  kind: PropKind;
  x: number;
  y: number;
  variant: number;
}

export interface DecalPlacement {
  texture: string;
  frame?: string;
  x: number;
  y: number;
  flip?: boolean;
  tint?: number;
  /** Por defecto se dibuja en la capa de calcomanías del piso. */
  depth?: number;
}

export interface FacadePlacement {
  id: string;
  x: number;
  width: number;
}

export interface CarPlacement {
  variant: number;
  x: number;
  flip: boolean;
  container?: boolean;
}

export interface PigeonPlacement {
  x: number;
  y: number;
}

export type NpcKind = 'walker' | 'lady' | 'tourist';

export interface NpcPlacement {
  kind: NpcKind;
  x: number;
  dir: 1 | -1;
  dogs: number[];
}

export interface LevelLayout {
  /** X donde termina la cuadra (al cruzarla se gana). */
  length: number;
  worldWidth: number;
  startX: number;
  startY: number;
  obstacles: ObstaclePlacement[];
  props: PropPlacement[];
  decals: DecalPlacement[];
  facades: FacadePlacement[];
  cars: CarPlacement[];
  pigeons: PigeonPlacement[];
  npcs: NpcPlacement[];
  /** Comienzo de la calle transversal (esquina de llegada). */
  crossStreetX: number;
  /** Elementos decorativos junto a las fachadas (mesitas de bar, etc.). */
  backDecor: DecalPlacement[];
}

/** Rectángulo (relativo a la base del prop) que tapa visualmente la vereda. */
export interface OcclusionRect {
  dx: number;
  w: number;
  top: number;
  bottom: number;
}

export interface PropDef {
  texture: (variant: number) => string;
  frame?: string;
  /** Huella sólida: el personaje no la puede atravesar. */
  solid: Footprint;
  /** Zonas del dibujo que tapan la vereda que queda detrás. */
  occlusion: OcclusionRect[];
  originY: number;
}

export const PROP_DEFS: Record<PropKind, PropDef> = {
  tree: {
    texture: (v) => TEX.tree(v),
    solid: { shape: 'rect', w: 9, h: 4 },
    occlusion: [{ dx: -5, w: 10, top: -96, bottom: 0 }],
    originY: 1,
  },
  lamp: {
    texture: () => TEX.lamp,
    solid: { shape: 'rect', w: 7, h: 3 },
    occlusion: [
      { dx: -3, w: 6, top: -70, bottom: 0 },
      { dx: -7, w: 14, top: -84, bottom: -58 },
    ],
    originY: 1,
  },
  bin: {
    texture: () => TEX.props,
    frame: PROP_FRAMES.bin,
    solid: { shape: 'rect', w: 9, h: 4 },
    occlusion: [{ dx: -7, w: 14, top: -26, bottom: 0 }],
    originY: 1,
  },
  binBags: {
    texture: () => TEX.props,
    frame: PROP_FRAMES.bags,
    solid: { shape: 'rect', w: 22, h: 6 },
    occlusion: [{ dx: -14, w: 28, top: -26, bottom: 0 }],
    originY: 1,
  },
  busStop: {
    texture: () => TEX.props,
    frame: PROP_FRAMES.busStop,
    solid: { shape: 'rect', w: 5, h: 3 },
    occlusion: [
      { dx: -3, w: 6, top: -48, bottom: 0 },
      { dx: -10, w: 20, top: -62, bottom: -42 },
    ],
    originY: 1,
  },
};
