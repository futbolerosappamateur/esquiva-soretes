import { PLAYER_TUNING } from '../config/balance';
import { approach, clamp } from '../core/math';

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

export type BlockedFn = (x: number, y: number) => boolean;

/**
 * Física del protagonista en 2.5D, sin gráficos (se puede probar sin Phaser):
 *  - x: avance a lo largo de la vereda,
 *  - y: profundidad (hacia las casas o hacia el cordón),
 *  - z: altura del salto.
 *
 * El salto sólo toca z/vz: nunca depende de la dirección ni de la velocidad
 * en x/y, y se puede iniciar en cualquier dirección mientras se esté en el piso.
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
  private runCharge = 0;
  private slowTimer = 0;
  private runStepTimer = 0;

  constructor(
    x: number,
    y: number,
    private readonly tuning = PLAYER_TUNING,
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
    this.landTimer = Math.max(0, this.landTimer - dt);
  }

  /** Movimiento en el plano del suelo + inicio del salto. */
  stepMovement(dt: number, controls: MotorControls | null, bounds: MotorBounds, isBlocked: BlockedFn): MotorEvents {
    const events: MotorEvents = { jumped: false, runStep: false };
    const ix = controls?.moveX ?? 0;
    const iy = controls?.moveY ?? 0;
    const grounded = this.onGround;
    const t = this.tuning;

    // Mantener "avanzar" un ratito hace correr. En el aire se conserva el impulso.
    if (ix > 0.5) {
      if (grounded || this.running) this.runCharge += dt;
    } else if (grounded) {
      this.runCharge = 0;
    }
    if (grounded) this.running = this.runCharge >= t.runChargeTime;

    const slow = this.slowTimer > 0 ? t.looseTileSlowFactor : 1;
    const maxX = (ix > 0 ? (this.running ? t.runSpeed : t.walkSpeed) : t.backSpeed) * slow;
    const targetVx = ix * maxX;
    const targetVy = iy * t.depthSpeed * slow;
    const ax = (Math.abs(targetVx) > Math.abs(this.vx) ? t.accel : t.decel) * dt;
    const ay = (Math.abs(targetVy) > Math.abs(this.vy) ? t.accel : t.decel) * dt;
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
    if (controls && grounded && controls.consumeJump()) {
      this.jump();
      events.jumped = true;
    }

    if (this.running && grounded && Math.abs(this.vx) > t.walkSpeed) {
      this.runStepTimer -= dt;
      if (this.runStepTimer <= 0) {
        this.runStepTimer = 0.14;
        events.runStep = true;
      }
    }
    return events;
  }

  jump(velocity = this.tuning.jumpVelocity): void {
    this.vz = velocity;
  }

  /** Integra la altura. Devuelve true en el cuadro en que aterriza. */
  stepHeight(dt: number): boolean {
    if (this.z > 0 || this.vz > 0) {
      this.vz -= this.tuning.gravity * dt;
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
    this.slowTimer = this.tuning.looseTileSlowTime;
  }

  /** Coloca al personaje en otra posición (respawn), quieto y en el piso. */
  teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.halt();
    this.ground();
  }
}
