import { DEPTH, LAYOUT } from '../config/constants';
import { LEVEL_GEN } from '../config/balance';
import { clamp, lerp } from '../core/math';
import { RNG } from '../core/rng';
import { variantOf } from '../entities/obstacles/ObstacleTypes';
import { FX_FRAMES, PROP_FRAMES, TEX } from '../graphics/keys';
import { DECAL_FRAMES } from '../graphics/textures/environmentTextures';
import { CAR_STYLES } from '../graphics/textures/propTextures';
import { DOG_KINDS } from '../graphics/textures/npcTextures';
import { expand, footprintsOverlap } from '../systems/Collision';
import type { BlockDefinition } from './blocks';
import {
  PROP_DEFS,
  type LevelLayout,
  type NpcKind,
  type ObstaclePlacement,
  type PropKind,
  type PropPlacement,
} from './LevelLayout';
import { PathGrid } from './PathGrid';
import { choosePattern, PATTERNS } from './patterns';
import type { NeighborhoodTheme } from './themes';

export const CROSS_STREET_WIDTH = 112;
const CORNER_WIDTH = 128;
const OBSTACLE_Y_MIN = LAYOUT.walkMinY + 3;
const OBSTACLE_Y_MAX = LAYOUT.walkMaxY - 3;

/**
 * Arma una cuadra completa a partir de su definición y una semilla.
 * La misma semilla produce siempre la misma cuadra.
 */
export function generateLevel(block: BlockDefinition, theme: NeighborhoodTheme, seed: number): LevelLayout {
  const rng = new RNG(seed);
  const L = block.length;
  const crossStreetX = L + 26;
  const layout: LevelLayout = {
    length: L,
    worldWidth: crossStreetX + CROSS_STREET_WIDTH + CORNER_WIDTH + 170,
    startX: 70,
    startY: 182,
    obstacles: [],
    props: [],
    decals: [],
    facades: [],
    cars: [],
    pigeons: [],
    npcs: [],
    crossStreetX,
    backDecor: [],
  };

  placeFacades(layout, theme, rng);
  placeProps(layout, theme, rng);
  placeObstacles(layout, block, rng);
  placeDecor(layout, rng);
  placeCars(layout, theme, rng);
  placePigeons(layout, rng);
  placeNpcs(layout, rng);
  return layout;
}

// ---------------------------------------------------------------------------
// Fachadas
// ---------------------------------------------------------------------------

function placeFacades(layout: LevelLayout, theme: NeighborhoodTheme, rng: RNG): void {
  const w = (id: string) => theme.facadeWidths[id] ?? 112;
  let x = -40;
  layout.facades.push({ id: theme.cornerStartId, x, width: w(theme.cornerStartId) });
  x += w(theme.cornerStartId);
  const recent: string[] = [];
  const cornerEndX = layout.crossStreetX - w(theme.cornerEndId);
  while (x < cornerEndX) {
    const options = theme.facadeIds.filter((id) => !recent.includes(id));
    const id = rng.pick(options.length > 0 ? options : theme.facadeIds);
    layout.facades.push({ id, x, width: w(id) });
    x += w(id);
    recent.push(id);
    if (recent.length > 4) recent.shift();
  }
  // La esquina de llegada se dibuja última (encima) para tapar cualquier solapamiento.
  layout.facades.push({ id: theme.cornerEndId, x: cornerEndX, width: w(theme.cornerEndId) });
  // Del otro lado de la transversal empieza la próxima cuadra.
  let nx = layout.crossStreetX + CROSS_STREET_WIDTH;
  layout.facades.push({ id: theme.cornerStartId, x: nx, width: w(theme.cornerStartId) });
  nx += w(theme.cornerStartId);
  while (nx < layout.worldWidth) {
    const id = rng.pick(theme.facadeIds);
    layout.facades.push({ id, x: nx, width: w(id) });
    nx += w(id);
  }
}

// ---------------------------------------------------------------------------
// Árboles, faroles, cestos y parada de colectivo (junto al cordón)
// ---------------------------------------------------------------------------

function placeProps(layout: LevelLayout, theme: NeighborhoodTheme, rng: RNG): void {
  const L = layout.length;
  const sequence: PropKind[] = ['tree', 'lamp', 'tree', 'bin', 'tree', 'lamp', 'tree', 'binBags'];
  let i = rng.int(0, sequence.length - 1);
  let x = 110 + rng.int(0, 50);
  let busStopPlaced = false;
  while (x < L - 70) {
    let kind = sequence[i % sequence.length];
    if (!busStopPlaced && kind === 'lamp' && x > L * 0.4) {
      kind = 'busStop';
      busStopPlaced = true;
    }
    const y = LAYOUT.propFrontY - (kind === 'tree' ? rng.int(0, 1) : 0);
    const variant = kind === 'tree' ? rng.weighted(theme.trees.map((t) => ({ item: t.variant, weight: t.weight }))) : 0;
    layout.props.push({ kind, x, y, variant });
    if (kind === 'tree') {
      layout.decals.push({ texture: TEX.props, frame: PROP_FRAMES.treePit, x, y: y - 2, depth: DEPTH.groundDecal - 2 });
      if (rng.chance(0.55)) {
        layout.decals.push({ texture: TEX.props, frame: PROP_FRAMES.rootTiles, x: x + (rng.chance(0.5) ? -20 : 20), y: y - 9, depth: DEPTH.groundDecal - 2 });
      }
      // Hojas o flores caídas alrededor del árbol.
      const petals = variant === 2;
      for (let k = 0; k < (petals ? 14 : 6); k++) {
        layout.decals.push({
          texture: TEX.fx,
          frame: FX_FRAMES.leaf,
          x: x + rng.int(-34, 34),
          y: y - rng.int(4, 50),
          tint: petals ? rng.pick([0xb59cf0, 0x9a7ce0, 0xd0c0f8]) : undefined,
          flip: rng.chance(0.5),
          depth: DEPTH.groundDecal - 1,
        });
      }
    }
    x += kind === 'tree' ? rng.int(110, 150) : rng.int(95, 130);
    i++;
  }
}

// ---------------------------------------------------------------------------
// Obstáculos con camino garantizado
// ---------------------------------------------------------------------------

function obstacleFootprint(o: ObstaclePlacement) {
  return variantOf(o.type, o.variant).footprint;
}

function visualBox(o: ObstaclePlacement): { x0: number; x1: number; y0: number; y1: number } {
  const fp = obstacleFootprint(o);
  const h = o.type === 'giant' ? 24 : o.type === 'looseTile' ? 8 : 12;
  return { x0: o.x - fp.w / 2 - 2, x1: o.x + fp.w / 2 + 2, y0: o.y - h, y1: o.y + 3 };
}

function isOccluded(o: ObstaclePlacement, props: PropPlacement[]): boolean {
  const box = visualBox(o);
  for (const p of props) {
    if (Math.abs(p.x - o.x) > 60 || o.y >= p.y) continue;
    for (const r of PROP_DEFS[p.kind].occlusion) {
      const rx0 = p.x + r.dx;
      const rx1 = rx0 + r.w;
      const ry0 = p.y + r.top;
      const ry1 = p.y + r.bottom;
      if (box.x1 > rx0 && box.x0 < rx1 && box.y1 > ry0 && box.y0 < ry1) return true;
    }
  }
  return false;
}

function isPlaceable(o: ObstaclePlacement, layout: LevelLayout, others: ObstaclePlacement[]): boolean {
  const fp = obstacleFootprint(o);
  if (o.y - fp.h / 2 < LAYOUT.walkMinY + 1 || o.y + fp.h / 2 > LAYOUT.walkMaxY - 1) return false;
  if (o.x < LEVEL_GEN.startClear - 30 || o.x > layout.length - 40) return false;
  for (const p of layout.props) {
    if (Math.abs(p.x - o.x) > 40) continue;
    if (footprintsOverlap(o.x, o.y, expand(fp, 6), p.x, p.y, PROP_DEFS[p.kind].solid)) return false;
    // Las baldosas flojas no van sobre la tierra de las cazuelas.
    if (o.type === 'looseTile' && p.kind === 'tree' && Math.abs(p.x - o.x) < 22 && o.y > p.y - 12) return false;
  }
  if (isOccluded(o, layout.props)) return false;
  for (const other of others) {
    if (Math.abs(other.x - o.x) > 40) continue;
    const gap = o.type === 'looseTile' && other.type === 'looseTile' ? 0 : LEVEL_GEN.obstacleGap;
    if (footprintsOverlap(o.x, o.y, expand(fp, gap), other.x, other.y, obstacleFootprint(other))) return false;
  }
  return true;
}

function placeObstacles(layout: LevelLayout, block: BlockDefinition, rng: RNG): void {
  const L = layout.length;
  const grid = new PathGrid(L + 60, LAYOUT.walkMinY, LAYOUT.walkMaxY, LEVEL_GEN.gridCell, LEVEL_GEN.pathMargin);
  for (const p of layout.props) grid.block(p.x, p.y, PROP_DEFS[p.kind].solid);

  const reaches: Uint8Array[] = new Array(grid.cols);
  reaches[0] = grid.startReach(0, layout.startY);
  let lastCol = 0;
  const extendTo = (col: number): boolean => {
    if (col <= lastCol) return true;
    const res = grid.propagateAll(reaches[lastCol], lastCol + 1, col);
    if (!res) return false;
    res.forEach((r, k) => (reaches[lastCol + 1 + k] = r));
    lastCol = col;
    return true;
  };
  extendTo(grid.colOf(LEVEL_GEN.startClear - 40));

  const usable = L - LEVEL_GEN.startClear - LEVEL_GEN.endClear;
  const script = [...(block.script ?? [])].sort((a, b) => a.at - b.at);
  let scriptIndex = 0;
  let x = LEVEL_GEN.startClear;
  let previous: string | null = null;
  while (x < L - LEVEL_GEN.endClear - 60) {
    const progress = clamp((x - LEVEL_GEN.startClear) / usable, 0, 1);
    const d = clamp(lerp(block.difficulty[0], block.difficulty[1], progress) + rng.range(-0.06, 0.06), 0, 1);
    // Los patrones del guion tienen prioridad cuando se llega a su posición.
    let intro = false;
    let pattern = choosePattern(d, rng, previous);
    if (scriptIndex < script.length && progress >= script[scriptIndex].at) {
      const scripted = PATTERNS.find((p) => p.id === script[scriptIndex].pattern);
      scriptIndex++;
      if (scripted) {
        pattern = scripted;
        intro = true;
      }
    }
    const w = Math.min(pattern.width(d, rng), L - LEVEL_GEN.endClear - x);
    // Se revalida desde un poco antes del tramo: los obstáculos nuevos pueden
    // influir unas columnas hacia atrás (su huella más la del jugador).
    const c0 = grid.colOf(x - 40);
    const c1 = grid.colOf(x + w + 40);
    const base = Math.max(0, Math.min(c0 - 1, lastCol));

    let accepted = false;
    for (let attempt = 0; attempt < LEVEL_GEN.maxChunkAttempts && !accepted; attempt++) {
      if (attempt > 0 && attempt % 3 === 0 && !intro) pattern = choosePattern(d * 0.7, rng, null);
      const result = pattern.build({ x0: x, width: w, d, rng, yMin: OBSTACLE_Y_MIN, yMax: OBSTACLE_Y_MAX, inner: LEVEL_GEN.chunkInnerMargin, intro });
      const chosen: ObstaclePlacement[] = [];
      for (const o of result.obstacles) {
        if (isPlaceable(o, layout, [...layout.obstacles.slice(-40), ...chosen])) chosen.push(o);
      }
      const snap = grid.snapshot(c0 - 8, c1 + 8);
      chosen.forEach((o) => grid.block(o.x, o.y, obstacleFootprint(o)));
      const res = grid.propagateAll(reaches[base], base + 1, c1);
      if (res) {
        res.forEach((r, k) => (reaches[base + 1 + k] = r));
        lastCol = c1;
        layout.obstacles.push(...chosen);
        layout.decals.push(...result.decals);
        accepted = true;
      } else {
        grid.restore(snap);
      }
    }
    if (!accepted) extendTo(c1);
    previous = pattern.id;
    x += w;
  }

  repairIfNeeded(layout, grid);
}

/** Red de seguridad: si por algún motivo no hay camino, quita obstáculos hasta que lo haya. */
function repairIfNeeded(layout: LevelLayout, grid: PathGrid): void {
  const rebuild = () => {
    grid.clear();
    for (const p of layout.props) grid.block(p.x, p.y, PROP_DEFS[p.kind].solid);
    for (const o of layout.obstacles) grid.block(o.x, o.y, obstacleFootprint(o));
  };
  for (let guard = 0; guard < 80; guard++) {
    rebuild();
    const dead = grid.firstDeadColumn(grid.startReach(0, layout.startY), 1, grid.colOf(layout.length + 20));
    if (dead < 0) return;
    const deadX = grid.xOf(dead);
    let best = -1;
    let bestDist = Infinity;
    layout.obstacles.forEach((o, i) => {
      const dist = Math.abs(o.x - deadX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best < 0) return;
    layout.obstacles.splice(best, 1);
  }
}

// ---------------------------------------------------------------------------
// Decoración del piso
// ---------------------------------------------------------------------------

function nearObstacle(layout: LevelLayout, x: number, y: number, dist: number): boolean {
  return layout.obstacles.some((o) => Math.abs(o.x - x) < dist && Math.abs(o.y - y) < dist * 0.6);
}

function placeDecor(layout: LevelLayout, rng: RNG): void {
  const L = layout.worldWidth;
  for (let x = 20; x < L; x += rng.int(30, 70)) {
    const frame = rng.pick(DECAL_FRAMES);
    let y = rng.int(LAYOUT.sidewalkTop + 8, LAYOUT.sidewalkBottom - 6);
    let dx = x;
    if (frame === 'patch' || frame === 'cover') {
      // Alineadas a la grilla de baldosas.
      dx = Math.floor(x / LAYOUT.tileW) * LAYOUT.tileW + LAYOUT.tileW / 2;
      y = LAYOUT.sidewalkTop + Math.floor((y - LAYOUT.sidewalkTop) / LAYOUT.tileH) * LAYOUT.tileH + LAYOUT.tileH / 2;
    }
    if (dx > layout.crossStreetX - 12 && dx < layout.crossStreetX + CROSS_STREET_WIDTH + 12) continue;
    if (nearObstacle(layout, dx, y, 16)) continue;
    if (layout.props.some((p) => Math.abs(p.x - dx) < 18 && y > p.y - 14)) continue;
    layout.decals.push({ texture: TEX.decals, frame, x: dx, y, flip: rng.chance(0.5), depth: DEPTH.groundDecal - 3 });
  }
  // Rejillas de desagüe junto al cordón.
  for (let x = rng.int(200, 400); x < L; x += rng.int(500, 900)) {
    if (layout.props.some((p) => Math.abs(p.x - x) < 20)) continue;
    if (x > layout.crossStreetX - 12 && x < layout.crossStreetX + CROSS_STREET_WIDTH + 12) continue;
    layout.decals.push({ texture: TEX.decals, frame: 'drain', x, y: LAYOUT.sidewalkBottom - 3, depth: DEPTH.groundDecal - 3 });
  }
}

// ---------------------------------------------------------------------------
// Autos estacionados, palomas y peatones
// ---------------------------------------------------------------------------

function placeCars(layout: LevelLayout, theme: NeighborhoodTheme, rng: RNG): void {
  let x = rng.int(0, 40);
  const crossA = layout.crossStreetX - 12;
  const crossB = layout.crossStreetX + CROSS_STREET_WIDTH + 12;
  while (x < layout.worldWidth) {
    if (rng.chance(0.12)) {
      if (!(x + 40 > crossA && x < crossB)) layout.cars.push({ variant: 0, x: x + 20, flip: false, container: true });
      x += 40 + rng.int(8, 30);
      continue;
    }
    if (rng.chance(0.16)) {
      x += rng.int(30, 80);
      continue;
    }
    const variant = rng.int(0, Math.min(theme.carVariants, CAR_STYLES.length) - 1);
    const w = CAR_STYLES[variant].small ? 56 : 78;
    if (x + w > crossA && x < crossB) {
      x = crossB;
      continue;
    }
    layout.cars.push({ variant, x: x + w / 2, flip: rng.chance(0.5) });
    x += w + rng.int(6, 28);
  }
}

function placePigeons(layout: LevelLayout, rng: RNG): void {
  for (let x = rng.int(300, 500); x < layout.length - 100; x += rng.int(450, 800)) {
    const count = rng.int(1, 3);
    const y = rng.int(LAYOUT.walkMinY + 6, LAYOUT.walkMaxY - 8);
    for (let i = 0; i < count; i++) {
      const px = x + i * rng.int(8, 14);
      const py = y + rng.int(-6, 6);
      if (nearObstacle(layout, px, py, 14)) continue;
      layout.pigeons.push({ x: px, y: py });
    }
  }
}

function placeNpcs(layout: LevelLayout, rng: RNG): void {
  const kinds: NpcKind[] = ['walker', 'lady', 'tourist'];
  const L = layout.length;
  rng.shuffle(kinds).forEach((kind, i) => {
    const x = Math.round(L * (0.18 + i * 0.3) + rng.int(-200, 200));
    const dogs = kind === 'walker' ? rng.shuffle(DOG_KINDS.map((_, k) => k)).slice(0, rng.int(3, 4)) : [];
    layout.npcs.push({ kind, x, dir: rng.chance(0.6) ? -1 : 1, dogs });
  });
}
