import { describe, expect, it } from 'vitest';
import { CROSSING_TUNING, PLAYER_TUNING } from '../src/config/balance';
import { LAYOUT } from '../src/config/constants';
import { CrossingController, CROSSWALK_Y0, CROSSWALK_Y1, type CrossingGeometry, type CrossingPlayer } from '../src/world/crossing/CrossingController';
import { PHASE_ORDER, TrafficLight } from '../src/world/crossing/TrafficLight';

const DT = 1 / 60;
const TIMING = CROSSING_TUNING.timing;
const FP = PLAYER_TUNING.footprint;
/** Las simulaciones largas de tránsito pueden tardar varios segundos con la máquina cargada. */
const SLOW = 30000;

function geometry(dir: 1 | -1): CrossingGeometry {
  const x0 = 4000;
  const roadX0 = x0 + CROSSING_TUNING.roadInset;
  const roadX1 = x0 + CROSSING_TUNING.width - CROSSING_TUNING.roadInset;
  const laneW = (roadX1 - roadX0) / 2;
  return { x0, x1: x0 + CROSSING_TUNING.width, roadX0, roadX1, laneXs: [roadX0 + laneW / 2, roadX0 + laneW * 1.5], dir };
}

const idle = (x: number, y = 174): CrossingPlayer => ({ x, y, footprint: FP, canBeHit: true, active: true });

describe('Semáforo', () => {
  it('recorre las fases en orden con sus duraciones', () => {
    const light = new TrafficLight(TIMING);
    const seen: string[] = [light.phase];
    let t = 0;
    while (seen.length < PHASE_ORDER.length + 1) {
      const changed = light.update(0.05);
      t += 0.05;
      if (changed) seen.push(changed);
    }
    expect(seen).toEqual([...PHASE_ORDER, 'vehGreen']);
    expect(Math.abs(t - light.cycleLength)).toBeLessThan(0.11);
    // Ciclo breve para el ritmo arcade.
    expect(light.cycleLength).toBeLessThan(18);
  });

  it('peatones y autos nunca tienen verde a la vez', () => {
    const light = new TrafficLight(TIMING);
    for (let i = 0; i < 2000; i++) {
      light.update(0.05);
      expect(light.pedestriansMayCross && light.vehicle !== 'red').toBe(false);
    }
  });

  it('informa cuánto falta para poder cruzar', () => {
    const light = new TrafficLight(TIMING, 'vehGreen', 1);
    const expected = TIMING.vehGreen - 1 + TIMING.vehYellow + TIMING.allRed1;
    expect(light.secondsUntilWalk).toBeCloseTo(expected, 5);
    light.set('pedGreen', 2);
    expect(light.secondsUntilWalk).toBe(0);
    expect(light.secondsOfWalkLeft).toBeCloseTo(TIMING.pedGreen - 2 + TIMING.pedFlash, 5);
  });

  it('no da verde a los peatones si hay un auto sobre la senda', () => {
    const light = new TrafficLight(TIMING, 'allRed1', 0);
    let blocked = true;
    for (let i = 0; i < 100; i++) light.update(0.05, () => !blocked);
    expect(light.phase).toBe('allRed1');
    blocked = false;
    light.update(0.05, () => !blocked);
    expect(light.phase).toBe('pedGreen');
  });
});

describe('Tránsito sincronizado con el semáforo', () => {
  for (const dir of [1, -1] as const) {
    for (const density of [1, 1.8]) {
      it(`la senda queda libre en verde peatonal (sentido ${dir}, densidad ${density})`, () => {
        for (let seed = 1; seed <= 6; seed++) {
          const c = new CrossingController(geometry(dir), { timing: TIMING, density, seed: seed * 97 });
          c.prewarm(6);
          let passedThrough = 0;
          let maxStoppedQueue = 0;
          const crossedIds = new Set<number>();
          for (let t = 0; t < 40 * c.light.cycleLength; t += DT) {
            c.update(DT, idle(c.geo.x0 - 60));
            if (c.light.pedestriansMayCross) expect(c.traffic.occupiesCrosswalk()).toBe(false);
            for (const v of c.traffic.vehicles) {
              const r = c.traffic.bodyRect(v);
              if (r.y0 > CROSSWALK_Y1 || r.y1 < CROSSWALK_Y0) {
                if ((dir === 1 && r.y0 > CROSSWALK_Y1) || (dir === -1 && r.y1 < CROSSWALK_Y0)) crossedIds.add(v.id);
              }
            }
            maxStoppedQueue = Math.max(maxStoppedQueue, c.traffic.vehicles.filter((v) => v.speed < 1).length);
          }
          passedThrough = crossedIds.size;
          // Hay tránsito real: pasan autos en los verdes vehiculares y se forman colas en rojo.
          expect(passedThrough).toBeGreaterThan(20);
          expect(maxStoppedQueue).toBeGreaterThan(0);
        }
      }, SLOW);
    }
  }

  it('cruzar caminando apenas se pone el verde es siempre seguro', () => {
    for (const dir of [1, -1] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const c = new CrossingController(geometry(dir), { timing: TIMING, density: 1.8, seed: seed * 13 });
        c.prewarm(5);
        c.activate();
        // Espera en la ochava hasta el verde…
        let x = c.geo.roadX0 - 10;
        let guard = 0;
        while (!c.light.pedestriansMayCross && guard++ < 2000) c.update(DT, idle(x));
        // …y cruza caminando, en distintas profundidades de la senda.
        const y = LAYOUT.walkMinY + ((seed * 7) % (LAYOUT.walkMaxY - LAYOUT.walkMinY));
        let crossed = null;
        for (let i = 0; i < 600 && !crossed; i++) {
          x += PLAYER_TUNING.walkSpeed * DT;
          const ev = c.update(DT, idle(x, y));
          expect(ev.hit).toBeNull();
          crossed = ev.crossed;
        }
        expect(crossed).toEqual({ green: true, clean: true });
      }
    }
  }, SLOW);

  it('el verde alcanza para cruzar caminando con margen', () => {
    const g = geometry(1);
    const distance = g.roadX1 - g.roadX0 + FP.w;
    const seconds = distance / PLAYER_TUNING.walkSpeed;
    expect(seconds * 2).toBeLessThan(TIMING.pedGreen + TIMING.pedFlash);
  });
});

describe('Cruce: choques y premios', () => {
  it('un choque se cobra una sola vez y quita el bonus de "sin daños"', () => {
    const c = new CrossingController(geometry(1), { timing: TIMING, density: 2, seed: 5 });
    c.prewarm(4);
    c.light.set('vehGreen', 0);
    const lane = c.geo.laneXs[0];
    let hits = 0;
    let canBeHit = true;
    for (let i = 0; i < 400; i++) {
      const ev = c.update(DT, { x: lane, y: 170, footprint: FP, canBeHit, active: true });
      if (ev.hit) {
        hits++;
        canBeHit = false; // el juego lo pone en "susto" + invulnerable
      }
    }
    expect(hits).toBe(1);
    c.onRespawn();
    // Reaparece, espera el verde y cruza: se lleva el bonus del verde pero no el de "sin daños".
    let x = c.safeSpot(170).x;
    let guard = 0;
    while (!c.light.pedestriansMayCross && guard++ < 3000) c.update(DT, { x, y: 170, footprint: FP, canBeHit: true, active: true });
    let crossed = null;
    for (let i = 0; i < 600 && !crossed; i++) {
      x += PLAYER_TUNING.walkSpeed * DT;
      crossed = c.update(DT, { x, y: 170, footprint: FP, canBeHit: true, active: true }).crossed;
    }
    expect(crossed).toEqual({ green: true, clean: false });
  });

  it('cruzar en rojo no da el bonus del verde y el premio se entrega una sola vez', () => {
    const c = new CrossingController(geometry(-1), { timing: TIMING, density: 0.01, seed: 9 });
    c.light.set('vehGreen', 0);
    let x = c.geo.roadX0 - 10;
    const rewards = [];
    for (let i = 0; i < 400; i++) {
      x += PLAYER_TUNING.walkSpeed * DT;
      const ev = c.update(DT, { x, y: 150, footprint: FP, canBeHit: true, active: true });
      if (ev.crossed) rewards.push(ev.crossed);
      if (i === 5) expect(c.playerOnRoad || ev.enteredRoad || x < c.geo.roadX0).toBe(true);
    }
    // Vuelve a pisar la calle y a salir: no se repite el premio.
    for (let i = 0; i < 100; i++) c.update(DT, { x: c.geo.roadX1 - 20, y: 150, footprint: FP, canBeHit: true, active: true });
    for (let i = 0; i < 100; i++) {
      const ev = c.update(DT, { x: c.geo.roadX1 + 30, y: 150, footprint: FP, canBeHit: true, active: true });
      if (ev.crossed) rewards.push(ev.crossed);
    }
    expect(rewards).toEqual([{ green: false, clean: true }]);
  });

  it('el lugar de reaparición está antes del cordón y dentro de la vereda', () => {
    const c = new CrossingController(geometry(1), { timing: TIMING, density: 1, seed: 1 });
    for (const y of [0, 150, 400]) {
      const s = c.safeSpot(y);
      expect(s.x).toBeLessThan(c.geo.roadX0);
      expect(c.isOnRoad(s.x, FP)).toBe(false);
      expect(s.y).toBeGreaterThanOrEqual(LAYOUT.walkMinY);
      expect(s.y).toBeLessThanOrEqual(LAYOUT.walkMaxY);
    }
  });
});
