import { describe, expect, it } from 'vitest';
import type { AbilityFx, AbilityHost, AbilityWorld } from '../src/abilities/Ability';
import { BroomAbility, combineMods, createAbility, DashAbility, DoubleJumpAbility, HoseAbility, SniffAbility, SprintAbility, TurboAbility, WhistleAbility } from '../src/abilities/abilities';
import { PassiveController } from '../src/abilities/passives';
import { ABILITY_TUNING, CROSSING_TUNING, PASSIVE_TUNING, PLAYER_TUNING } from '../src/config/balance';
import { LAYOUT } from '../src/config/constants';
import { CHARACTERS, getCharacter, isPlayable, type CharacterDef } from '../src/data/characters';
import { OBSTACLE_TYPES } from '../src/entities/obstacles/ObstacleTypes';
import { PlayerMotor, type BlockedFn, type MotorControls } from '../src/entities/PlayerMotor';
import { JumpBuffer } from '../src/input/KeyboardInputState';
import { CrossingController, type CrossingGeometry } from '../src/world/crossing/CrossingController';

const DT = 1 / 60;
const BOUNDS = { minX: -1e6, maxX: 1e6, minY: LAYOUT.walkMinY, maxY: LAYOUT.walkMaxY };
const FREE: BlockedFn = () => false;
const PLAYABLE = CHARACTERS.filter(isPlayable);
const POOP = OBSTACLE_TYPES.poop;

/** Mundo de prueba: registra lo que piden las habilidades. */
function fakeWorld(over: Partial<AbilityWorld> = {}) {
  const log = { reveal: [] as number[][], leaves: [] as number[][], trash: [] as number[][], marks: [] as number[][], puddles: 0 };
  const world: AbilityWorld = {
    revealHidden: (x0, x1, y0, y1) => (log.reveal.push([x0, x1, y0, y1]), 1),
    clearLeaves: (x0, x1, y0, y1) => (log.leaves.push([x0, x1, y0, y1]), 0),
    collectTrash: (x0, x1, y0, y1) => (log.trash.push([x0, x1, y0, y1]), 0),
    markHazards: (x0, x1, s) => (log.marks.push([x0, x1, s]), 2),
    addPuddle: () => void log.puddles++,
    crossingAhead: () => null,
    ...over,
  };
  return { world, log };
}

const quietFx: AbilityFx = {
  sfx: () => {},
  say: () => {},
  dashTrail: () => {},
  airPuff: () => {},
  speedLines: () => {},
  sweep: () => {},
  water: () => {},
  whistle: () => {},
  sniff: () => {},
};

function makeHost(opts: { motor?: PlayerMotor; moveX?: number; moveY?: number; blocked?: BlockedFn; canAct?: boolean; world?: AbilityWorld } = {}) {
  const motor = opts.motor ?? new PlayerMotor(1000, 174);
  const fw = fakeWorld();
  const host: AbilityHost & { canAct: boolean } = {
    motor,
    input: { moveX: opts.moveX ?? 0, moveY: opts.moveY ?? 0 },
    isBlocked: opts.blocked ?? FREE,
    bounds: () => BOUNDS,
    canAct: opts.canAct ?? true,
    world: opts.world ?? fw.world,
    fx: quietFx,
  };
  return { host, log: fw.log, motor };
}

function run(ability: { update(dt: number, h: AbilityHost): void }, host: AbilityHost, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) ability.update(DT, host);
}

class FakeControls implements MotorControls {
  moveX = 0;
  moveY = 0;
  readonly buffer = new JumpBuffer(PLAYER_TUNING.jumpBufferTime);
  press(): void {
    this.buffer.request();
  }
  consumeJump(): boolean {
    return this.buffer.consume();
  }
}

function step(m: PlayerMotor, c: FakeControls | null): void {
  c?.buffer.update(DT);
  m.stepMovement(DT, c, BOUNDS, FREE);
  m.stepHeight(DT);
  m.tickTimers(DT);
}

describe('Sistema de habilidades', () => {
  it('cada personaje jugable tiene su habilidad con la recarga configurada', () => {
    expect(PLAYABLE.length).toBe(8);
    for (const def of PLAYABLE) {
      const a = createAbility(def.ability);
      expect(a, def.id).not.toBeNull();
      expect(a!.cooldown).toBe(ABILITY_TUNING[def.ability!].cooldown);
      expect(a!.ready).toBe(true);
    }
    // El vecino desconfiado queda preparado pero no se puede elegir (sin habilidad inventada).
    const vecino = getCharacter('player_neighbor');
    expect(vecino.ability).toBeNull();
    expect(isPlayable(vecino)).toBe(false);
  });

  it('no se reactiva mientras dura ni durante la recarga, y vuelve a estar lista', () => {
    const { host } = makeHost();
    const sprint = new SprintAbility();
    expect(sprint.tryActivate(host)).toBe('ok');
    expect(sprint.tryActivate(host)).toBe('active');
    run(sprint, host, ABILITY_TUNING.sprint.duration + 0.05);
    expect(sprint.phase).toBe('cooldown');
    expect(sprint.tryActivate(host)).toBe('cooldown');
    expect(sprint.charge).toBeLessThan(0.05);
    run(sprint, host, ABILITY_TUNING.sprint.cooldown / 2);
    expect(sprint.charge).toBeGreaterThan(0.45);
    expect(sprint.charge).toBeLessThan(0.55);
    run(sprint, host, ABILITY_TUNING.sprint.cooldown / 2 + 0.05);
    expect(sprint.ready).toBe(true);
    expect(sprint.tryActivate(host)).toBe('ok');
  });

  it('la recarga sólo avanza con tiempo de juego (sin update no pasa el tiempo)', () => {
    const { host } = makeHost();
    const turbo = new TurboAbility();
    turbo.tryActivate(host);
    run(turbo, host, ABILITY_TUNING.turbo.duration + 0.05);
    const left = turbo.cooldownLeft;
    // Pausa: no se llama a update.
    expect(turbo.cooldownLeft).toBe(left);
    expect(turbo.tryActivate(host)).toBe('cooldown');
  });

  it('sin control del personaje (tropezando) no se activa ni gasta la recarga', () => {
    const { host } = makeHost({ canAct: false });
    const sprint = new SprintAbility();
    expect(sprint.tryActivate(host)).toBe('busy');
    expect(sprint.ready).toBe(true);
  });

  it('reset limpia efectos y deja todo listo; interrupt corta y pasa a recarga', () => {
    const { host } = makeHost();
    const turbo = new TurboAbility();
    turbo.tryActivate(host);
    expect(turbo.mods().speed).toBeGreaterThan(1);
    turbo.reset(host);
    expect(turbo.ready).toBe(true);
    expect(turbo.mods()).toEqual({});

    turbo.tryActivate(host);
    turbo.interrupt(host);
    expect(turbo.phase).toBe('cooldown');
    expect(turbo.mods().speed).toBeUndefined();
  });

  it('combina modificadores: multiplican y "quieto" gana', () => {
    const m = combineMods({ speed: 1.5, decel: 0.5 }, { speed: 0.5 }, { frozen: true });
    expect(m.speed).toBeCloseTo(0.75);
    expect(m.decel).toBeCloseTo(0.5);
    expect(m.frozen).toBe(true);
    expect(combineMods()).toEqual({ speed: 1, accel: 1, decel: 1, depth: 1, frozen: false });
  });
});

describe('EL PIBE: esquive rápido', () => {
  it('se mueve en la dirección pedida, con protección breve contra soretes', () => {
    const { host, motor } = makeHost({ moveX: 0, moveY: 1 });
    const dash = new DashAbility();
    const y0 = motor.y;
    expect(dash.tryActivate(host)).toBe('ok');
    expect(motor.y - y0).toBeGreaterThan(20);
    expect(motor.y).toBeLessThanOrEqual(LAYOUT.walkMaxY);
    expect(dash.poopShield()).toBe(true);
    run(dash, host, ABILITY_TUNING.dash.protection + 0.05);
    expect(dash.poopShield()).toBe(false);
  });

  it('sin dirección usa la última; no atraviesa sólidos ni sale de la vereda', () => {
    const motor = new PlayerMotor(1000, 174);
    motor.lastDir.x = -1;
    motor.lastDir.y = 0;
    const wallAt = 990;
    const { host } = makeHost({ motor, blocked: (x) => x <= wallAt });
    const dash = new DashAbility();
    expect(dash.tryActivate(host)).toBe('ok');
    expect(motor.x).toBeGreaterThan(wallAt);
    expect(motor.x).toBeLessThan(1000);

    // Contra la pared: no se mueve y no gasta la recarga.
    const stuck = new PlayerMotor(991, 174);
    stuck.lastDir.x = -1;
    const h2 = makeHost({ motor: stuck, blocked: (x) => x <= wallAt }).host;
    const d2 = new DashAbility();
    expect(d2.tryActivate(h2)).toBe('unavailable');
    expect(d2.ready).toBe(true);

    // Borde de la vereda.
    const edge = new PlayerMotor(1000, LAYOUT.walkMinY + 2);
    const h3 = makeHost({ motor: edge, moveY: -1 }).host;
    new DashAbility().tryActivate(h3);
    expect(edge.y).toBeGreaterThanOrEqual(LAYOUT.walkMinY);
  });
});

describe('LA NENA DEL BARRIO: salto doble', () => {
  it('sólo en el aire, una vez, y después recarga (no hay saltos infinitos)', () => {
    const motor = new PlayerMotor(1000, 174, getCharacter('player_girl').stats);
    const { host } = makeHost({ motor });
    const dj = new DoubleJumpAbility();
    expect(dj.onAirJump(host)).toBe(false); // en el piso no
    motor.jump();
    for (let i = 0; i < 10; i++) motor.stepHeight(DT);
    expect(motor.onGround).toBe(false);
    expect(dj.onAirJump(host)).toBe(true);
    expect(motor.vz).toBeCloseTo(motor.stats.jumpVelocity * ABILITY_TUNING.doubleJump.velocityFactor);
    expect(dj.onAirJump(host)).toBe(false);
    expect(dj.phase).toBe('cooldown');
  });

  it('el salto doble llega más alto que el simple, sin mezclar altura con profundidad', () => {
    const peak = (double: boolean) => {
      const motor = new PlayerMotor(1000, 174, getCharacter('player_girl').stats);
      const { host } = makeHost({ motor });
      const dj = new DoubleJumpAbility();
      motor.jump();
      let max = 0;
      for (let i = 0; i < 240; i++) {
        motor.stepHeight(DT);
        if (double && i === 18) dj.onAirJump(host);
        max = Math.max(max, motor.z);
      }
      expect(motor.y).toBe(174);
      return max;
    };
    expect(peak(true)).toBeGreaterThan(peak(false) * 1.3);
  });
});

describe('Turbo, sprint, escobazo, manguera, olfato y silbatazo', () => {
  it('turbo: más velocidad y frenado largo durante y un rato después', () => {
    const { host } = makeHost();
    const turbo = new TurboAbility();
    turbo.tryActivate(host);
    const t = ABILITY_TUNING.turbo;
    expect(turbo.mods()).toEqual({ speed: t.speed, accel: t.accel, decel: t.decel });
    run(turbo, host, t.duration + 0.05);
    expect(turbo.mods()).toEqual({ decel: t.decel });
    run(turbo, host, t.brakeAfter + 0.05);
    expect(turbo.mods()).toEqual({});
  });

  it('turbo y sprint suben la velocidad máxima de verdad (y sin atravesar nada)', () => {
    const top = (def: CharacterDef, mods: object) => {
      const motor = new PlayerMotor(1000, 174, def.stats);
      motor.mods = combineMods(mods);
      const c = new FakeControls();
      c.moveX = 1;
      for (let t = 0; t < 3; t += DT) step(motor, c);
      return motor.vx;
    };
    const skater = getCharacter('player_skater');
    const runner = getCharacter('player_runner');
    expect(top(skater, new TurboAbility().mods())).toBeCloseTo(skater.stats.runSpeed, 0);
    const turbo = new TurboAbility();
    turbo.tryActivate(makeHost().host);
    expect(top(skater, turbo.mods())).toBeCloseTo(skater.stats.runSpeed * ABILITY_TUNING.turbo.speed, 0);
    const sprint = new SprintAbility();
    sprint.tryActivate(makeHost().host);
    expect(top(runner, sprint.mods())).toBeCloseTo(runner.stats.runSpeed * ABILITY_TUNING.sprint.speed, 0);
  });

  it('sprint: no junta monedas ni objetos mientras dura', () => {
    const { host } = makeHost();
    const sprint = new SprintAbility();
    expect(sprint.blocksPickups()).toBe(false);
    sprint.tryActivate(host);
    expect(sprint.blocksPickups()).toBe(true);
    run(sprint, host, ABILITY_TUNING.sprint.duration + 0.05);
    expect(sprint.blocksPickups()).toBe(false);
  });

  it('escobazo: barre adelante (soretes escondidos, hojas y basura) y se queda quieto un instante', () => {
    const motor = new PlayerMotor(1000, 174);
    motor.facing = -1;
    motor.vx = -80;
    const { host, log } = makeHost({ motor });
    const broom = new BroomAbility();
    expect(broom.tryActivate(host)).toBe('ok');
    const [x0, x1] = log.reveal[0];
    expect(x1).toBeLessThanOrEqual(1006);
    expect(x0).toBeLessThan(1000 - ABILITY_TUNING.broom.reach + 1);
    expect(log.leaves).toHaveLength(1);
    expect(log.trash).toHaveLength(1);
    expect(motor.vx).toBe(0);
    expect(broom.mods().frozen).toBe(true);
    run(broom, host, ABILITY_TUNING.broom.stop + 0.05);
    expect(broom.mods()).toEqual({});
  });

  it('manguera: lava hacia adelante todo el tiempo, deja charcos y camina más lento', () => {
    const { host, log } = makeHost();
    const hose = new HoseAbility();
    hose.tryActivate(host);
    expect(hose.mods().speed).toBeLessThan(1);
    run(hose, host, ABILITY_TUNING.hose.duration + 0.05);
    expect(log.reveal.length).toBeGreaterThan(30);
    expect(log.puddles).toBeGreaterThanOrEqual(Math.floor(ABILITY_TUNING.hose.duration / ABILITY_TUNING.hose.puddleEvery));
    expect(hose.mods()).toEqual({});
  });

  it('olfato canino: marca los soretes que vienen adelante mientras dura', () => {
    const { host, log } = makeHost();
    const sniff = new SniffAbility();
    sniff.tryActivate(host);
    expect(log.marks[0][1]).toBeGreaterThan(1000 + ABILITY_TUNING.sniff.range - 1);
    run(sniff, host, ABILITY_TUNING.sniff.duration);
    expect(log.marks.length).toBeGreaterThan(8);
  });

  it('silbatazo: sólo en una esquina que todavía no cruzaste (si no, no gasta la recarga)', () => {
    const none = makeHost().host;
    const w = new WhistleAbility();
    expect(w.tryActivate(none)).toBe('unavailable');
    expect(w.ready).toBe(true);
    let asked = 0;
    const crossed = makeHost({ world: fakeWorld({ crossingAhead: () => ({ forceWalk: () => false }) }).world }).host;
    expect(w.tryActivate(crossed)).toBe('unavailable');
    const corner = makeHost({ world: fakeWorld({ crossingAhead: () => ({ forceWalk: (s) => ((asked = s), true) }) }).world }).host;
    expect(w.tryActivate(corner)).toBe('ok');
    expect(asked).toBe(ABILITY_TUNING.whistle.duration);
  });
});

function geometry(dir: 1 | -1): CrossingGeometry {
  const x0 = 4000;
  const roadX0 = x0 + CROSSING_TUNING.roadInset;
  const roadX1 = x0 + CROSSING_TUNING.width - CROSSING_TUNING.roadInset;
  const laneW = (roadX1 - roadX0) / 2;
  return { x0, x1: x0 + CROSSING_TUNING.width, roadX0, roadX1, laneXs: [roadX0 + laneW / 2, roadX0 + laneW * 1.5], dir };
}

describe('Silbatazo en el tránsito', () => {
  it('aunque se use en cualquier momento, nunca hay autos sobre la senda con paso peatonal', () => {
    for (const dir of [1, -1] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const c = new CrossingController(geometry(dir), { timing: CROSSING_TUNING.timing, density: 1.8, seed: seed * 31 });
        c.prewarm(6);
        let whistles = 0;
        let t = 0;
        // Silbatazos en momentos "al azar" (deterministas) durante varios ciclos.
        let next = 1 + seed * 0.37;
        while (t < 8 * c.light.cycleLength) {
          if (t >= next) {
            c.light.forceWalk(ABILITY_TUNING.whistle.duration);
            whistles++;
            next = t + 2.3 + ((seed * 7 + whistles * 3) % 5);
          }
          c.update(DT, { x: c.geo.x0 - 60, y: 174, footprint: PLAYER_TUNING.footprint, canBeHit: true, active: true });
          if (c.light.pedestriansMayCross) {
            expect(c.traffic.occupiesCrosswalk()).toBe(false);
            expect(c.light.vehicle).toBe('red');
          }
          t += DT;
        }
        expect(whistles).toBeGreaterThan(5);
      }
    }
  }, 30000);

  it('el silbatazo adelanta el paso peatonal desde el verde de los autos', () => {
    const c = new CrossingController(geometry(1), { timing: CROSSING_TUNING.timing, density: 0, seed: 7 });
    c.light.set('vehGreen', 0);
    const normalWait = c.light.secondsUntilWalk;
    expect(c.forceWalk(3)).toBe(true);
    expect(c.light.secondsUntilWalk).toBeLessThan(normalWait);
  });
});

describe('Pasivas', () => {
  it('cada personaje tiene sus efectos pasivos', () => {
    const fx = (id: string) => new PassiveController(getCharacter(id), 1).effects;
    expect(fx('player_portero').pickupRadius).toBe(PASSIVE_TUNING.porteroPickup);
    expect(fx('player_hose').waterImmune).toBe(true);
    expect(fx('player_default').waterImmune).toBe(false);
    expect(fx('player_police').honkDistance).toBeCloseTo(CROSSING_TUNING.honkDistance * PASSIVE_TUNING.policeHonk);
    expect(fx('player_dogwalker').detectHidden).toBe(PASSIVE_TUNING.dogDetect);
    expect(fx('player_default').detectHidden).toBe(0);
  });

  it('las correas del paseador se enredan de vez en cuando (sólo caminando), con semilla', () => {
    const simulate = (seed: number, moving: boolean) => {
      const p = new PassiveController(getCharacter('player_dogwalker'), seed);
      const at: number[] = [];
      for (let t = 0; t < 120; t += DT) {
        if (p.update(DT, moving)) at.push(Math.round(t * 10));
        if (p.tangled) expect(p.mods().speed).toBe(PASSIVE_TUNING.tangleSpeed);
      }
      return at;
    };
    const a = simulate(5, true);
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(5);
    expect(simulate(5, true)).toEqual(a);
    expect(simulate(5, false)).toEqual([]);
    const other = new PassiveController(getCharacter('player_default'), 5);
    for (let t = 0; t < 120; t += DT) expect(other.update(DT, true)).toBe(false);
  });
});

describe('Personajes: diferencias moderadas y todos pueden con todo', () => {
  const base = getCharacter('player_default').stats;

  it('ninguna estadística se aleja demasiado del pibe', () => {
    for (const def of PLAYABLE) {
      const s = def.stats;
      expect(s.runSpeed / base.runSpeed, def.id).toBeGreaterThan(0.85);
      expect(s.runSpeed / base.runSpeed, def.id).toBeLessThan(1.2);
      expect(s.walkSpeed / base.walkSpeed, def.id).toBeGreaterThan(0.85);
      expect(s.jumpVelocity / base.jumpVelocity, def.id).toBeGreaterThan(0.88);
      expect(s.jumpVelocity / base.jumpVelocity, def.id).toBeLessThan(1.12);
      expect(s.airControl, def.id).toBeGreaterThan(0.5);
    }
  });

  for (const def of PLAYABLE) {
    it(`${def.name}: salta en todas las direcciones y pasa por encima de un sorete común`, () => {
      const dirs = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 1],
        [-1, -1],
        [-1, 1],
      ];
      for (const [dx, dy] of dirs) {
        const motor = new PlayerMotor(1000, 174, def.stats);
        const c = new FakeControls();
        c.moveX = dx;
        c.moveY = dy;
        for (let t = 0; t < 0.4; t += DT) step(motor, c);
        motor.y = 174;
        c.press();
        step(motor, c);
        expect(motor.onGround, `${def.id} ${dx},${dy}`).toBe(false);
        let air = 0;
        // Recorrido mientras va más alto que un sorete común.
        let overX = 0;
        let overY = 0;
        while (!motor.onGround && air < 3) {
          const x = motor.x;
          const y = motor.y;
          step(motor, c);
          if (motor.z > POOP.clearHeight) {
            overX += Math.abs(motor.x - x);
            overY += Math.abs(motor.y - y);
          }
          air += DT;
        }
        expect(motor.onGround).toBe(true);
        // Le alcanza para pasar por encima de un sorete común en cualquier dirección.
        const poopW = Math.max(...POOP.variants.map((v) => v.footprint.w));
        const poopH = Math.max(...POOP.variants.map((v) => v.footprint.h));
        if (dx !== 0) expect(overX, `${def.id} ${dx},${dy}`).toBeGreaterThan(poopW + PLAYER_TUNING.footprint.w);
        else if (dy !== 0) expect(overY, `${def.id} ${dx},${dy}`).toBeGreaterThan(poopH + PLAYER_TUNING.footprint.h);
      }
    });
  }

  it('el más lento cruza la calle caminando con margen dentro del verde', () => {
    const slowest = Math.min(...PLAYABLE.map((d) => d.stats.walkSpeed));
    const g = geometry(1);
    const seconds = (g.roadX1 - g.roadX0 + PLAYER_TUNING.footprint.w) / slowest;
    const t = CROSSING_TUNING.timing;
    expect(seconds * 1.5).toBeLessThan(t.pedGreen + t.pedFlash);
  });

  it('desbloqueos: cuatro iniciales y los demás por desafíos (sin monedas)', () => {
    const starters = CHARACTERS.filter((c) => c.unlock.kind === 'starter').map((c) => c.id);
    expect(starters).toEqual(['player_default', 'player_girl', 'player_skater', 'player_runner']);
    for (const c of CHARACTERS) {
      if (c.unlock.kind === 'starter') continue;
      expect(['achievement', 'future']).toContain(c.unlock.kind);
      expect(c.unlock.target).toBeGreaterThan(0);
    }
    expect(getCharacter('player_portero').unlock).toEqual({ kind: 'achievement', counter: 'trashDeposited', target: 20 });
    expect(getCharacter('player_hose').unlock).toEqual({ kind: 'achievement', counter: 'waterJetsDodged', target: 15 });
    expect(getCharacter('player_dogwalker').unlock).toEqual({ kind: 'achievement', counter: 'animalMissions', target: 10 });
    expect(getCharacter('player_police').unlock).toEqual({ kind: 'achievement', counter: 'safeCrossings', target: 25 });
  });
});

describe('Animaciones por personaje (preparadas para el arte definitivo)', () => {
  it('cada animación del juego tiene sus cuadros comunes, y cada personaje declara las propias', async () => {
    const { ANIMATION_FRAMES } = await import('../src/data/characters');
    const names = Object.keys(ANIMATION_FRAMES).sort();
    expect(names).toEqual(['celebrate', 'disgust', 'fall', 'gameOver', 'idle', 'jump', 'run', 'special', 'step', 'walk']);
    for (const frames of Object.values(ANIMATION_FRAMES)) expect(frames.length).toBeGreaterThan(0);
    // Todos los que se pueden elegir tienen al menos su animación de poder.
    for (const def of PLAYABLE) expect(def.animations.special, def.id).toBeTruthy();
    // Las ideas de la consigna quedan anotadas para los sprites definitivos.
    expect(getCharacter('player_portero').animations.disgust).toContain('SUELA');
    expect(getCharacter('player_hose').animations.disgust).toContain('AGUA');
    expect(getCharacter('player_dogwalker').animations.walk).toContain('CORREAS');
    expect(getCharacter('player_skater').animations.celebrate).toContain('TRUQUITO');
    expect(getCharacter('player_girl').animations.celebrate).toContain('SALTANDO');
    expect(getCharacter('player_runner').animations.celebrate).toContain('CARRERA');
  });
});
