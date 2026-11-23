import { describe, expect, it } from 'vitest';
import { CROWD_TUNING, LEVEL_GEN } from '../src/config/balance';
import { DEFAULT_TRAITS, traitsWith, type BarrioTraits } from '../src/data/barrioTraits';
import { getBarrio } from '../src/data/campaign';
import { ENVIRONMENTS } from '../src/data/environments';
import { variantOf } from '../src/entities/obstacles/ObstacleTypes';
import { footprintsOverlap } from '../src/systems/Collision';
import { generateLevelLayout, type BlockSpec } from '../src/world/LevelGenerator';
import { blockSpecsFor, buildLevel, traitsFor } from '../src/world/levelBuilder';
import type { LevelLayout } from '../src/world/LevelLayout';
import { THEMES } from '../src/world/themes';

const street = { street: 'PRUEBA', from: 'A', to: 'B' };
const blocks = (d: [number, number], n = 3, length = 4000): BlockSpec[] => Array.from({ length: n }, () => ({ street, length, difficulty: d }));

function layoutWith(traits: Partial<BarrioTraits> | undefined, seed: number, d: [number, number] = [0.3, 0.7]): LevelLayout {
  return generateLevelLayout({
    theme: THEMES['san-telmo'],
    env: ENVIRONMENTS.day,
    seed,
    blocks: blocks(d),
    traits: traits ? traitsWith(traits) : undefined,
  });
}

const LUGANO = getBarrio('villa-lugano')!.traits;
const CENTRO = getBarrio('monserrat')!.traits;
const SEEDS = [11, 22, 33, 44, 55];

describe('Rasgos de barrio', () => {
  it('con los rasgos por defecto el nivel es el mismo que sin rasgos', () => {
    const level = getBarrio('san-telmo')!.levels[0];
    const plain = generateLevelLayout({ theme: THEMES['san-telmo'], env: ENVIRONMENTS.day, seed: 1234, blocks: blockSpecsFor(level) });
    const withDefaults = generateLevelLayout({ theme: THEMES['san-telmo'], env: ENVIRONMENTS.day, seed: 1234, blocks: blockSpecsFor(level), traits: DEFAULT_TRAITS });
    expect(JSON.stringify(withDefaults)).toBe(JSON.stringify(plain));
    expect(plain.crowd).toHaveLength(0);
  });

  it('San Telmo no tiene rasgos propios y Monserrat (el centro) sí', () => {
    expect(traitsFor(getBarrio('san-telmo')!)).toEqual(DEFAULT_TRAITS);
    expect(traitsFor(getBarrio('monserrat')!).crowd).toBeGreaterThan(0.5);
  });

  it('?rasgos= permite armar un nivel con los rasgos de otro barrio', () => {
    expect(traitsFor(getBarrio('san-telmo')!, 'villa-lugano').trees).toBe(0);
    // Un barrio que no existe no rompe nada: quedan los del propio barrio.
    expect(traitsFor(getBarrio('san-telmo')!, 'no-existe')).toEqual(DEFAULT_TRAITS);
    const built = buildLevel({ barrioId: 'san-telmo', levelIndex: 0 }, { traitsFrom: 'villa-lugano' });
    expect(built.layout.props.some((p) => p.kind === 'tree')).toBe(false);
  });

  describe('Lugano: sin árboles y con la vereda rota', () => {
    it('no hay ni un árbol, pero siguen los faroles y los cestos', () => {
      for (const seed of SEEDS) {
        const l = layoutWith(LUGANO, seed);
        expect(l.props.filter((p) => p.kind === 'tree')).toHaveLength(0);
        expect(l.props.some((p) => p.kind === 'lamp' || p.kind === 'busStop')).toBe(true);
      }
    });

    it('hay más baldosas flojas que en un barrio normal', () => {
      const count = (t: Partial<BarrioTraits> | undefined) =>
        SEEDS.reduce((n, seed) => n + layoutWith(t, seed).obstacles.filter((o) => o.type === 'looseTile').length, 0);
      expect(count(LUGANO)).toBeGreaterThan(count(undefined) * 1.8);
    });

    it('la vereda tiene baldosas que faltan, grietas largas y cascotes (y uno normal, no)', () => {
      const broken = (l: LevelLayout) => l.decals.filter((d) => d.frame === 'hole' || d.frame === 'bigCrack' || d.frame === 'rubble').length;
      const l = layoutWith(LUGANO, 7);
      expect(broken(l)).toBeGreaterThan(80);
      expect(broken(layoutWith(undefined, 7))).toBe(0);
      // Las marcas no tapan los obstáculos.
      for (const d of l.decals.filter((dc) => dc.frame === 'hole')) {
        expect(l.obstacles.some((o) => Math.abs(o.x - d.x) < 12 && Math.abs(o.y - d.y) < 7)).toBe(false);
      }
    });

    it('no hay turistas en el fondo', () => {
      const l = layoutWith(LUGANO, 9);
      expect(l.npcs.some((n) => n.kind === 'tourist')).toBe(false);
    });
  });

  describe('El centro: la vereda llena de gente', () => {
    it('hay gente caminando en cada cuadra, dentro de la zona jugable y lejos de la salida', () => {
      const l = layoutWith(CENTRO, 5);
      expect(l.crowd.length).toBeGreaterThan(30);
      for (const p of l.crowd) {
        const seg = l.blocks.find((b) => p.x >= b.startX && p.x <= b.endX)!;
        expect(seg).toBeDefined();
        expect(p.minX).toBeGreaterThanOrEqual(seg.startX);
        expect(p.maxX).toBeLessThanOrEqual(seg.endX);
        expect(p.y).toBeGreaterThanOrEqual(CROWD_TUNING.yMin);
        expect(p.y).toBeLessThanOrEqual(CROWD_TUNING.yMax);
        expect(p.speed).toBeGreaterThan(0);
        if (seg.index === 0) expect(p.x).toBeGreaterThan(LEVEL_GEN.startClear);
      }
    });

    it('nadie arranca parado arriba de un sorete', () => {
      for (const seed of SEEDS) {
        const l = layoutWith(CENTRO, seed);
        const onTop = l.crowd.filter((p) => l.obstacles.some((o) => footprintsOverlap(p.x, p.y, CROWD_TUNING.footprint, o.x, o.y, variantOf(o.type, o.variant).footprint)));
        // Se prueba varias veces una profundidad libre; casi nunca queda alguien encima (y al caminar se corre).
        expect(onTop.length).toBeLessThanOrEqual(1);
      }
    });

    it('cuanto más difícil la cuadra, más gente y más distraída con el celular', () => {
      const easy = layoutWith(CENTRO, 3, [0, 0.05]);
      const hard = layoutWith(CENTRO, 3, [0.95, 1]);
      expect(hard.crowd.length).toBeGreaterThan(easy.crowd.length * 1.6);
      const share = (l: LevelLayout) => l.crowd.filter((p) => p.distracted).length / l.crowd.length;
      expect(share(hard)).toBeGreaterThan(share(easy));
    });

    it('hay más palomas que en un barrio normal (la Plaza de Mayo)', () => {
      const total = (t: Partial<BarrioTraits> | undefined) => SEEDS.reduce((n, seed) => n + layoutWith(t, seed).pigeons.length, 0);
      expect(total(CENTRO)).toBeGreaterThan(total(undefined) * 1.4);
      expect(total({ pigeons: 0.3 })).toBeLessThan(total(undefined) * 0.6);
    });
  });

  it('Palermo: muchos paseadores de perros en el fondo', () => {
    const l = layoutWith(getBarrio('palermo')!.traits, 4);
    const walkers = l.npcs.filter((n) => n.kind === 'walker');
    expect(walkers.length).toBeGreaterThanOrEqual(l.blocks.length * 2);
    expect(walkers.every((w) => w.dogs.length >= 3)).toBe(true);
  });
});
