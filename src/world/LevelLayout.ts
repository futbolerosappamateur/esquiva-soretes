import type { StreetBlock } from '../data/campaign';
import type { ObstacleTypeId } from '../entities/obstacles/ObstacleTypes';
import type { Footprint } from '../systems/Collision';
import { PROP_FRAMES, TEX } from '../graphics/keys';

/** Resultado del generador: todo lo que hay en un nivel, sin gráficos. */
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
  /** Tramo de vereda por el que camina (da la vuelta en las esquinas). */
  minX: number;
  maxX: number;
}

/** Una cuadra del nivel. */
export interface BlockSegment {
  index: number;
  /** Comienzo de la vereda. */
  startX: number;
  /** Esquina de llegada: al pasarla se completa la cuadra. */
  endX: number;
  street: StreetBlock;
  difficulty: [number, number];
}

/** Una esquina con cruce peatonal entre dos cuadras. */
export interface CrossingSegment {
  /** Índice de la cuadra que termina en esta esquina. */
  index: number;
  x0: number;
  x1: number;
  roadX0: number;
  roadX1: number;
  laneXs: number[];
  /** +1: los autos bajan hacia la cámara · -1: suben hacia el fondo. */
  dir: 1 | -1;
  /** Calle transversal (cartel de la esquina). */
  street: string;
  seed: number;
  density: number;
}

export interface CoinPlacement {
  x: number;
  y: number;
}

/** Elementos de la misión del nivel (la basura del portero o el perro perdido). */
export interface MissionPlacement {
  id: string;
  blockIndex: number;
  /** Personaje que da (o recibe) la misión: el portero barriendo, la dueña del perro... */
  giver: { npc: string; x: number; y: number };
  /** Residuos (frame de la hoja de basura) o el perro perdido (frame 'dog'). */
  items: { x: number; y: number; frame: string }[];
  /** Dónde se entrega: el tacho (prop sólido) o la dueña del perro. */
  target: { x: number; y: number };
}

/** Vecina que riega la vereda (el chorro siempre deja libre el carril del cordón). */
export interface WaterLadyPlacement {
  x: number;
  y: number;
  blockIndex: number;
  /** Desfase (s) del ciclo, para que no rieguen todas sincronizadas. */
  offset: number;
}

export interface LevelLayout {
  /** X de la última esquina: al llegar se completa el nivel. */
  length: number;
  worldWidth: number;
  startX: number;
  startY: number;
  blocks: BlockSegment[];
  crossings: CrossingSegment[];
  obstacles: ObstaclePlacement[];
  props: PropPlacement[];
  decals: DecalPlacement[];
  facades: FacadePlacement[];
  cars: CarPlacement[];
  pigeons: PigeonPlacement[];
  npcs: NpcPlacement[];
  coins: CoinPlacement[];
  mission: MissionPlacement | null;
  waterLadies: WaterLadyPlacement[];
  /** Calle transversal decorativa de la esquina final (sin tránsito). */
  crossStreetX: number;
  finalStreet: string | null;
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
