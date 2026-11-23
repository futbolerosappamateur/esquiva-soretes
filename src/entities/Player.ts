import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { PLAYER_TUNING } from '../config/balance';
import { clamp } from '../core/math';
import { ANIM, type PlayerAnim } from '../graphics/animations';
import { FX_FRAMES, TEX } from '../graphics/keys';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { fitToTexture } from '../graphics/renderScale';
import type { CelebrationStyle, CharacterStats } from '../data/characters';
import type { Footprint } from '../systems/Collision';
import { PlayerMotor, type BlockedFn, type MotorBounds, type MotorControls } from './PlayerMotor';

export type PlayerState = 'normal' | 'stepped' | 'scared' | 'dead' | 'victory';
export type PlayerBounds = MotorBounds;

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

export interface ScareCallbacks {
  /** Punto más alto del susto: ahí se descuenta la zapatilla. */
  onImpact: () => void;
  /** Debe devolver la posición segura donde reaparecer (o null si es game over). */
  onRespawn: () => { x: number; y: number } | null;
  onRecovered: () => void;
  onFallen: () => void;
}

/**
 * Protagonista: une el motor físico (PlayerMotor, sin gráficos) con su
 * representación visual (sprite + sombra). El sprite se dibuja en (x, y - z)
 * y se ordena por y; la sombra queda en (x, y).
 */
export class Player {
  readonly motor: PlayerMotor;
  state: PlayerState = 'normal';
  invulnerable = 0;
  readonly footprint: Footprint = PLAYER_TUNING.footprint;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;

  private dirt: number;
  private specialTimer = 0;
  private celebration: CelebrationStyle = 'default';
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
    stats?: CharacterStats,
  ) {
    this.motor = new PlayerMotor(x, y, stats);
    this.dirt = clamp(dirt, 0, 2);
    this.shadow = scene.add.image(x, y, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3).setDepth(DEPTH.shadow);
    this.sprite = fitToTexture(scene.add.sprite(x, y, TEX.player(this.dirt), 'idle0').setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY));
    this.playAnim('idle');
    this.syncSprite();
  }

  // Accesos directos al motor (los usan los sistemas de colisión, la cámara y las pruebas).
  get x(): number {
    return this.motor.x;
  }
  set x(v: number) {
    this.motor.x = v;
  }
  get y(): number {
    return this.motor.y;
  }
  set y(v: number) {
    this.motor.y = v;
  }
  get z(): number {
    return this.motor.z;
  }
  get vx(): number {
    return this.motor.vx;
  }
  get vy(): number {
    return this.motor.vy;
  }
  get vz(): number {
    return this.motor.vz;
  }
  get facing(): 1 | -1 {
    return this.motor.facing;
  }
  get running(): boolean {
    return this.motor.running;
  }
  get onGround(): boolean {
    return this.motor.onGround;
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

  update(dt: number, controls: MotorControls | null, bounds: PlayerBounds, isBlocked: BlockedFn): void {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.specialTimer = Math.max(0, this.specialTimer - dt);
    this.motor.tickTimers(dt);

    if (this.state === 'normal') {
      const ev = this.motor.stepMovement(dt, controls, bounds, isBlocked);
      if (ev.jumped) this.hooks.onJump?.();
      if (ev.runStep) this.hooks.onRunStep?.();
    } else if (this.state === 'victory') {
      this.updateVictory(dt);
    }

    if (this.motor.stepHeight(dt) && this.state !== 'scared') this.hooks.onLand?.();
    this.updateVisuals();
  }

  jump(): void {
    this.motor.jump();
    this.hooks.onJump?.();
  }

  private updateVictory(dt: number): void {
    this.victoryTime += dt;
    if (this.victoryTime < 0.8) {
      this.motor.x += 58 * dt;
      this.motor.facing = 1;
    } else if (this.motor.onGround) {
      this.hopTimer -= dt;
      if (this.hopTimer <= 0) {
        // Cada personaje festeja a su manera.
        const style = this.celebration;
        this.hopTimer = style === 'hop' ? 0.42 : style === 'champion' ? 0.9 : 0.55;
        this.motor.jump(style === 'hop' ? 200 : style === 'champion' ? 110 : 150);
        if (style === 'trick') {
          this.scene.tweens.add({ targets: this.sprite, angle: { from: 0, to: 360 * this.motor.facing }, duration: 420, ease: 'Sine.easeInOut' });
        }
      }
    }
  }

  private syncSprite(): void {
    const m = this.motor;
    this.sprite.setPosition(Math.round(m.x), Math.round(m.y - m.z));
    this.sprite.setDepth(m.y + 0.5);
    this.sprite.setFlipX(m.facing < 0);
    this.shadow.setPosition(Math.round(m.x), Math.round(m.y));
    const s = 1 - Math.min(0.5, m.z / 60);
    this.shadow.setScale(s);
    this.shadow.setAlpha(0.3 * (0.5 + 0.5 * s));
  }

  private updateVisuals(): void {
    this.syncSprite();
    const m = this.motor;
    if (this.state === 'normal') {
      const blinking = this.invulnerable > 0 && Math.floor(this.invulnerable * 12) % 2 === 0;
      this.sprite.setAlpha(blinking ? 0.35 : 1);
      const speed = Math.hypot(m.vx, m.vy);
      if (this.specialTimer > 0) this.showFrame(this.hasFrame('special0') ? 'special0' : 'jumpPrep');
      else if (!m.onGround) this.showFrame(m.vz > 50 ? 'jumpUp' : 'jumpDown');
      else if (m.landTimer > 0) this.showFrame('jumpPrep');
      else if (speed > 6) {
        this.playAnim(m.running ? 'run' : 'walk');
        this.sprite.anims.timeScale = m.running ? 1 : clamp(speed / PLAYER_TUNING.walkSpeed, 0.6, 1.3);
      } else this.playAnim('idle');
    } else if (this.state === 'victory') {
      this.sprite.setAlpha(1);
      if (this.victoryTime < 0.8) this.playAnim('walk');
      else this.playAnim('win');
    }
  }

  private hasFrame(frame: string): boolean {
    return this.scene.textures.get(TEX.player(this.dirt)).has(frame);
  }

  private playAnim(name: PlayerAnim): void {
    // Si falta una animación propia del personaje, se usa la de espera (nunca un error).
    let key = ANIM.player(this.dirt, name);
    if (!this.scene.anims.exists(key)) key = ANIM.player(this.dirt, 'idle');
    if (!this.scene.anims.exists(key)) return;
    if (this.currentAnim === key) return;
    this.currentAnim = key;
    this.currentFrame = '';
    this.sprite.anims.timeScale = 1;
    this.sprite.play(key);
  }

  private showFrame(frame: string): void {
    if (!this.hasFrame(frame)) frame = 'idle0';
    if (this.currentFrame === frame && this.currentAnim === '') return;
    this.sprite.stop();
    this.currentAnim = '';
    this.currentFrame = frame;
    this.sprite.setTexture(TEX.player(this.dirt), frame);
  }

  /** Pose de "activar el poder" durante unos instantes (si el personaje la tiene). */
  showSpecial(seconds = 0.35): void {
    this.specialTimer = seconds;
  }

  setCelebration(style: CelebrationStyle): void {
    this.celebration = style;
  }

  /** Pisó una baldosa floja: queda más lento un ratito. */
  slowDown(): void {
    this.motor.slowDown();
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, fn));
  }

  private recover(): void {
    this.state = 'normal';
    this.invulnerable = PLAYER_TUNING.invulnTime;
    this.currentAnim = '';
    this.currentFrame = '';
  }

  /**
   * Secuencia al pisar un sorete: se frena, levanta el pie, mira la suela,
   * pone cara de asco y (si le quedan zapatillas) sigue caminando.
   */
  stepIn(lastLife: boolean, cb: StepCallbacks): void {
    this.state = 'stepped';
    this.motor.halt();
    this.motor.ground();
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
        this.recover();
        cb.onRecovered();
      }
    });
  }

  /**
   * Susto caricaturesco al cruzar mal la calle: salta del susto con los pelos
   * de punta, se desvanece y reaparece en un lugar seguro antes del cruce.
   */
  scare(lastLife: boolean, cb: ScareCallbacks): void {
    this.state = 'scared';
    this.motor.halt();
    this.motor.ground();
    this.motor.jump(170);
    this.sprite.setAlpha(1);
    this.showFrame('stepShock');
    this.later(260, () => cb.onImpact());
    this.later(650, () => {
      if (lastLife) {
        this.motor.ground();
        this.die(cb.onFallen);
        return;
      }
      this.scene.tweens.add({
        targets: [this.sprite, this.shadow],
        alpha: 0,
        duration: 160,
        onComplete: () => {
          const spot = cb.onRespawn();
          if (spot) this.motor.teleport(spot.x, spot.y);
          this.syncSprite();
          this.shadow.setAlpha(0.3);
          this.recover();
          cb.onRecovered();
        },
      });
    });
  }

  /** Lo reubica al instante (comienzo de nivel o checkpoint). */
  placeAt(x: number, y: number): void {
    this.motor.teleport(x, y);
    this.syncSprite();
  }

  /** Se marea con el olor y se cae de espaldas. */
  die(onFallen: () => void): void {
    this.state = 'dead';
    this.showFrame('dizzy');
    const dir = this.motor.facing > 0 ? -1 : 1;
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
    this.motor.halt();
  }

  /** Vuelve al estado normal después de un festejo intermedio (fin de cuadra). */
  resumeControl(): void {
    if (this.state !== 'victory') return;
    this.state = 'normal';
    this.currentAnim = '';
    this.currentFrame = '';
  }

  destroy(): void {
    this.timers.forEach((t) => t.remove(false));
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
