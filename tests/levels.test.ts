import { describe, expect, it } from 'vitest';
import { CAMPAIGN_TUNING, LEVEL_GEN } from '../src/config/balance';
import { LAYOUT } from '../src/config/constants';
import { BARRIOS } from '../src/data/campaign';
import { ENVIRONMENTS } from '../src/data/environments';
import { MISSIONS } from '../src/data/missions';
import { OBSTACLE_TYPES, variantOf } from '../src/entities/obstacles/ObstacleTypes';
import { buildLevel, estimatedDuration, starsFor } from '../src/world/levelBuilder';
import { PROP_DEFS, type LevelLayout } from '../src/world/LevelLayout';
import { PathGrid } from '../src/world/PathGrid';
import { footprintsOverlap } from '../src/systems/Collision';
import { PLAYER_TUNING } from '../src/config/balance';

const PLAYABLE = BARRIOS.filter((b) => b.levels.length > 0).flatMap((b) => b.levels.map((_, i) => ({ barrioId: b.id, levelIndex: i })));

/** Validador independiente (grilla de 2 px): existe un camino sin pisar nada en cada cuadra. */
function blockHasPath(layout: LayoutLike, startX: number, endX: number): boolean {
  const L = endX - startX;
  const grid = new PathGrid(L + 20, LAYOUT.walkMinY, LAYOUT.walkMaxY, 2, 0);
  for (const p of layout.props) if (p.x > startX - 40 && p.x < endX + 40) grid.block(p.x - startX, p.y, PROP_DEFS[p.kind].solid);
  for (const o of layout.obstacles) if (o.x > startX - 40 && o.x < endX + 40) grid.block(o.x - startX, o.y, variantOf(o.type, o.variant).footprint);
  return grid.firstDeadColumn(grid.startReach(0, layout.startY), 1, grid.colOf(L)) < 0;
}
type LayoutLike = Pick<LevelLayout, 'props' | 'obstacles' | 'startY'>;

describe('Niveles generados', () => {
  for (const ref of PLAYABLE) {
    describe(`${ref.barrioId} · nivel ${ref.levelIndex + 1}`, () => {
      const built = buildLevel(ref);
      const layout = built.layout;

      it('tiene 5 cuadras y 4 cruces, en orden y sin superponerse', () => {
        expect(layout.blocks).toHaveLength(CAMPAIGN_TUNING.blocksPerLevel);
        expect(layout.crossings).toHaveLength(CAMPAIGN_TUNING.blocksPerLevel - 1);
        layout.crossings.forEach((c, i) => {
          expect(c.x0).toBeGreaterThan(layout.blocks[i].endX);
          expect(c.x1).toBeLessThanOrEqual(layout.blocks[i + 1].startX);
          expect(c.roadX0).toBeGreaterThan(c.x0);
          expect(c.roadX1).toBeLessThan(c.x1);
          expect(c.street).toBe(layout.blocks[i].street.to);
        });
        expect(layout.length).toBe(layout.blocks[4].endX);
      });

      it('dura entre 3 y 5 minutos en una partida normal', () => {
        const seconds = estimatedDuration(layout);
        expect(seconds).toBeGreaterThan(180);
        expect(seconds).toBeLessThan(300);
      });

      it('siempre existe un camino posible en cada cuadra (validador independiente)', () => {
        for (const b of layout.blocks) expect(blockHasPath(layout, b.startX, b.endX), `cuadra ${b.index + 1}`).toBe(true);
      });

      it('no hay obstáculos en las calzadas de los cruces ni en las esquinas', () => {
        for (const c of layout.crossings) {
          expect(layout.obstacles.some((o) => o.x > c.x0 - 20 && o.x < c.x1 + 20)).toBe(false);
        }
        for (const b of layout.blocks) {
          expect(layout.obstacles.some((o) => o.x > b.startX && o.x < b.startX + LEVEL_GEN.startClear - 40)).toBe(false);
        }
      });

      it('las monedas y los objetos de la misión se pueden juntar sin pisar nada', () => {
        const fp = PLAYER_TUNING.footprint;
        const safe = (x: number, y: number) =>
          !layout.obstacles.some((o) => footprintsOverlap(x, y, fp, o.x, o.y, variantOf(o.type, o.variant).footprint));
        expect(layout.coins.length).toBeGreaterThan(20);
        for (const c of layout.coins) expect(safe(c.x, c.y), `moneda en ${c.x}`).toBe(true);
        if (built.level.missionBlock !== undefined) {
          expect(layout.mission).not.toBeNull();
          expect(layout.mission!.id).toBe(built.level.missionId ?? 'trash-to-bin');
          expect(layout.mission!.items.length).toBe(MISSIONS[layout.mission!.id].itemsRequired);
          for (const it of layout.mission!.items) expect(safe(it.x, it.y)).toBe(true);
        }
      });

      it('la misma semilla genera siempre el mismo nivel', () => {
        const again = buildLevel(ref).layout;
        expect(again.obstacles).toEqual(layout.obstacles);
        expect(again.coins).toEqual(layout.coins);
      });

      it('las estrellas exigen más que completar y completar da al menos una', () => {
        expect(built.stars.two).toBeLessThan(built.stars.three);
        expect(starsFor(0, built.stars)).toBe(1);
        expect(starsFor(built.stars.three, built.stars)).toBe(3);
      });
    });
  }

  it('el otoño esconde más soretes entre las hojas que el día', () => {
    const count = (env: string) => {
      const l = buildLevel({ barrioId: 'san-telmo', levelIndex: 0 }, { environment: env }).layout;
      return l.obstacles.filter((o) => o.type === 'camo').length;
    };
    expect(ENVIRONMENTS.autumn.leafPileWeight).toBeGreaterThan(1);
    expect(count('autumn')).toBeGreaterThan(count('day'));
  });

  it('los tipos de obstáculo siguen siendo los cuatro de la v0.1', () => {
    expect(Object.keys(OBSTACLE_TYPES).sort()).toEqual(['camo', 'giant', 'looseTile', 'poop']);
  });
});
