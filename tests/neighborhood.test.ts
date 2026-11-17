import { describe, expect, it } from 'vitest';
import { PLAYER_TUNING, WATER_TUNING } from '../src/config/balance';
import { LAYOUT } from '../src/config/constants';
import { BARRIOS } from '../src/data/campaign';
import { MISSIONS } from '../src/data/missions';
import { NPC_DEFS } from '../src/data/npcs';
import { variantOf } from '../src/entities/obstacles/ObstacleTypes';
import { footprintsOverlap } from '../src/systems/Collision';
import { buildLevel } from '../src/world/levelBuilder';
import { PROP_DEFS } from '../src/world/LevelLayout';
import { PathGrid } from '../src/world/PathGrid';
import { Sprinkler } from '../src/world/sprinkler';

const DT = 1 / 60;
const CYCLE = WATER_TUNING.idle + WATER_TUNING.telegraph + WATER_TUNING.spray;
const LEVELS = BARRIOS.filter((b) => b.levels.length).flatMap((b) => b.levels.map((_, i) => ({ barrioId: b.id, levelIndex: i })));
const ON = { vulnerable: true, immune: false };

/** Avanza la vecina hasta la fase pedida (con el jugador lejos). */
function advanceTo(s: Sprinkler, phase: string): void {
  for (let i = 0; i < 1000 && s.phase !== phase; i++) s.update(DT, { x: -9999, y: 170, z: 0 }, ON);
}

describe('Vecina que riega', () => {
  it('cicla quieta → aviso → chorro con las duraciones configuradas', () => {
    const s = new Sprinkler(500, LAYOUT.walkMinY + 1);
    const seen: string[] = [];
    let t = 0;
    while (t < CYCLE * 2) {
      const step = s.update(DT, { x: -9999, y: 170, z: 0 }, ON);
      if (step.changed) seen.push(`${step.phase}@${t.toFixed(1)}`);
      t += DT;
    }
    expect(seen.map((x) => x.split('@')[0])).toEqual(['telegraph', 'spray', 'idle', 'telegraph', 'spray', 'idle']);
    expect(Number(seen[0].split('@')[1])).toBeCloseTo(WATER_TUNING.idle, 0);
  });

  it('sólo moja durante el chorro: en reposo y durante el aviso se puede pasar', () => {
    const s = new Sprinkler(500, LAYOUT.walkMinY + 1);
    const inZone = { x: 500, y: LAYOUT.walkMinY + 6, z: 0 };
    for (let t = 0; t < WATER_TUNING.idle + WATER_TUNING.telegraph - 0.05; t += DT) expect(s.update(DT, inZone, ON).hit).toBe(false);
    let hit = false;
    for (let t = 0; t < 0.2; t += DT) hit = s.update(DT, inZone, ON).hit || hit;
    expect(hit).toBe(true);
  });

  it('el carril junto al cordón nunca se moja, llegue hasta donde llegue el chorro', () => {
    const s = new Sprinkler(500, LAYOUT.walkMinY + 1);
    const laneY = LAYOUT.walkMaxY - WATER_TUNING.minLane + 4;
    for (let t = 0; t < CYCLE * WATER_TUNING.reaches.length * 2; t += DT) {
      expect(s.update(DT, { x: 500, y: laneY, z: 0 }, ON).hit).toBe(false);
      expect(s.reachY).toBeLessThanOrEqual(LAYOUT.walkMaxY - WATER_TUNING.minLane);
    }
  });

  it('saltando por encima no te moja, y después de mojarte hay un respiro', () => {
    const s = new Sprinkler(500, LAYOUT.walkMinY + 1);
    advanceTo(s, 'spray');
    expect(s.update(DT, { x: 500, y: LAYOUT.walkMinY + 6, z: WATER_TUNING.hitZ + 2 }, ON).hit).toBe(false);
    const p = { x: 500, y: LAYOUT.walkMinY + 6, z: 0 };
    expect(s.update(DT, p, ON).hit).toBe(true);
    expect(s.update(DT, p, ON).hit).toBe(false);
  });

  it('a la vieja de la manguera no la moja (y lo avisa una sola vez)', () => {
    const s = new Sprinkler(500, LAYOUT.walkMinY + 1);
    advanceTo(s, 'spray');
    const p = { x: 500, y: LAYOUT.walkMinY + 6, z: 0 };
    const immune = { vulnerable: true, immune: true };
    const a = s.update(DT, p, immune);
    const b = s.update(DT, p, immune);
    expect(a.hit || b.hit).toBe(false);
    expect(a.splashedImmune).toBe(true);
    expect(b.splashedImmune).toBe(false);
  });

  it('cuenta como esquivada una sola vez si pasás con el chorro activo cerca y sin mojarte', () => {
    const s = new Sprinkler(500, LAYOUT.walkMinY + 1);
    advanceTo(s, 'telegraph');
    let dodged = 0;
    // Pasa por el carril seco mientras riega, y después vuelve y pasa de nuevo.
    for (let x = 420; x < 620; x += 2) if (s.update(DT, { x, y: LAYOUT.walkMaxY - 6, z: 0 }, ON).dodged) dodged++;
    for (let x = 620; x > 420; x -= 2) s.update(DT, { x, y: LAYOUT.walkMaxY - 6, z: 0 }, ON);
    for (let x = 420; x < 620; x += 2) if (s.update(DT, { x, y: LAYOUT.walkMaxY - 6, z: 0 }, ON).dodged) dodged++;
    expect(dodged).toBe(1);
  });

  it('si te mojó, o si pasaste mientras estaba quieta, no cuenta como esquivada', () => {
    const wet = new Sprinkler(500, LAYOUT.walkMinY + 1);
    advanceTo(wet, 'spray');
    let dodged = false;
    for (let x = 480; x < 560; x += 1) dodged = wet.update(DT, { x, y: LAYOUT.walkMinY + 6, z: 0 }, ON).dodged || dodged;
    expect(dodged).toBe(false);

    const calm = new Sprinkler(500, LAYOUT.walkMinY + 1);
    for (let x = 380; x < 620; x += 8) dodged = calm.update(DT, { x, y: 180, z: 0 }, ON).dodged || dodged;
    expect(dodged).toBe(false);
  });

  it('una vecina que quedó antes del checkpoint no cuenta', () => {
    const s = new Sprinkler(500, LAYOUT.walkMinY + 1, 0, 2000);
    expect(s.passed).toBe(true);
    advanceTo(s, 'spray');
    expect(s.update(DT, { x: 500, y: LAYOUT.walkMinY + 6, z: 0 }, ON).hit).toBe(false);
  });
});

describe('Vecinas y perro perdido en los niveles', () => {
  for (const ref of LEVELS) {
    const built = buildLevel(ref);
    const { layout, level } = built;

    it(`${level.id}: vecinas en sus cuadras, con el carril del cordón siempre transitable`, () => {
      expect(layout.waterLadies.map((l) => l.blockIndex)).toEqual(level.waterBlocks ?? []);
      for (const lady of layout.waterLadies) {
        const seg = layout.blocks[lady.blockIndex];
        expect(lady.x).toBeGreaterThan(seg.startX + 200);
        expect(lady.x).toBeLessThan(seg.endX - 100);
        // Se la ve: no queda detrás de un árbol, un farol o una parada.
        expect(layout.props.some((p) => p.kind !== 'bin' && p.kind !== 'binBags' && Math.abs(p.x - lady.x) < 30)).toBe(false);
        if (layout.mission) {
          expect(Math.abs(lady.x - layout.mission.giver.x)).toBeGreaterThan(80);
          expect(Math.abs(lady.x - layout.mission.target.x)).toBeGreaterThan(80);
        }
        // Camino posible con la franja más larga del chorro bloqueada (además de obstáculos y props).
        const s = new Sprinkler(lady.x, lady.y);
        // El chorro más largo llega justo hasta el carril seco del cordón.
        const maxReach = LAYOUT.walkMaxY - WATER_TUNING.minLane;
        const L = seg.endX - seg.startX;
        const grid = new PathGrid(L + 20, LAYOUT.walkMinY, LAYOUT.walkMaxY, 2, 0);
        for (const p of layout.props) if (p.x > seg.startX - 40 && p.x < seg.endX + 40) grid.block(p.x - seg.startX, p.y, PROP_DEFS[p.kind].solid);
        for (const o of layout.obstacles) if (o.x > seg.startX - 40 && o.x < seg.endX + 40) grid.block(o.x - seg.startX, o.y, variantOf(o.type, o.variant).footprint);
        const zone = s.zone();
        const h = maxReach - zone.y0;
        grid.block(lady.x - seg.startX, zone.y0 + h / 2, { shape: 'rect', w: zone.x1 - zone.x0 + 6, h });
        expect(grid.firstDeadColumn(grid.startReach(0, layout.startY), 1, grid.colOf(L)) < 0, `${level.id} vecina en ${lady.x}`).toBe(true);
      }
    });

    if (level.missionId === 'lost-dog') {
      it(`${level.id}: el perro perdido está a mitad de cuadra, alcanzable, antes de su dueña`, () => {
        const m = layout.mission!;
        expect(m.id).toBe('lost-dog');
        expect(m.giver.npc).toBe('duenaPerro');
        expect(m.items).toHaveLength(1);
        const dog = m.items[0];
        const seg = layout.blocks[m.blockIndex];
        expect(dog.frame).toBe('dog');
        expect(dog.x).toBeGreaterThan(seg.startX);
        expect(dog.x).toBeLessThan(m.target.x - 150);
        expect(m.target.x).toBeLessThan(seg.endX);
        const fp = PLAYER_TUNING.footprint;
        expect(layout.obstacles.some((o) => footprintsOverlap(dog.x, dog.y, fp, o.x, o.y, variantOf(o.type, o.variant).footprint))).toBe(false);
        // Nadie queda parado sobre un sorete.
        expect(layout.obstacles.some((o) => Math.abs(o.x - m.target.x) < 16 && o.y < m.target.y + 12)).toBe(false);
      });
    }
  }

  it('hay misiones de animales y vecinas suficientes para desbloquear al paseador y a la vieja', () => {
    const levels = BARRIOS.flatMap((b) => b.levels);
    expect(levels.filter((l) => l.missionId === 'lost-dog').length).toBeGreaterThanOrEqual(3);
    expect(levels.reduce((n, l) => n + (l.waterBlocks?.length ?? 0), 0)).toBeGreaterThanOrEqual(6);
  });

  it('cada misión implementada tiene tipo y un NPC listo que la da', () => {
    for (const m of Object.values(MISSIONS)) {
      if (!m.implemented) continue;
      expect(['trash', 'animal']).toContain(m.kind);
      expect(NPC_DEFS[m.giver]?.ready, m.id).toBe(true);
      const giver = NPC_DEFS[m.giver].behaviors.find((b) => b.kind === 'missionGiver');
      expect(giver && giver.kind === 'missionGiver' && giver.missionId).toBe(m.id);
    }
  });
});
