import { PLAYER_TUNING } from '../config/balance';
import { approach, clamp } from '../core/math';
import { getCharacter, type CharacterStats } from '../data/characters';

export interface MotorBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Lo mínimo que el motor necesita de los controles (lo cumple InputController). */
export interface MotorControls {
  readonly moveX: number;
  readonly moveY: number;
  consumeJump(): boolean;
}

export interface MotorEvents {
  jumped: boolean;
  runStep: boolean;
}

/**
 * Modificadores temporales que aplican las habilidades y las pasivas
 * (turbo, sprint, correas enredadas, quedarse quieto barriendo...).
 */
export interface MotorMods {
  speed: number;
  accel: number;
  decel: number;
  depth: number;
  /** Sin control de movimiento (barriendo, por ejemplo). */
  frozen: boolean;
}

export const NO_MODS: Readonly<MotorMods> = { speed: 1, accel: 1, decel: 1, depth: 1, frozen: false };

export type BlockedFn = (x: number, y: number) => boolean;

/**
 * Física del protagonista en 2.5D, sin gráficos (se puede probar sin Phaser):
 *  - x: avance a lo largo de la vereda,
 *  - y: profundidad (hacia las casas o hacia el cordón),
 *  - z: altura del salto.
 *
 * El salto sólo toca z/vz: nunca depende de la dirección ni de la velocidad
 * en x/y, y se puede iniciar en cualquier dirección mientras se esté en el piso.
 * Cada personaje tiene sus estadísticas (CharacterStats); las habilidades
 * sólo aplican modificadores temporales.
 */
export class PlayerMotor {
  x: number;
  y: number;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  running = false;
  /** Cuadros de "aterrizaje" para mostrar la pose de amortiguación. */
  landTimer = 0;
  /** Última dirección de movimiento pedida (para el esquive cuando no se toca nada). */
  readonly lastDir = { x: 1, y: 0 };
  mods: MotorMods = { ...NO_MODS };
  private runCharge = 0;
  private slowTimer = 0;
  private slipTimer = 0;
  private slipFactor = 1;
  private runStepTimer = 0;

  constructor(
    x: number,
    y: number,
    readonly stats: CharacterStats = getCharacter(null).stats,
  ) {
    this.x = x;
    this.y = y;
  }

  get onGround(): boolean {
    return this.z <= 0 && this.vz <= 0;
  }

  get slowed(): boolean {
    return this.slowTimer > 0;
  }

  tickTimers(dt: number): void {
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.slipTimer = Math.max(0, this.slipTimer - dt);
    this.landTimer = Math.max(0, this.landTimer - dt);
  }

  /** Movimiento en el plano del suelo + inicio del salto. */
  stepMovement(dt: number, controls: MotorControls | null, bounds: MotorBounds, isBlocked: BlockedFn): MotorEvents {
    const events: MotorEvents = { jumped: false, runStep: false };
    const frozen = this.mods.frozen;
    const ix = frozen ? 0 : (controls?.moveX ?? 0);
    const iy = frozen ? 0 : (controls?.moveY ?? 0);
    const grounded = this.onGround;
    const s = this.stats;
    const m = this.mods;
    if (Math.abs(ix) > 0.1 || Math.abs(iy) > 0.1) {
      const len = Math.hypot(ix, iy) || 1;
      this.lastDir.x = ix / len;
      this.lastDir.y = iy / len;
    }

    // Mantener "avanzar" un ratito hace correr. En el aire se conserva el impulso.
    if (ix > 0.5) {
      if (grounded || this.running) this.runCharge += dt;
    } else if (grounded) {
      this.runCharge = 0;
    }
    if (grounded) this.running = this.runCharge >= s.runChargeTime;

    const slow = this.slowTimer > 0 ? PLAYER_TUNING.looseTileSlowFactor : 1;
    const maxX = (ix > 0 ? (this.running ? s.runSpeed : s.walkSpeed) : s.backSpeed) * slow * m.speed;
    const targetVx = ix * maxX;
    const targetVy = iy * s.depthSpeed * slow * m.depth;
    // En el aire, el control depende del personaje (1 = igual que en el piso).
    const control = grounded ? 1 : s.airControl;
    const slip = this.slipTimer > 0 ? this.slipFactor : 1;
    const ax = (Math.abs(targetVx) > Math.abs(this.vx) ? s.accel * m.accel : s.decel * m.decel * slip) * control * dt;
    const ay = (Math.abs(targetVy) > Math.abs(this.vy) ? s.accel * m.accel : s.decel * m.decel * slip) * control * dt;
    this.vx = approach(this.vx, targetVx, ax);
    this.vy = approach(this.vy, targetVy, ay);

    // Movimiento separado por ejes: así se "resbala" contra árboles y faroles.
    let nx = clamp(this.x + this.vx * dt, bounds.minX, bounds.maxX);
    if (isBlocked(nx, this.y)) {
      nx = this.x;
      this.vx = 0;
    }
    let ny = clamp(this.y + this.vy * dt, bounds.minY, bounds.maxY);
    if (isBlocked(nx, ny)) {
      ny = this.y;
      this.vy = 0;
    }
    if ((nx <= bounds.minX && this.vx < 0) || (nx >= bounds.maxX && this.vx > 0)) this.vx = 0;
    this.x = nx;
    this.y = ny;

    if (ix > 0.1) this.facing = 1;
    else if (ix < -0.1) this.facing = -1;

    // El salto se evalúa con el estado "en el piso" del comienzo del cuadro,
    // después de mover: ninguna dirección lo puede bloquear.
    if (controls && grounded && !frozen && controls.consumeJump()) {
      this.jump();
      events.jumped = true;
    }

    if (this.running && grounded && Math.abs(this.vx) > s.walkSpeed) {
      this.runStepTimer -= dt;
      if (this.runStepTimer <= 0) {
        this.runStepTimer = 0.14;
        events.runStep = true;
      }
    }
    return events;
  }

  jump(velocity = this.stats.jumpVelocity): void {
    this.vz = velocity;
  }

  /** Segundo impulso en el aire (salto doble): reemplaza la velocidad vertical actual. */
  airJump(velocity: number): void {
    if (this.onGround) return;
    this.vz = velocity;
  }

  /**
   * Desplazamiento instantáneo (esquive) en pasos cortos: se detiene antes de
   * un sólido, de un vehículo o del borde de la vereda. Devuelve los píxeles recorridos.
   */
  dash(dirX: number, dirY: number, distance: number, step: number, isBlocked: BlockedFn, bounds: MotorBounds): number {
    const len = Math.hypot(dirX, dirY);
    if (len < 1e-6) return 0;
    const ux = dirX / len;
    const uy = dirY / len;
    let travelled = 0;
    while (travelled + step <= distance) {
      const nx = this.x + ux * step;
      const ny = this.y + uy * step;
      if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) break;
      if (isBlocked(nx, ny)) break;
      this.x = nx;
      this.y = ny;
      travelled += step;
    }
    if (ux > 0.1) this.facing = 1;
    else if (ux < -0.1) this.facing = -1;
    return travelled;
  }

  /** Integra la altura. Devuelve true en el cuadro en que aterriza. */
  stepHeight(dt: number): boolean {
    if (this.z > 0 || this.vz > 0) {
      this.vz -= PLAYER_TUNING.gravity * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
        this.landTimer = 0.07;
        return true;
      }
    }
    return false;
  }

  /** Frena en seco (al pisar algo o al ser reubicado). */
  halt(): void {
    this.vx = 0;
    this.vy = 0;
    this.running = false;
    this.runCharge = 0;
  }

  /** Lo deja parado en el piso (sin salto en curso). */
  ground(): void {
    this.z = 0;
    this.vz = 0;
  }

  slowDown(): void {
    this.slowTimer = PLAYER_TUNING.looseTileSlowTime;
  }

  /** Piso resbaladizo (charco): frena menos durante un rato. */
  slip(seconds: number, decelFactor: number): void {
    this.slipTimer = Math.max(this.slipTimer, seconds);
    this.slipFactor = decelFactor;
  }

  /** Coloca al personaje en otra posición (respawn), quieto y en el piso. */
  teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.halt();
    this.ground();
  }
}
