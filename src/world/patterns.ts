import { LAYOUT } from '../config/constants';
import type { RNG } from '../core/rng';
import { lerp } from '../core/math';
import { TEX } from '../graphics/keys';
import type { DecalPlacement, ObstaclePlacement } from './LevelLayout';

/**
 * Patrones de obstáculos. Cada patrón arma un "tramo" de vereda; el generador
 * los encadena según la dificultad y después verifica que siempre quede un
 * camino posible. Para crear un patrón nuevo alcanza con sumarlo a PATTERNS.
 */
export interface PatternContext {
  x0: number;
  width: number;
  /** Dificultad local entre 0 y 1. */
  d: number;
  rng: RNG;
  /** Rango vertical permitido para el centro de los obstáculos. */
  yMin: number;
  yMax: number;
  /** Margen interno respecto de los bordes del tramo. */
  inner: number;
  /** Versión "de presentación": el obstáculo protagonista aparece solo y seguro. */
  intro?: boolean;
  /** Multiplica la probabilidad de que un montón de hojas esconda un sorete (otoño). */
  camoChance?: number;
}

export interface PatternResult {
  obstacles: ObstaclePlacement[];
  decals: DecalPlacement[];
}

export interface Pattern {
  id: string;
  minD: number;
  weight: (d: number) => number;
  width: (d: number, rng: RNG) => number;
  build: (ctx: PatternContext) => PatternResult;
}

const poop = (x: number, y: number, rng: RNG): ObstaclePlacement => ({ type: 'poop', x: Math.round(x), y: Math.round(y), variant: rng.int(0, 2) });

const xAt = (c: PatternContext, t: number) => c.x0 + c.inner + t * (c.width - c.inner * 2);
const yAt = (c: PatternContext, t: number) => c.yMin + t * (c.yMax - c.yMin);

/** Centro de baldosa más cercano (las baldosas flojas respetan la grilla de la vereda). */
function snapTile(x: number, y: number): { x: number; y: number } {
  const tx = Math.floor(x / LAYOUT.tileW) * LAYOUT.tileW + LAYOUT.tileW / 2;
  const row = Math.round((y - LAYOUT.sidewalkTop - LAYOUT.tileH / 2) / LAYOUT.tileH);
  return { x: tx, y: LAYOUT.sidewalkTop + row * LAYOUT.tileH + LAYOUT.tileH / 2 };
}

function wall(c: PatternContext, x: number, gapCenter: number, gapH: number): ObstaclePlacement[] {
  const out: ObstaclePlacement[] = [];
  for (let y = c.yMin; y <= c.yMax + 0.1; y += 9) {
    if (Math.abs(y - gapCenter) < gapH / 2) continue;
    out.push(poop(x + c.rng.int(-2, 2), y, c.rng));
  }
  return out;
}

const empty = (): PatternResult => ({ obstacles: [], decals: [] });

export const PATTERNS: Pattern[] = [
  {
    id: 'rest',
    minD: 0,
    weight: (d) => 1.6 * (1 - d) + 0.3,
    width: (_d, rng) => rng.int(70, 120),
    build: empty,
  },
  {
    id: 'scatter',
    minD: 0,
    weight: () => 3,
    width: (_d, rng) => rng.int(150, 210),
    build: (c) => {
      const n = Math.round(lerp(2, 5, c.d) + c.rng.range(0, 1.4));
      const obstacles: ObstaclePlacement[] = [];
      for (let i = 0; i < n; i++) obstacles.push(poop(xAt(c, c.rng.next()), yAt(c, c.rng.next()), c.rng));
      return { obstacles, decals: [] };
    },
  },
  {
    id: 'tiles',
    minD: 0.05,
    weight: () => 1,
    width: (_d, rng) => rng.int(120, 170),
    build: (c) => {
      const obstacles: ObstaclePlacement[] = [];
      const n = c.intro ? 2 : c.rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const t = snapTile(xAt(c, c.intro ? 0.25 + i * 0.5 : c.rng.next()), yAt(c, c.rng.range(0.2, 0.8)));
        obstacles.push({ type: 'looseTile', x: t.x, y: t.y, variant: 0 });
      }
      if (c.d > 0.3 && !c.intro) obstacles.push(poop(xAt(c, c.rng.next()), yAt(c, c.rng.next()), c.rng));
      return { obstacles, decals: [] };
    },
  },
  {
    id: 'wall',
    minD: 0.1,
    weight: () => 1.5,
    width: (_d, rng) => rng.int(100, 140),
    build: (c) => {
      const gapH = lerp(34, 22, c.d);
      const gap = c.rng.range(c.yMin + gapH / 2, c.yMax - gapH / 2);
      return { obstacles: wall(c, c.x0 + c.width / 2, gap, gapH), decals: [] };
    },
  },
  {
    id: 'diagonal',
    minD: 0.15,
    weight: () => 1.2,
    width: (_d, rng) => rng.int(150, 200),
    build: (c) => {
      const k = Math.round(lerp(4, 6, c.d));
      const down = c.rng.chance(0.5);
      const obstacles: ObstaclePlacement[] = [];
      for (let i = 0; i < k; i++) {
        const t = i / (k - 1);
        obstacles.push(poop(xAt(c, t), yAt(c, down ? 0.05 + t * 0.8 : 0.95 - t * 0.8), c.rng));
      }
      return { obstacles, decals: [] };
    },
  },
  {
    id: 'leaves',
    minD: 0.2,
    weight: () => 1.3,
    width: (_d, rng) => rng.int(150, 200),
    build: (c) => {
      const obstacles: ObstaclePlacement[] = [];
      const decals: DecalPlacement[] = [];
      // En la presentación: un montón señuelo (sin nada) y otro con sorete escondido.
      const piles = c.intro ? 2 : c.rng.int(1, 2);
      for (let i = 0; i < piles; i++) {
        const x = Math.round(xAt(c, piles === 1 ? 0.5 : i === 0 ? 0.2 : 0.8));
        const y = Math.round(yAt(c, c.rng.range(0.15, 0.85)));
        decals.push({ texture: TEX.leafPile, frame: c.rng.chance(0.5) ? 'pile0' : 'pile1', x, y });
        const hasPoop = c.intro ? i === 1 : c.rng.chance(Math.min(0.95, lerp(0.5, 0.85, c.d) * (c.camoChance ?? 1)));
        if (hasPoop) {
          obstacles.push({ type: 'camo', x: x + c.rng.int(-8, 8), y: y + c.rng.int(-2, 2), variant: 0 });
        }
      }
      if (c.d > 0.45 && !c.intro && c.rng.chance(0.6)) obstacles.push(poop(xAt(c, c.rng.next()), yAt(c, c.rng.next()), c.rng));
      return { obstacles, decals };
    },
  },
  {
    id: 'giant',
    minD: 0.3,
    weight: (d) => 1 + d,
    width: (_d, rng) => rng.int(140, 190),
    build: (c) => {
      const obstacles: ObstaclePlacement[] = [{ type: 'giant', x: Math.round(xAt(c, 0.5)), y: Math.round(yAt(c, c.rng.range(0.15, 0.85))), variant: 0 }];
      const extras = c.d > 0.5 && !c.intro ? c.rng.int(1, 2) : 0;
      for (let i = 0; i < extras; i++) obstacles.push(poop(xAt(c, c.rng.chance(0.5) ? 0.05 : 0.95), yAt(c, c.rng.next()), c.rng));
      return { obstacles, decals: [] };
    },
  },
  {
    id: 'zigzag',
    minD: 0.25,
    weight: (d) => 2.4 * d,
    width: (_d, rng) => rng.int(190, 240),
    build: (c) => {
      const gapH = lerp(32, 22, c.d);
      const topFirst = c.rng.chance(0.5);
      const span = c.yMax - c.yMin;
      const g1 = topFirst ? c.yMin + span * 0.22 : c.yMax - span * 0.22;
      const g2 = topFirst ? c.yMax - span * 0.22 : c.yMin + span * 0.22;
      return {
        obstacles: [...wall(c, c.x0 + c.inner + 14, g1, gapH), ...wall(c, c.x0 + c.width - c.inner - 14, g2, gapH)],
        decals: [],
      };
    },
  },
  {
    id: 'tileRow',
    minD: 0.2,
    weight: () => 0.9,
    width: (_d, rng) => rng.int(140, 180),
    build: (c) => {
      const obstacles: ObstaclePlacement[] = [];
      const row = snapTile(xAt(c, 0.1), yAt(c, c.rng.range(0.1, 0.9)));
      const count = c.rng.int(3, 4);
      for (let i = 0; i < count; i++) obstacles.push({ type: 'looseTile', x: row.x + i * LAYOUT.tileW, y: row.y, variant: 0 });
      obstacles.push(poop(xAt(c, 0.85), yAt(c, c.rng.next()), c.rng));
      return { obstacles, decals: [] };
    },
  },
  {
    id: 'slalom',
    minD: 0.35,
    weight: () => 1.4,
    width: (_d, rng) => rng.int(200, 250),
    build: (c) => {
      const obstacles: ObstaclePlacement[] = [];
      const walls = c.rng.int(3, 4);
      let top = c.rng.chance(0.5);
      for (let i = 0; i < walls; i++) {
        const x = xAt(c, walls === 1 ? 0.5 : i / (walls - 1));
        const count = c.d > 0.7 ? 4 : 3;
        for (let k = 0; k < count; k++) {
          const y = top ? c.yMin + k * 9 : c.yMax - k * 9;
          obstacles.push(poop(x + c.rng.int(-2, 2), y, c.rng));
        }
        top = !top;
      }
      return { obstacles, decals: [] };
    },
  },
  {
    id: 'corridor',
    minD: 0.45,
    weight: () => 1,
    width: (_d, rng) => rng.int(200, 250),
    build: (c) => {
      const obstacles: ObstaclePlacement[] = [];
      const y1 = yAt(c, c.rng.range(0.22, 0.35));
      const y2 = yAt(c, c.rng.range(0.65, 0.78));
      for (let x = xAt(c, 0); x <= xAt(c, 1); x += c.rng.int(16, 20)) {
        obstacles.push(poop(x, y1, c.rng));
        obstacles.push(poop(x + 8, y2, c.rng));
      }
      return { obstacles, decals: [] };
    },
  },
  {
    id: 'minefield',
    minD: 0.6,
    weight: (d) => 1.6 * d,
    width: (_d, rng) => rng.int(180, 230),
    build: (c) => {
      const n = Math.round(lerp(6, 10, c.d));
      const obstacles: ObstaclePlacement[] = [];
      for (let i = 0; i < n; i++) obstacles.push(poop(xAt(c, c.rng.next()), yAt(c, c.rng.next()), c.rng));
      if (c.rng.chance(0.35)) obstacles.push({ type: 'giant', x: Math.round(xAt(c, c.rng.next())), y: Math.round(yAt(c, c.rng.range(0.2, 0.8))), variant: 0 });
      return { obstacles, decals: [] };
    },
  },
];

/**
 * Elige un patrón según la dificultad. `weights` permite que una ambientación
 * favorezca algunos patrones (por ejemplo, más montones de hojas en otoño).
 */
export function choosePattern(d: number, rng: RNG, previous: string | null, weights?: Record<string, number>): Pattern {
  const options = PATTERNS.filter((p) => d >= p.minD && (p.id !== previous || p.id === 'scatter')).map((p) => ({
    item: p,
    weight: p.weight(d) * (weights?.[p.id] ?? 1),
  }));
  return rng.weighted(options);
}
