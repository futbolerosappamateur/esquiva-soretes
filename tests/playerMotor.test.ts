import { describe, expect, it } from 'vitest';
import { PLAYER_TUNING } from '../src/config/balance';
import { LAYOUT } from '../src/config/constants';
import { PlayerMotor, type BlockedFn, type MotorControls } from '../src/entities/PlayerMotor';
import { JumpBuffer } from '../src/input/KeyboardInputState';

const DT = 1 / 60;
const BOUNDS = { minX: -1e6, maxX: 1e6, minY: LAYOUT.walkMinY, maxY: LAYOUT.walkMaxY };
const FREE: BlockedFn = () => false;

/** Controles de prueba: dirección fija y un salto pedido a demanda (con el mismo buffer que el juego). */
class FakeControls implements MotorControls {
  moveX = 0;
  moveY = 0;
  readonly buffer = new JumpBuffer(PLAYER_TUNING.jumpBufferTime);
  press(): void {
    this.buffer.request();
  }
  tick(dt: number): void {
    this.buffer.update(dt);
  }
  consumeJump(): boolean {
    return this.buffer.consume();
  }
}

function frame(m: PlayerMotor, c: FakeControls | null, isBlocked: BlockedFn = FREE) {
  c?.tick(DT);
  const ev = m.stepMovement(DT, c, BOUNDS, isBlocked);
  const landed = m.stepHeight(DT);
  m.tickTimers(DT);
  return { ...ev, landed };
}

const DIRECTIONS: { name: string; x: number; y: number }[] = [
  { name: 'quieto', x: 0, y: 0 },
  { name: 'derecha', x: 1, y: 0 },
  { name: 'izquierda', x: -1, y: 0 },
  { name: 'arriba (hacia las casas)', x: 0, y: -1 },
  { name: 'abajo (hacia el cordón)', x: 0, y: 1 },
  { name: 'diagonal arriba-derecha', x: 1, y: -1 },
  { name: 'diagonal abajo-derecha', x: 1, y: 1 },
  { name: 'diagonal arriba-izquierda', x: -1, y: -1 },
  { name: 'diagonal abajo-izquierda', x: -1, y: 1 },
];

/** Simula un salto completo y devuelve altura máxima, duración en el aire y velocidades. */
function jumpWhileMoving(dir: { x: number; y: number }, warmup: number, startY = 174) {
  const m = new PlayerMotor(1000, startY);
  const c = new FakeControls();
  c.moveX = dir.x;
  c.moveY = dir.y;
  for (let t = 0; t < warmup; t += DT) frame(m, c);
  // Si el calentamiento lo llevó contra un borde, se lo recentra sin perder la velocidad.
  m.y = startY;
  const vxBefore = m.vx;
  const vyBefore = m.vy;
  c.press();
  const first = frame(m, c);
  const vzAfterJump = m.vz;
  let peak = m.z;
  let air = DT;
  let landed = false;
  for (let i = 0; i < 300 && !landed; i++) {
    const r = frame(m, c);
    peak = Math.max(peak, m.z);
    air += DT;
    landed = r.landed;
  }
  return { jumped: first.jumped, vzAfterJump, vxBefore, vyBefore, peak, air, landed, motor: m };
}

describe('PlayerMotor · salto en cualquier dirección', () => {
  const expectedPeak = PLAYER_TUNING.jumpVelocity ** 2 / (2 * PLAYER_TUNING.gravity);
  const reference = jumpWhileMoving({ x: 0, y: 0 }, 0.3);

  for (const gait of [
    { name: 'caminando', warmup: 0.3 },
    { name: 'corriendo', warmup: 1.0 },
  ]) {
    for (const dir of DIRECTIONS) {
      it(`salta ${gait.name} · ${dir.name}`, () => {
        const r = jumpWhileMoving(dir, gait.warmup);
        expect(r.jumped).toBe(true);
        expect(r.vzAfterJump).toBeGreaterThan(PLAYER_TUNING.jumpVelocity * 0.9);
        expect(r.landed).toBe(true);
        // La altura y el tiempo en el aire no dependen de la dirección ni de la velocidad.
        expect(r.peak).toBeGreaterThan(expectedPeak * 0.9);
        expect(r.peak).toBeCloseTo(reference.peak, 5);
        expect(r.air).toBeCloseTo(reference.air, 5);
      });
    }
  }

  it('el salto no modifica la velocidad en x ni en y', () => {
    for (const dir of DIRECTIONS) {
      const m = new PlayerMotor(1000, 174);
      const c = new FakeControls();
      c.moveX = dir.x;
      c.moveY = dir.y;
      for (let t = 0; t < 0.4; t += DT) frame(m, c);
      m.y = 174;
      const vx = m.vx;
      const vy = m.vy;
      c.press();
      frame(m, c);
      expect(m.vx).toBeCloseTo(vx, 6);
      expect(m.vy).toBeCloseTo(vy, 6);
    }
  });

  it('salta pegado al borde de la vereda, hacia el cordón y hacia las casas', () => {
    for (const [y, dy] of [
      [LAYOUT.walkMaxY, 1],
      [LAYOUT.walkMinY, -1],
    ]) {
      const m = new PlayerMotor(1000, y);
      const c = new FakeControls();
      c.moveY = dy;
      c.moveX = 1;
      for (let t = 0; t < 0.3; t += DT) frame(m, c);
      c.press();
      expect(frame(m, c).jumped).toBe(true);
    }
  });

  it('salta aunque esté trabado contra un obstáculo sólido', () => {
    const m = new PlayerMotor(1000, 174);
    const c = new FakeControls();
    c.moveX = 1;
    c.moveY = 1;
    const wall: BlockedFn = (x) => x > 1001;
    for (let t = 0; t < 0.3; t += DT) frame(m, c, wall);
    c.press();
    expect(frame(m, c, wall).jumped).toBe(true);
    expect(m.vz).toBeGreaterThan(0);
  });

  it('no hay doble salto en el aire, pero el salto anticipado se respeta al aterrizar', () => {
    const m = new PlayerMotor(1000, 174);
    const c = new FakeControls();
    c.press();
    frame(m, c);
    // En el aire: pedir saltar lejos del piso no cambia nada…
    for (let i = 0; i < 6; i++) frame(m, c);
    const vz = m.vz;
    c.press();
    frame(m, c);
    expect(m.vz).toBeLessThan(vz);
    // …y ese pedido vence antes de aterrizar.
    let jumps = 0;
    for (let i = 0; i < 60; i++) if (frame(m, c).jumped) jumps++;
    expect(jumps).toBe(0);
    // Pedido justo antes de aterrizar: salta apenas toca el piso.
    const m2 = new PlayerMotor(1000, 174);
    const c2 = new FakeControls();
    c2.press();
    frame(m2, c2);
    let jumpedAgain = false;
    for (let i = 0; i < 80 && !jumpedAgain; i++) {
      if (m2.vz < 0 && m2.z < 6 && !c2.buffer.pending) c2.press();
      if (frame(m2, c2).jumped) jumpedAgain = true;
    }
    expect(jumpedAgain).toBe(true);
  });
});
