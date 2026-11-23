import { describe, expect, it } from 'vitest';
import { CROWD_TUNING, PLAYER_TUNING } from '../src/config/balance';
import { footprintsOverlap, type Footprint } from '../src/systems/Collision';
import { Pedestrian, type CrowdBlocker, type CrowdPlayer } from '../src/world/crowd';
import type { CrowdPlacement } from '../src/world/LevelLayout';

const DT = 1 / 60;
const poopFp: Footprint = { shape: 'ellipse', w: 12, h: 6 };

function person(over: Partial<CrowdPlacement> = {}): Pedestrian {
  return new Pedestrian({ kind: 'lady', x: 100, y: 170, dir: 1, speed: 24, distracted: false, minX: 20, maxX: 2000, ...over });
}

/** Simula `seconds` segundos y cuenta los choques; falla si alguna vez pisa un bloqueo. */
function walk(p: Pedestrian, seconds: number, blockers: CrowdBlocker[] = [], player: CrowdPlayer | null = null, vulnerable = true): number {
  let bumps = 0;
  for (let t = 0; t < seconds; t += DT) {
    const step = p.update(DT, blockers, player, vulnerable);
    if (step.bumped) bumps++;
    for (const b of blockers) expect(footprintsOverlap(p.x, p.y, p.footprint, b.x, b.y, b.fp)).toBe(false);
  }
  return bumps;
}

describe('Gente caminando por la vereda', () => {
  it('camina derecho a su velocidad si no hay nada adelante', () => {
    const p = person();
    walk(p, 2);
    expect(p.x).toBeCloseTo(100 + 24 * 2, 0);
    expect(p.y).toBe(170);
  });

  it('da la vuelta al llegar a la esquina', () => {
    const p = person({ x: 1990 });
    walk(p, 1.5);
    expect(p.dir).toBe(-1);
    expect(p.x).toBeLessThan(2001);
  });

  it('esquiva un sorete que tiene en su camino y sigue de largo', () => {
    const p = person();
    const blockers = [{ x: 160, y: 170, fp: poopFp }];
    walk(p, 6, blockers);
    expect(p.x).toBeGreaterThan(200);
  });

  it('pasa entre varios soretes sin pisar ninguno', () => {
    const p = person({ y: 160 });
    const blockers = [150, 190, 230, 270].map((x, i) => ({ x, y: 156 + (i % 2) * 8, fp: poopFp }));
    walk(p, 14, blockers);
    expect(p.x).toBeGreaterThan(300);
  });

  it('no se corre de costado atravesando un sorete que tiene justo al lado', () => {
    const p = person();
    // Uno adelante en su camino y otro pegado, del lado hacia el que se correría primero.
    const blockers = [
      { x: 150, y: 170, fp: poopFp },
      { x: 105, y: 177, fp: poopFp },
    ];
    walk(p, 6, blockers);
    expect(p.x).toBeGreaterThan(190);
  });

  it('si arranca arriba de un sorete, se baja enseguida', () => {
    const p = person();
    const poop = { x: 102, y: 171, fp: poopFp };
    for (let t = 0; t < 0.6; t += DT) p.update(DT, [poop], null, false);
    expect(footprintsOverlap(p.x, p.y, p.footprint, poop.x, poop.y, poop.fp)).toBe(false);
  });

  it('dos personas que vienen de frente se corren para lados distintos y se cruzan sin chocarse', () => {
    const a = person({ x: 100, dir: 1 });
    const b = person({ x: 220, dir: -1, kind: 'tourist' });
    for (let t = 0; t < 9; t += DT) {
      a.update(DT, [{ x: b.x, y: b.y, fp: b.footprint }], null, false);
      b.update(DT, [{ x: a.x, y: a.y, fp: a.footprint }], null, false);
      expect(footprintsOverlap(a.x, a.y, a.footprint, b.x, b.y, b.footprint)).toBe(false);
    }
    expect(a.x).toBeGreaterThan(220);
    expect(b.x).toBeLessThan(100);
    expect(Math.sign(a.y - 170)).toBe(1);
    expect(Math.sign(b.y - 170)).toBe(-1);
  });

  it('si va atenta, se corre para no chocar al pibe parado en su camino', () => {
    const p = person();
    const player: CrowdPlayer = { x: 160, y: 170, footprint: PLAYER_TUNING.footprint };
    expect(walk(p, 6, [], player)).toBe(0);
    expect(p.x).toBeGreaterThan(200);
  });

  it('si va con el celular, lo choca una vez, se frena y después lo esquiva', () => {
    const p = person({ distracted: true });
    const player: CrowdPlayer = { x: 160, y: 170, footprint: PLAYER_TUNING.footprint };
    let first = -1;
    let bumps = 0;
    for (let t = 0; t < 8; t += DT) {
      if (p.update(DT, [], player, true).bumped) {
        bumps++;
        if (first < 0) first = t;
      }
    }
    expect(bumps).toBe(1);
    expect(first).toBeGreaterThan(1.5);
    expect(p.x).toBeGreaterThan(190);
  });

  it('si el pibe no puede ser chocado (por ejemplo, con un poder), no hay choque', () => {
    const p = person({ distracted: true });
    const player: CrowdPlayer = { x: 160, y: 170, footprint: PLAYER_TUNING.footprint };
    expect(walk(p, 6, [], player, false)).toBe(0);
  });

  it('el pibe que se le lleva puesto por detrás también cuenta como choque (una vez por cooldown)', () => {
    const p = person({ speed: 14 });
    let bumps = 0;
    // El pibe corre más rápido y la alcanza por atrás.
    for (let t = 0, px = 40; t < CROWD_TUNING.bumpCooldown * 0.9; t += DT, px += 124 * DT) {
      if (p.update(DT, [], { x: px, y: 170, footprint: PLAYER_TUNING.footprint }, true).bumped) bumps++;
    }
    expect(bumps).toBe(1);
  });

  it('si no hay por dónde pasar, espera un rato y pega la vuelta', () => {
    const p = person();
    const wall: CrowdBlocker[] = [];
    for (let y = CROWD_TUNING.yMin - 6; y <= CROWD_TUNING.yMax + 6; y += 5) wall.push({ x: 140, y, fp: poopFp });
    walk(p, 4, wall);
    expect(p.dir).toBe(-1);
  });
});
