import { DEPTH, LAYOUT } from '../config/constants';
import { COIN_TUNING, CROSSING_TUNING, CROWD_TUNING, LEVEL_GEN, WATER_TUNING } from '../config/balance';
import { clamp, lerp } from '../core/math';
import { RNG } from '../core/rng';
import { DEFAULT_TRAITS, isDefaultBackground, type BarrioTraits } from '../data/barrioTraits';
import type { ScriptedPattern, StreetBlock } from '../data/campaign';
import { ENVIRONMENTS, type EnvironmentDef } from '../data/environments';
import { variantOf } from '../entities/obstacles/ObstacleTypes';
import { CAR_STYLES } from '../graphics/carStyles';
import { BROKEN_DECAL_FRAMES, DECAL_FRAMES, DOG_KINDS, FX_FRAMES, PROP_FRAMES, TEX } from '../graphics/keys';
import { expand, footprintsOverlap } from '../systems/Collision';
import {
  PROP_DEFS,
  type BlockSegment,
  type CoinPlacement,
  type CrossingSegment,
  type DecalPlacement,
  type LevelLayout,
  type NpcKind,
  type NpcPlacement,
  type ObstaclePlacement,
  type PropKind,
  type PropPlacement,
} from './LevelLayout';
import { PathGrid } from './PathGrid';
import { choosePattern, PATTERNS } from './patterns';
import type { NeighborhoodTheme } from './themes';

/** Calle transversal decorativa de la esquina final (sin tránsito). */
export const CROSS_STREET_WIDTH = 112;
const CORNER_WIDTH = 128;
const OBSTACLE_Y_MIN = LAYOUT.walkMinY + 3;
const OBSTACLE_Y_MAX = LAYOUT.walkMaxY - 3;
const START_X = 70;
const START_Y = 182;
const DRY_LEAF_TINTS = [0xd9822b, 0xe3a13a, 0xb35a24, 0xd9b14a, 0xc46a2a];

/** Lo que necesita el generador para armar una cuadra. */
export interface BlockSpec {
  street: StreetBlock;
  length: number;
  difficulty: [number, number];
  script?: ScriptedPattern[];
}

export interface LevelGenOptions {
  theme: NeighborhoodTheme;
  env: EnvironmentDef;
  seed: number;
  blocks: BlockSpec[];
  /** Multiplicador de tránsito de los cruces. */
  traffic?: number;
  /** Cuadra con la misión del nivel (o null). */
  missionBlock?: number | null;
  /** Misión del nivel (por defecto, la basura del portero). */
  missionId?: string;
  /** Cuadras donde riega una vecina. */
  waterBlocks?: number[];
  coins?: boolean;
  /** Lo que hace distinto al barrio (por defecto, DEFAULT_TRAITS). */
  traits?: BarrioTraits;
}

/**
 * Arma un nivel completo: varias cuadras unidas por esquinas con cruce
 * peatonal. La misma semilla produce siempre el mismo nivel.
 */
export function generateLevelLayout(opts: LevelGenOptions): LevelLayout {
  const rng = new RNG(opts.seed);
  const traits = opts.traits ?? DEFAULT_TRAITS;
  // Cada rasgo del barrio usa su propia semilla: con los rasgos por defecto,
  // el nivel queda idéntico al de siempre (los récords siguen valiendo).
  const traitRng = (salt: number) => new RNG((opts.seed ^ salt) >>> 0);
  const treeRng = traitRng(0x7ee5a1);
  const npcRng = traitRng(0x0c0ffe);
  const pigeonRng = traitRng(0x9a10a5);
  const layout: LevelLayout = {
    length: 0,
    worldWidth: 0,
    startX: START_X,
    startY: START_Y,
    blocks: [],
    crossings: [],
    obstacles: [],
    props: [],
    decals: [],
    facades: [],
    cars: [],
    pigeons: [],
    npcs: [],
    crowd: [],
    coins: [],
    mission: null,
    waterLadies: [],
    crossStreetX: 0,
    finalStreet: null,
    backDecor: [],
  };

  // 1) Ubicación de cuadras y esquinas.
  const t = CROSSING_TUNING;
  let x = 0;
  const firstDir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  opts.blocks.forEach((spec, i) => {
    const seg: BlockSegment = { index: i, startX: x, endX: x + spec.length, street: spec.street, difficulty: spec.difficulty };
    layout.blocks.push(seg);
    if (i < opts.blocks.length - 1) {
      const x0 = seg.endX + t.cornerGap;
      const roadX0 = x0 + t.roadInset;
      const roadX1 = x0 + t.width - t.roadInset;
      const laneW = (roadX1 - roadX0) / t.lanes;
      layout.crossings.push({
        index: i,
        x0,
        x1: x0 + t.width,
        roadX0,
        roadX1,
        laneXs: Array.from({ length: t.lanes }, (_, k) => Math.round(roadX0 + laneW * (k + 0.5))),
        // En Buenos Aires las calles paralelas alternan su sentido de circulación.
        dir: (i % 2 === 0 ? firstDir : -firstDir) as 1 | -1,
        street: spec.street.to,
        seed: (opts.seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0,
        density: (opts.traffic ?? 1) * opts.env.traffic,
      });
      x = x0 + t.width;
    }
  });
  const last = layout.blocks[layout.blocks.length - 1];
  layout.length = last.endX;
  layout.crossStreetX = last.endX + t.cornerGap;
  layout.finalStreet = last.street.to;
  layout.worldWidth = layout.crossStreetX + CROSS_STREET_WIDTH + CORNER_WIDTH + 170;

  // 2) Contenido de cada cuadra.
  placeFacades(layout, opts.theme, rng);
  layout.blocks.forEach((seg, i) => {
    const spec = opts.blocks[i];
    placeProps(layout, seg, opts.theme, rng, traits, treeRng);
    const missionId = opts.missionId ?? 'trash-to-bin';
    if (opts.missionBlock === i) placeMissionTarget(layout, seg, missionId);
    const reaches = placeObstacles(layout, seg, spec, opts.env, rng, traits);
    if (opts.coins !== false) placeCoins(layout, seg, reaches, rng);
    if (opts.missionBlock === i) {
      if (missionId === 'lost-dog') placeLostDog(layout, seg, reaches, rng);
      else placeMissionItems(layout, seg, reaches, rng);
    }
    placePigeons(layout, seg, rng, traits, pigeonRng);
    placeNpcs(layout, seg, rng, traits, npcRng);
  });
  placeDecor(layout, opts.env, rng);
  if (traits.brokenSidewalk > DEFAULT_TRAITS.brokenSidewalk) placeBrokenSidewalk(layout, traits.brokenSidewalk, traitRng(0xb20cea));
  placeCars(layout, opts.theme, rng);
  // Con su propia semilla: agregar vecinas no cambia el resto del nivel.
  if (opts.waterBlocks?.length) placeWaterLadies(layout, opts.waterBlocks, new RNG((opts.seed ^ 0x5a17e3) >>> 0));
  // La gente se ubica al final, cuando ya están los soretes, las vecinas y la misión.
  if (traits.crowd > 0) {
    const crowdRng = traitRng(0xc40d3d);
    layout.blocks.forEach((seg) => placeCrowd(layout, seg, traits, crowdRng));
  }
  return layout;
}

/** Fondo animado del menú: una sola vereda larguísima, sin cruces ni monedas. */
export function generateMenuLayout(theme: NeighborhoodTheme, seed: number): LevelLayout {
  return generateLevelLayout({
    theme,
    env: ENVIRONMENTS.day,
    seed,
    blocks: [{ street: { street: 'DEFENSA', from: '', to: '' }, length: 20000, difficulty: [0.1, 0.3] }],
    coins: false,
  });
}

// ---------------------------------------------------------------------------
// Fachadas
// ---------------------------------------------------------------------------

/** Rangos de x donde no hay vereda (calzadas de las esquinas). */
function streetRanges(layout: LevelLayout, pad = 12): [number, number][] {
  const ranges: [number, number][] = layout.crossings.map((c) => [c.x0 - pad, c.x1 + pad]);
  ranges.push([layout.crossStreetX - pad, layout.crossStreetX + CROSS_STREET_WIDTH + pad]);
  return ranges;
}

function inStreet(ranges: [number, number][], x0: number, x1 = x0): boolean {
  return ranges.some(([a, b]) => x1 > a && x0 < b);
}

function placeFacades(layout: LevelLayout, theme: NeighborhoodTheme, rng: RNG): void {
  const w = (id: string) => theme.facadeWidths[id] ?? 112;
  const recent: string[] = [];
  layout.blocks.forEach((seg, i) => {
    // Primera cuadra: la esquina de partida asoma por la izquierda de la pantalla.
    let x = i === 0 ? -40 : seg.startX;
    layout.facades.push({ id: theme.cornerStartId, x, width: w(theme.cornerStartId) });
    x += w(theme.cornerStartId);
    const cornerX = i < layout.crossings.length ? layout.crossings[i].x0 : layout.crossStreetX;
    const cornerEndX = cornerX - w(theme.cornerEndId);
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
  });
  // Del otro lado de la última transversal asoma la cuadra siguiente.
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

function placeProps(layout: LevelLayout, seg: BlockSegment, theme: NeighborhoodTheme, rng: RNG, traits: BarrioTraits, treeRng: RNG): void {
  const sequence: PropKind[] = ['tree', 'lamp', 'tree', 'bin', 'tree', 'lamp', 'tree', 'binBags'];
  const L = seg.endX - seg.startX;
  let i = rng.int(0, sequence.length - 1);
  let x = seg.startX + 110 + rng.int(0, 50);
  let busStopPlaced = false;
  while (x < seg.endX - 70) {
    let kind = sequence[i % sequence.length];
    if (!busStopPlaced && kind === 'lamp' && x > seg.startX + L * 0.4) {
      kind = 'busStop';
      busStopPlaced = true;
    }
    const y = LAYOUT.propFrontY - (kind === 'tree' ? rng.int(0, 1) : 0);
    const variant = kind === 'tree' ? rng.weighted(theme.trees.map((t) => ({ item: t.variant, weight: t.weight }))) : 0;
    // Barrio con pocos árboles (rasgo `trees`): algunos lugares quedan vacíos,
    // a veces con la cazuela sin árbol. Se sortea con su propia semilla y se
    // consumen los mismos números que si el árbol estuviera, así el resto del
    // nivel no cambia.
    const keep = kind !== 'tree' || traits.trees >= 1 || treeRng.next() < traits.trees;
    if (keep) layout.props.push({ kind, x, y, variant });
    else if (treeRng.chance(0.5)) layout.decals.push({ texture: TEX.props, frame: PROP_FRAMES.treePit, x, y: y - 2, depth: DEPTH.groundDecal - 2 });
    if (kind === 'tree') {
      const around: DecalPlacement[] = [{ texture: TEX.props, frame: PROP_FRAMES.treePit, x, y: y - 2, depth: DEPTH.groundDecal - 2 }];
      if (rng.chance(0.55)) {
        around.push({ texture: TEX.props, frame: PROP_FRAMES.rootTiles, x: x + (rng.chance(0.5) ? -20 : 20), y: y - 9, depth: DEPTH.groundDecal - 2 });
      }
      // Hojas o flores caídas alrededor del árbol.
      const petals = variant === 2;
      for (let k = 0; k < (petals ? 14 : 6); k++) {
        around.push({
          texture: TEX.fx,
          frame: FX_FRAMES.leaf,
          x: x + rng.int(-34, 34),
          y: y - rng.int(4, 50),
          tint: petals ? rng.pick([0xb59cf0, 0x9a7ce0, 0xd0c0f8]) : undefined,
          flip: rng.chance(0.5),
          depth: DEPTH.groundDecal - 1,
        });
      }
      if (keep) layout.decals.push(...around);
    }
    x += kind === 'tree' ? rng.int(110, 150) : rng.int(95, 130);
    i++;
  }
}

/**
 * Dónde se entrega la misión, cerca del final de la cuadra: el tacho junto al
 * cordón (basura) o la dueña del perro esperando junto a las fachadas.
 */
function placeMissionTarget(layout: LevelLayout, seg: BlockSegment, missionId: string): void {
  const tx = Math.round(seg.startX + (seg.endX - seg.startX) * 0.86);
  if (missionId === 'lost-dog') {
    const y = LAYOUT.walkMinY + 4;
    layout.mission = { id: missionId, blockIndex: seg.index, giver: { npc: 'duenaPerro', x: tx, y }, items: [], target: { x: tx, y } };
    return;
  }
  // Se corren los props que quedarían encima.
  for (let k = layout.props.length - 1; k >= 0; k--) {
    const p = layout.props[k];
    if (p.x > seg.startX && p.x < seg.endX && Math.abs(p.x - tx) < 46) layout.props.splice(k, 1);
  }
  layout.props.push({ kind: 'bin', x: tx, y: LAYOUT.propFrontY, variant: 1 });
  layout.mission = {
    id: 'trash-to-bin',
    blockIndex: seg.index,
    giver: { npc: 'portero', x: Math.round(seg.startX + 460), y: LAYOUT.walkMinY + 4 },
    items: [],
    target: { x: tx, y: LAYOUT.propFrontY },
  };
}

// ---------------------------------------------------------------------------
// Obstáculos con camino garantizado (por cuadra, en coordenadas locales)
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

function isPlaceable(o: ObstaclePlacement, length: number, props: PropPlacement[], others: ObstaclePlacement[]): boolean {
  const fp = obstacleFootprint(o);
  if (o.y - fp.h / 2 < LAYOUT.walkMinY + 1 || o.y + fp.h / 2 > LAYOUT.walkMaxY - 1) return false;
  if (o.x < LEVEL_GEN.startClear - 30 || o.x > length - 40) return false;
  for (const p of props) {
    if (Math.abs(p.x - o.x) > 40) continue;
    if (footprintsOverlap(o.x, o.y, expand(fp, 6), p.x, p.y, PROP_DEFS[p.kind].solid)) return false;
    // Las baldosas flojas no van sobre la tierra de las cazuelas.
    if (o.type === 'looseTile' && p.kind === 'tree' && Math.abs(p.x - o.x) < 22 && o.y > p.y - 12) return false;
  }
  if (isOccluded(o, props)) return false;
  for (const other of others) {
    if (Math.abs(other.x - o.x) > 40) continue;
    const gap = o.type === 'looseTile' && other.type === 'looseTile' ? 0 : LEVEL_GEN.obstacleGap;
    if (footprintsOverlap(o.x, o.y, expand(fp, gap), other.x, other.y, obstacleFootprint(other))) return false;
  }
  return true;
}

/** Celdas alcanzables por columna de una cuadra (para ubicar monedas y basura en lugares seguros). */
export interface BlockReach {
  grid: PathGrid;
  reaches: Uint8Array[];
  /** x mundo donde empieza la grilla. */
  originX: number;
}

function placeObstacles(layout: LevelLayout, seg: BlockSegment, spec: BlockSpec, env: EnvironmentDef, rng: RNG, traits: BarrioTraits): BlockReach {
  const x0 = seg.startX;
  const L = seg.endX - seg.startX;
  // Todo se calcula en coordenadas locales de la cuadra (0 = comienzo de la vereda).
  const props = layout.props.filter((p) => p.x > x0 - 60 && p.x < seg.endX + 60).map((p) => ({ ...p, x: p.x - x0 }));
  const obstacles: ObstaclePlacement[] = [];
  const grid = new PathGrid(L + 60, LAYOUT.walkMinY, LAYOUT.walkMaxY, LEVEL_GEN.gridCell, LEVEL_GEN.pathMargin);
  for (const p of props) grid.block(p.x, p.y, PROP_DEFS[p.kind].solid);

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

  const weights: Record<string, number> = { leaves: env.leafPileWeight };
  // Vereda rota: más baldosas flojas. Casi sin árboles: menos montones de hojas
  // (con algunos árboles, el viento igual trae hojas).
  const tiles = Math.max(0.3, 1 + 4 * (traits.brokenSidewalk - DEFAULT_TRAITS.brokenSidewalk));
  if (tiles !== 1) weights.tiles = weights.tileRow = tiles;
  if (traits.trees < 0.5) weights.leaves = env.leafPileWeight * Math.max(0.2, traits.trees * 2);
  // Donde hay mucha gente, la gente reemplaza a parte de los soretes: más tramos libres.
  if (traits.crowd > 0) weights.rest = 1 + traits.crowd * 2.5;
  const usable = L - LEVEL_GEN.startClear - LEVEL_GEN.endClear;
  const script = [...(spec.script ?? [])].sort((a, b) => a.at - b.at);
  let scriptIndex = 0;
  let x = LEVEL_GEN.startClear;
  let previous: string | null = null;
  while (x < L - LEVEL_GEN.endClear - 60) {
    const progress = clamp((x - LEVEL_GEN.startClear) / usable, 0, 1);
    const d = clamp(lerp(spec.difficulty[0], spec.difficulty[1], progress) + rng.range(-0.06, 0.06), 0, 1);
    // Los patrones del guion tienen prioridad cuando se llega a su posición.
    let intro = false;
    let pattern = choosePattern(d, rng, previous, weights);
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
      if (attempt > 0 && attempt % 3 === 0 && !intro) pattern = choosePattern(d * 0.7, rng, null, weights);
      const result = pattern.build({
        x0: x,
        width: w,
        d,
        rng,
        yMin: OBSTACLE_Y_MIN,
        yMax: OBSTACLE_Y_MAX,
        inner: LEVEL_GEN.chunkInnerMargin,
        intro,
        camoChance: env.camoChance,
      });
      const chosen: ObstaclePlacement[] = [];
      for (const o of result.obstacles) {
        if (isPlaceable(o, L, props, [...obstacles.slice(-40), ...chosen])) chosen.push(o);
      }
      const snap = grid.snapshot(c0 - 8, c1 + 8);
      chosen.forEach((o) => grid.block(o.x, o.y, obstacleFootprint(o)));
      const res = grid.propagateAll(reaches[base], base + 1, c1);
      if (res) {
        res.forEach((r, k) => (reaches[base + 1 + k] = r));
        lastCol = c1;
        obstacles.push(...chosen);
        layout.decals.push(...result.decals.map((dc) => ({ ...dc, x: dc.x + x0 })));
        accepted = true;
      } else {
        grid.restore(snap);
      }
    }
    if (!accepted) extendTo(c1);
    previous = pattern.id;
    x += w;
  }

  repairIfNeeded(obstacles, props, grid, layout.startY, L);

  // Conjunto alcanzable definitivo (después de la reparación).
  grid.clear();
  for (const p of props) grid.block(p.x, p.y, PROP_DEFS[p.kind].solid);
  for (const o of obstacles) grid.block(o.x, o.y, obstacleFootprint(o));
  const start = grid.startReach(0, layout.startY);
  const all = grid.propagateAll(start, 1, grid.colOf(L)) ?? [];
  const finalReach = [start, ...all];

  layout.obstacles.push(...obstacles.map((o) => ({ ...o, x: o.x + x0 })));
  return { grid, reaches: finalReach, originX: x0 };
}

/** Red de seguridad: si por algún motivo no hay camino, quita obstáculos hasta que lo haya. */
function repairIfNeeded(obstacles: ObstaclePlacement[], props: PropPlacement[], grid: PathGrid, startY: number, length: number): void {
  const rebuild = () => {
    grid.clear();
    for (const p of props) grid.block(p.x, p.y, PROP_DEFS[p.kind].solid);
    for (const o of obstacles) grid.block(o.x, o.y, obstacleFootprint(o));
  };
  for (let guard = 0; guard < 80; guard++) {
    rebuild();
    const dead = grid.firstDeadColumn(grid.startReach(0, startY), 1, grid.colOf(length + 20));
    if (dead < 0) return;
    const deadX = grid.xOf(dead);
    let best = -1;
    let bestDist = Infinity;
    obstacles.forEach((o, i) => {
      const dist = Math.abs(o.x - deadX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best < 0) return;
    obstacles.splice(best, 1);
  }
}

/** Busca una fila alcanzable en la columna más cercana a `localX`. Devuelve y o null. */
function reachableY(reach: BlockReach, localX: number, preferY: number, rng: RNG): number | null {
  const { grid, reaches } = reach;
  const col = grid.colOf(localX);
  const r = reaches[col];
  if (!r) return null;
  const rows: number[] = [];
  for (let i = 1; i < grid.rows - 1; i++) if (r[i] && r[i - 1] && r[i + 1]) rows.push(i);
  if (rows.length === 0) return null;
  rows.sort((a, b) => Math.abs(grid.yOf(a) - preferY) - Math.abs(grid.yOf(b) - preferY));
  const pick = rows[Math.min(rows.length - 1, rng.int(0, Math.min(2, rows.length - 1)))];
  return grid.yOf(pick);
}

// ---------------------------------------------------------------------------
// Monedas y basura de la misión (siempre en lugares alcanzables sin pisar nada)
// ---------------------------------------------------------------------------

function placeCoins(layout: LevelLayout, seg: BlockSegment, reach: BlockReach, rng: RNG): void {
  const L = seg.endX - seg.startX;
  const groups = Math.max(1, Math.round(COIN_TUNING.coinsPerBlock / 3));
  const span = L - LEVEL_GEN.startClear - LEVEL_GEN.endClear;
  for (let g = 0; g < groups; g++) {
    const center = LEVEL_GEN.startClear + span * ((g + 0.5) / groups) + rng.int(-60, 60);
    const preferY = rng.range(LAYOUT.walkMinY + 10, LAYOUT.walkMaxY - 10);
    let lastY = preferY;
    for (let k = -1; k <= 1; k++) {
      const lx = center + k * 16;
      const y = reachableY(reach, lx, lastY, rng);
      if (y === null) continue;
      lastY = y;
      const coin: CoinPlacement = { x: Math.round(lx + seg.startX), y: Math.round(y) };
      if (layout.obstacles.some((o) => Math.abs(o.x - coin.x) < 14 && Math.abs(o.y - coin.y) < 9)) continue;
      layout.coins.push(coin);
    }
  }
}

/** El perro perdido: a mitad de cuadra, en un lugar alcanzable; su dueña lo espera más adelante. */
function placeLostDog(layout: LevelLayout, seg: BlockSegment, reach: BlockReach, rng: RNG): void {
  if (!layout.mission) return;
  const L = seg.endX - seg.startX;
  const target = layout.mission.target;
  // Que la dueña no quede parada sobre un obstáculo.
  layout.obstacles = layout.obstacles.filter((o) => !(Math.abs(o.x - target.x) < 16 && o.y < target.y + 12));
  for (let attempt = 0; attempt < 6; attempt++) {
    const lx = clamp(L * rng.range(0.38, 0.58), LEVEL_GEN.startClear, L - LEVEL_GEN.endClear);
    const y = reachableY(reach, lx, rng.range(LAYOUT.walkMinY + 14, LAYOUT.walkMaxY - 14), rng);
    if (y === null) continue;
    const x = Math.round(lx + seg.startX);
    if (layout.obstacles.some((o) => Math.abs(o.x - x) < 16 && Math.abs(o.y - y) < 10)) continue;
    layout.mission.items.push({ x, y: Math.round(y), frame: 'dog' });
    return;
  }
}

/** Vecinas que riegan: paradas junto a las fachadas, lejos de la misión y de las esquinas. */
function placeWaterLadies(layout: LevelLayout, blocks: number[], rng: RNG): void {
  for (const index of blocks) {
    const seg = layout.blocks[index];
    if (!seg) continue;
    const L = seg.endX - seg.startX;
    let x = Math.round(seg.startX + L * rng.range(0.4, 0.62));
    const busy = [layout.mission?.giver.x, layout.mission?.target.x].filter((v): v is number => typeof v === 'number');
    for (let k = 0; k < 4 && busy.some((b) => Math.abs(b - x) < 130); k++) x = Math.min(seg.endX - LEVEL_GEN.endClear, x + 140);
    // Que no quede tapada por un árbol, un farol o una parada de colectivo.
    const hides = (vx: number) => layout.props.some((p) => p.kind !== 'bin' && p.kind !== 'binBags' && Math.abs(p.x - vx) < 30);
    for (let k = 0; k < 8 && hides(x); k++) x += k % 2 === 0 ? 36 * (k + 1) : -36 * (k + 1);
    if (busy.some((b) => Math.abs(b - x) < 90) || hides(x) || x < seg.startX + 220 || x > seg.endX - 120) continue;
    const y = LAYOUT.walkMinY + 1;
    // Que no quede parada sobre un obstáculo, y que el carril seco del cordón
    // quede libre a su altura: siempre se puede pasar aunque esté regando.
    const laneTop = LAYOUT.walkMaxY - WATER_TUNING.minLane;
    const band = WATER_TUNING.halfWidth + 16;
    layout.obstacles = layout.obstacles.filter((o) => !(Math.abs(o.x - x) < 16 && o.y < y + 12) && !(Math.abs(o.x - x) < band && o.y > laneTop - 10));
    layout.waterLadies.push({ x, y, blockIndex: index, offset: rng.range(0, 1.8) });
  }
}

function placeMissionItems(layout: LevelLayout, seg: BlockSegment, reach: BlockReach, rng: RNG): void {
  if (!layout.mission) return;
  const L = seg.endX - seg.startX;
  const frames = ['paper', 'can', 'bottle'];
  const giverLocal = layout.mission.giver.x - seg.startX;
  const targetLocal = layout.mission.target.x - seg.startX;
  for (let k = 0; k < 3; k++) {
    const lx = giverLocal + 160 + ((targetLocal - giverLocal - 260) * (k + 0.5)) / 3 + rng.int(-40, 40);
    const y = reachableY(reach, clamp(lx, LEVEL_GEN.startClear, L - LEVEL_GEN.endClear), rng.range(LAYOUT.walkMinY + 12, LAYOUT.walkMaxY - 12), rng);
    if (y === null) continue;
    layout.mission.items.push({ x: Math.round(lx + seg.startX), y: Math.round(y), frame: frames[k % frames.length] });
  }
}

// ---------------------------------------------------------------------------
// Decoración del piso
// ---------------------------------------------------------------------------

function nearObstacle(layout: LevelLayout, x: number, y: number, dist: number): boolean {
  return layout.obstacles.some((o) => Math.abs(o.x - x) < dist && Math.abs(o.y - y) < dist * 0.6);
}

function placeDecor(layout: LevelLayout, env: EnvironmentDef, rng: RNG): void {
  const L = layout.worldWidth;
  const streets = streetRanges(layout);
  for (let x = 20; x < L; x += rng.int(30, 70)) {
    const frame = rng.pick(DECAL_FRAMES);
    let y = rng.int(LAYOUT.sidewalkTop + 8, LAYOUT.sidewalkBottom - 6);
    let dx = x;
    if (frame === 'patch' || frame === 'cover') {
      // Alineadas a la grilla de baldosas.
      dx = Math.floor(x / LAYOUT.tileW) * LAYOUT.tileW + LAYOUT.tileW / 2;
      y = LAYOUT.sidewalkTop + Math.floor((y - LAYOUT.sidewalkTop) / LAYOUT.tileH) * LAYOUT.tileH + LAYOUT.tileH / 2;
    }
    if (inStreet(streets, dx)) continue;
    if (nearObstacle(layout, dx, y, 16)) continue;
    if (layout.props.some((p) => Math.abs(p.x - dx) < 18 && y > p.y - 14)) continue;
    layout.decals.push({ texture: TEX.decals, frame, x: dx, y, flip: rng.chance(0.5), depth: DEPTH.groundDecal - 3 });
  }
  // Rejillas de desagüe junto al cordón.
  for (let x = rng.int(200, 400); x < L; x += rng.int(500, 900)) {
    if (layout.props.some((p) => Math.abs(p.x - x) < 20)) continue;
    if (inStreet(streets, x - 8, x + 8)) continue;
    layout.decals.push({ texture: TEX.decals, frame: 'drain', x, y: LAYOUT.sidewalkBottom - 3, depth: DEPTH.groundDecal - 3 });
  }
  // Otoño: hojas secas sueltas por toda la vereda (lejos de los soretes para no confundir).
  if (env.looseLeaves > 0) {
    const count = Math.round((layout.length / 100) * env.looseLeaves);
    for (let i = 0; i < count; i++) {
      const x = rng.range(0, layout.length);
      const y = rng.range(LAYOUT.sidewalkTop + 6, LAYOUT.sidewalkBottom - 4);
      if (inStreet(streets, x) || nearObstacle(layout, x, y, 12)) continue;
      layout.decals.push({ texture: TEX.fx, frame: FX_FRAMES.leaf, x: Math.round(x), y: Math.round(y), tint: rng.pick(DRY_LEAF_TINTS), flip: rng.chance(0.5), depth: DEPTH.groundDecal - 1 });
    }
  }
}

/** Cuánto aparece cada marca de la vereda rota. */
const BROKEN_WEIGHTS: Record<(typeof BROKEN_DECAL_FRAMES)[number], number> = { hole: 2, bigCrack: 2, rubble: 1.5, crack1: 1, crack2: 1, patch: 2 };

/** Vereda rota (rasgo `brokenSidewalk`): baldosas que faltan, grietas largas, parches y cascotes. */
function placeBrokenSidewalk(layout: LevelLayout, broken: number, rng: RNG): void {
  const streets = streetRanges(layout);
  const count = Math.round((layout.worldWidth / 100) * (broken - DEFAULT_TRAITS.brokenSidewalk) * 2.4);
  const options = BROKEN_DECAL_FRAMES.map((f) => ({ item: f, weight: BROKEN_WEIGHTS[f] }));
  for (let i = 0; i < count; i++) {
    const frame = rng.weighted(options);
    let x = rng.range(0, layout.worldWidth);
    let y = rng.range(LAYOUT.sidewalkTop + 6, LAYOUT.sidewalkBottom - 6);
    if (frame === 'hole' || frame === 'patch') {
      // Alineadas a la grilla de baldosas.
      x = Math.floor(x / LAYOUT.tileW) * LAYOUT.tileW + LAYOUT.tileW / 2;
      y = LAYOUT.sidewalkTop + Math.floor((y - LAYOUT.sidewalkTop) / LAYOUT.tileH) * LAYOUT.tileH + LAYOUT.tileH / 2;
    }
    if (inStreet(streets, x - 14, x + 14)) continue;
    // Lejos de los obstáculos (que las baldosas flojas se sigan distinguiendo) y de los árboles.
    if (nearObstacle(layout, x, y, 18)) continue;
    if (layout.props.some((p) => Math.abs(p.x - x) < 20 && y > p.y - 16)) continue;
    layout.decals.push({ texture: TEX.decals, frame, x: Math.round(x), y: Math.round(y), flip: rng.chance(0.5), depth: DEPTH.groundDecal - 3 });
  }
}

// ---------------------------------------------------------------------------
// Autos estacionados, palomas y peatones
// ---------------------------------------------------------------------------

function placeCars(layout: LevelLayout, theme: NeighborhoodTheme, rng: RNG): void {
  const streets = streetRanges(layout);
  let x = rng.int(0, 40);
  while (x < layout.worldWidth) {
    if (rng.chance(0.12)) {
      if (!inStreet(streets, x, x + 40)) layout.cars.push({ variant: 0, x: x + 20, flip: false, container: true });
      x += 40 + rng.int(8, 30);
      continue;
    }
    if (rng.chance(0.16)) {
      x += rng.int(30, 80);
      continue;
    }
    const variant = rng.int(0, Math.min(theme.carVariants, CAR_STYLES.length) - 1);
    const w = CAR_STYLES[variant].small ? 56 : 78;
    const blocking = streets.find(([a, b]) => x + w > a && x < b);
    if (blocking) {
      x = blocking[1];
      continue;
    }
    layout.cars.push({ variant, x: x + w / 2, flip: rng.chance(0.5) });
    x += w + rng.int(6, 28);
  }
}

function placePigeons(layout: LevelLayout, seg: BlockSegment, rng: RNG, traits: BarrioTraits, pigeonRng: RNG): void {
  const before = layout.pigeons.length;
  for (let x = seg.startX + rng.int(300, 500); x < seg.endX - 100; x += rng.int(450, 800)) {
    const count = rng.int(1, 3);
    const y = rng.int(LAYOUT.walkMinY + 6, LAYOUT.walkMaxY - 8);
    for (let i = 0; i < count; i++) {
      const px = x + i * rng.int(8, 14);
      const py = y + rng.int(-6, 6);
      if (nearObstacle(layout, px, py, 14)) continue;
      layout.pigeons.push({ x: px, y: py });
    }
  }
  // Rasgo `pigeons` (con su propia semilla, sin tocar el resto del nivel).
  if (traits.pigeons < 1) {
    const kept = layout.pigeons.slice(before).filter(() => pigeonRng.next() < traits.pigeons);
    layout.pigeons.length = before;
    layout.pigeons.push(...kept);
  } else if (traits.pigeons > 1) {
    // Bandadas extra: en promedio hay una cada 625 px de cuadra.
    const extra = Math.round((traits.pigeons - 1) * Math.max(1, (seg.endX - seg.startX) / 625));
    for (let k = 0; k < extra; k++) {
      const x = pigeonRng.range(seg.startX + 260, seg.endX - 120);
      const y = pigeonRng.int(LAYOUT.walkMinY + 6, LAYOUT.walkMaxY - 8);
      const count = pigeonRng.int(2, 4);
      for (let i = 0; i < count; i++) {
        const px = Math.round(x + i * pigeonRng.int(8, 14));
        const py = y + pigeonRng.int(-6, 6);
        if (nearObstacle(layout, px, py, 14)) continue;
        layout.pigeons.push({ x: px, y: py });
      }
    }
  }
}

function placeNpcs(layout: LevelLayout, seg: BlockSegment, rng: RNG, traits: BarrioTraits, npcRng: RNG): void {
  // Los de siempre se sortean igual aunque el barrio tenga otra mezcla: así el resto del nivel no cambia.
  const usual = usualNpcs(seg, rng);
  layout.npcs.push(...(isDefaultBackground(traits) ? usual : npcsFor(seg, traits, npcRng)));
}

/** Uno de cada tipo por cuadra (paseador con sus perros, señora y turista). */
function usualNpcs(seg: BlockSegment, rng: RNG): NpcPlacement[] {
  const kinds: NpcKind[] = ['walker', 'lady', 'tourist'];
  const L = seg.endX - seg.startX;
  const minX = seg.startX - 10;
  const maxX = seg.endX + 16;
  return rng.shuffle(kinds).map((kind, i): NpcPlacement => {
    const x = Math.round(seg.startX + L * (0.18 + i * 0.3) + rng.int(-200, 200));
    const dogs = kind === 'walker' ? rng.shuffle(DOG_KINDS.map((_, k) => k)).slice(0, rng.int(3, 4)) : [];
    return { kind, x: clamp(x, minX + 20, maxX - 20), dir: rng.chance(0.6) ? -1 : 1, dogs, minX, maxX };
  });
}

/** Peatones del fondo según la mezcla del barrio (rasgo `background`: promedio por cuadra de cada tipo). */
function npcsFor(seg: BlockSegment, traits: BarrioTraits, rng: RNG): NpcPlacement[] {
  const L = seg.endX - seg.startX;
  const minX = seg.startX - 10;
  const maxX = seg.endX + 16;
  const kinds: NpcKind[] = [];
  for (const kind of ['walker', 'lady', 'tourist'] as NpcKind[]) {
    const avg = Math.max(0, traits.background[kind]);
    const n = Math.floor(avg) + (rng.next() < avg - Math.floor(avg) ? 1 : 0);
    for (let k = 0; k < n; k++) kinds.push(kind);
  }
  rng.shuffle(kinds);
  return kinds.map((kind, i): NpcPlacement => {
    const x = Math.round(seg.startX + L * ((i + 0.5) / kinds.length) + rng.int(-160, 160));
    const dogs = kind === 'walker' ? rng.shuffle(DOG_KINDS.map((_, k) => k)).slice(0, rng.int(3, 4)) : [];
    return { kind, x: clamp(x, minX + 20, maxX - 20), dir: rng.chance(0.6) ? -1 : 1, dogs, minX, maxX };
  });
}

/**
 * Gente caminando por la zona jugable (rasgo `crowd`): más gente y más
 * distraída cuanto más difícil es la cuadra. Nunca arrancan sobre un sorete ni
 * en la salida del nivel.
 */
function placeCrowd(layout: LevelLayout, seg: BlockSegment, traits: BarrioTraits, rng: RNG): void {
  const t = CROWD_TUNING;
  const L = seg.endX - seg.startX;
  const d = (seg.difficulty[0] + seg.difficulty[1]) / 2;
  const density = traits.crowd * lerp(t.densityByDifficulty[0], t.densityByDifficulty[1], d);
  const spacing = t.spacingAtFull / Math.max(0.05, density);
  const count = Math.floor(L / spacing);
  const kinds = (['walker', 'lady', 'tourist'] as NpcKind[]).map((kind) => ({ item: kind, weight: 0.4 + Math.max(0, traits.background[kind]) }));
  for (let k = 0; k < count; k++) {
    const x = Math.round(seg.startX + (k + 0.5) * (L / count) + rng.range(-spacing * 0.3, spacing * 0.3));
    const kind = rng.weighted(kinds);
    let y = rng.range(t.yMin, t.yMax);
    for (let tries = 0; tries < 6 && nearObstacle(layout, x, y, 14); tries++) y = rng.range(t.yMin, t.yMax);
    const speed = lerp(t.speed[0], t.speed[1], rng.next()) * (kind === 'lady' ? 0.8 : 1);
    const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    const distracted = rng.chance(lerp(t.distracted[0], t.distracted[1], d));
    const clear = seg.index === 0 ? LEVEL_GEN.startClear + 80 : 40;
    if (x < seg.startX + clear || x > seg.endX - 40) continue;
    layout.crowd.push({ kind, x, y: Math.round(y), dir, speed: Math.round(speed), distracted, minX: seg.startX + 16, maxX: seg.endX - 16 });
  }
}

/** Lista de cruces (para pruebas y depuración). */
export function crossingsOf(layout: LevelLayout): CrossingSegment[] {
  return layout.crossings;
}
