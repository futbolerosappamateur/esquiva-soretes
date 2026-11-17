import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { PLAYER_TUNING } from '../config/balance';
import { approach, clamp } from '../core/math';
import { ANIM, type PlayerAnim } from '../graphics/animations';
import { FX_FRAMES, TEX } from '../graphics/keys';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import type { InputController } from '../input/InputController';
import type { Footprint } from '../systems/Collision';

export type PlayerState = 'normal' | 'stepped' | 'dead' | 'victory';

export interface PlayerBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PlayerHooks {
  onJump?: () => void;
  onLand?: () => void;
  /** Se llama periódicamente mientras corre (para el polvo). */
  onRunStep?: () => void;
}

export interface StepCallbacks {
  /** Momento en que pone cara de asco: ahí se descuenta la zapatilla. */
  onDisgust: () => void;
  /** Recupera el control (sólo si le quedan zapatillas limpias). */
  onRecovered: () => void;
  /** Terminó de caerse (sin zapatillas limpias). */
  onFallen: () => void;
}

/**
 * Protagonista con movimiento 2.5D:
 *  - x: avance a lo largo de la vereda,
 *  - y: profundidad dentro de la vereda (hacia las casas o hacia el cordón),
 *  - z: altura del salto, independiente de la profundidad.
 * El sprite se dibuja en (x, y - z) y se ordena por y; la sombra queda en (x, y).
 */
export class Player {
  x: number;
  y: number;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  state: PlayerState = 'normal';
  running = false;
  invulnerable = 0;
  readonly footprint: Footprint = PLAYER_TUNING.footprint;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;

  private dirt: number;
  private runCharge = 0;
  private slowTimer = 0;
  private landTimer = 0;
  private runStepTimer = 0;
  private victoryTime = 0;
  private hopTimer = 0;
  private currentAnim = '';
  private currentFrame = '';
  private readonly timers: Phaser.Time.TimerEvent[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    dirt: number,
    private readonly hooks: PlayerHooks = {},
  ) {
    this.x = x;
    this.y = y;
    this.dirt = clamp(dirt, 0, 2);
    this.shadow = scene.add.image(x, y, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3).setDepth(DEPTH.shadow);
    this.sprite = scene.add.sprite(x, y, TEX.player(this.dirt), 'idle0').setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY);
    this.playAnim('idle');
    this.syncSprite();
  }

  get onGround(): boolean {
    return this.z <= 0 && this.vz <= 0;
  }

  get canBeHit(): boolean {
    return this.state === 'normal' && this.invulnerable <= 0;
  }

  get dirtLevel(): number {
    return this.dirt;
  }

  setDirt(level: number): void {
    this.dirt = clamp(level, 0, 2);
    this.currentAnim = '';
    this.currentFrame = '';
  }

  update(dt: number, input: InputController | null, bounds: PlayerBounds, isBlocked: (x: number, y: number) => boolean): void {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.landTimer = Math.max(0, this.landTimer - dt);

    if (this.state === 'normal') this.updateMovement(dt, input, bounds, isBlocked);
    else if (this.state === 'victory') this.updateVictory(dt);

    this.updateHeight(dt);
    this.updateVisuals();
  }

  private updateMovement(dt: number, input: InputController | null, bounds: PlayerBounds, isBlocked: (x: number, y: number) => boolean): void {
    const ix = input?.moveX ?? 0;
    const iy = input?.moveY ?? 0;
    const grounded = this.onGround;
    const t = PLAYER_TUNING;

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

    if (input && grounded && input.consumeJump()) this.jump();

    if (this.running && grounded && Math.abs(this.vx) > t.walkSpeed) {
      this.runStepTimer -= dt;
      if (this.runStepTimer <= 0) {
        this.runStepTimer = 0.14;
        this.hooks.onRunStep?.();
      }
    }
  }

  jump(): void {
    this.vz = PLAYER_TUNING.jumpVelocity;
    this.hooks.onJump?.();
  }

  private updateHeight(dt: number): void {
    if (this.z > 0 || this.vz > 0) {
      this.vz -= PLAYER_TUNING.gravity * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
        this.landTimer = 0.07;
        this.hooks.onLand?.();
      }
    }
  }

  private updateVictory(dt: number): void {
    this.victoryTime += dt;
    if (this.victoryTime < 0.8) {
      this.x += 58 * dt;
      this.facing = 1;
    } else if (this.onGround) {
      this.hopTimer -= dt;
      if (this.hopTimer <= 0) {
        this.hopTimer = 0.55;
        this.vz = 150;
      }
    }
  }

  private syncSprite(): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - this.z));
    this.sprite.setDepth(this.y + 0.5);
    this.sprite.setFlipX(this.facing < 0);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    const s = 1 - Math.min(0.5, this.z / 60);
    this.shadow.setScale(s);
    this.shadow.setAlpha(0.3 * (0.5 + 0.5 * s));
  }

  private updateVisuals(): void {
    this.syncSprite();
    if (this.state === 'normal') {
      const blinking = this.invulnerable > 0 && Math.floor(this.invulnerable * 12) % 2 === 0;
      this.sprite.setAlpha(blinking ? 0.35 : 1);
      const speed = Math.hypot(this.vx, this.vy);
      if (!this.onGround) this.showFrame(this.vz > 50 ? 'jumpUp' : 'jumpDown');
      else if (this.landTimer > 0) this.showFrame('jumpPrep');
      else if (speed > 6) {
        this.playAnim(this.running ? 'run' : 'walk');
        this.sprite.anims.timeScale = this.running ? 1 : clamp(speed / PLAYER_TUNING.walkSpeed, 0.6, 1.3);
      } else this.playAnim('idle');
    } else if (this.state === 'victory') {
      this.sprite.setAlpha(1);
      if (this.victoryTime < 0.8) this.playAnim('walk');
      else this.playAnim('win');
    }
  }

  private playAnim(name: PlayerAnim): void {
    const key = ANIM.player(this.dirt, name);
    if (this.currentAnim === key) return;
    this.currentAnim = key;
    this.currentFrame = '';
    this.sprite.anims.timeScale = 1;
    this.sprite.play(key);
  }

  private showFrame(frame: string): void {
    if (this.currentFrame === frame && this.currentAnim === '') return;
    this.sprite.stop();
    this.currentAnim = '';
    this.currentFrame = frame;
    this.sprite.setTexture(TEX.player(this.dirt), frame);
  }

  /** Empuja levemente hacia atrás (para salir de encima del sorete). */
  slowDown(): void {
    this.slowTimer = PLAYER_TUNING.looseTileSlowTime;
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, fn));
  }

  /**
   * Secuencia al pisar un sorete: se frena, levanta el pie, mira la suela,
   * pone cara de asco y (si le quedan zapatillas) sigue caminando.
   */
  stepIn(lastLife: boolean, cb: StepCallbacks): void {
    this.state = 'stepped';
    this.vx = 0;
    this.vy = 0;
    this.running = false;
    this.runCharge = 0;
    this.z = 0;
    this.vz = 0;
    this.sprite.setAlpha(1);
    this.showFrame('stepShock');
    const total = PLAYER_TUNING.stepStunTime * 1000;
    this.later(total * 0.28, () => this.showFrame('stepLift'));
    this.later(total * 0.52, () => this.showFrame('stepLook'));
    this.later(total * 0.76, () => {
      this.showFrame('stepDisgust');
      cb.onDisgust();
    });
    this.later(total, () => {
      if (lastLife) {
        this.die(cb.onFallen);
      } else {
        this.state = 'normal';
        this.invulnerable = PLAYER_TUNING.invulnTime;
        this.currentAnim = '';
        this.currentFrame = '';
        cb.onRecovered();
      }
    });
  }

  /** Se marea con el olor y se cae de espaldas. */
  die(onFallen: () => void): void {
    this.state = 'dead';
    this.showFrame('dizzy');
    const dir = this.facing > 0 ? -1 : 1;
    this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: -6 * dir, to: 6 * dir },
      duration: 160,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.sprite,
          angle: 90 * dir,
          duration: 420,
          ease: 'Bounce.easeOut',
          onComplete: () => this.later(500, onFallen),
        });
      },
    });
  }

  celebrate(): void {
    this.state = 'victory';
    this.victoryTime = 0;
    this.hopTimer = 0.2;
    this.invulnerable = 0;
    this.vx = 0;
    this.vy = 0;
  }

  destroy(): void {
    this.timers.forEach((t) => t.remove(false));
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
