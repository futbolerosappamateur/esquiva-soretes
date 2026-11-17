import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH } from '../config/constants';
import { ANIM } from '../graphics/animations';
import { FONTS } from '../graphics/BitmapFontBuilder';
import { FX_FRAMES, TEX } from '../graphics/keys';

export interface FlyTarget {
  x: number;
  y: number;
  depth: number;
  visible?: boolean;
}

/** Moscas que revolotean alrededor de algo (soretes gigantes o zapatillas sucias). */
export class FlySwarm {
  private readonly sprites: Phaser.GameObjects.Sprite[] = [];
  private readonly phases: number[] = [];
  private t = Math.random() * 10;

  constructor(
    private readonly scene: Phaser.Scene,
    count: number,
    private readonly target: () => FlyTarget,
    private readonly radius = 9,
  ) {
    this.setCount(count);
  }

  setCount(count: number): void {
    while (this.sprites.length < count) {
      const s = this.scene.add.sprite(0, 0, TEX.fly, 'fly0');
      s.play(ANIM.fly);
      this.sprites.push(s);
      this.phases.push(Math.random() * Math.PI * 2);
    }
    while (this.sprites.length > count) {
      this.sprites.pop()?.destroy();
      this.phases.pop();
    }
  }

  update(dt: number): void {
    this.t += dt;
    const tg = this.target();
    this.sprites.forEach((s, i) => {
      const p = this.phases[i];
      const sp = 3.1 + i * 0.8;
      const x = tg.x + Math.cos(this.t * sp + p) * this.radius + Math.sin(this.t * 7.3 + p) * 2;
      const y = tg.y + Math.sin(this.t * sp * 1.3 + p) * this.radius * 0.45 + Math.cos(this.t * 5.1 + p) * 1.5;
      s.setPosition(Math.round(x), Math.round(y));
      s.setDepth(tg.depth + (Math.sin(this.t * sp + p) > 0 ? 1 : -1));
      s.setVisible(tg.visible !== false);
    });
  }

  destroy(): void {
    this.sprites.forEach((s) => s.destroy());
    this.sprites.length = 0;
  }
}

/**
 * Efectos visuales del juego: polvo, salpicaduras, chispas, confeti,
 * puntajes flotantes, el "¡PLAF!" de historieta, olores y moscas.
 */
export class EffectsSystem {
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly chunks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly drops: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly swarms = new Set<FlySwarm>();

  constructor(private readonly scene: Phaser.Scene) {
    const make = (frame: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      scene.add.particles(0, 0, TEX.fx, { frame, emitting: false, ...config }).setDepth(DEPTH.effects);

    this.dust = make(FX_FRAMES.dust, {
      lifespan: { min: 260, max: 460 },
      speed: { min: 6, max: 26 },
      angle: { min: 190, max: 350 },
      scale: { start: 1, end: 0.3 },
      alpha: { start: 0.85, end: 0 },
      gravityY: -12,
    });
    this.chunks = make(FX_FRAMES.chunk, {
      lifespan: 650,
      speed: { min: 40, max: 115 },
      angle: { min: 200, max: 340 },
      gravityY: 330,
      alpha: { start: 1, end: 0.3 },
    });
    this.drops = make(FX_FRAMES.drop, {
      lifespan: 620,
      speed: { min: 50, max: 125 },
      angle: { min: 205, max: 335 },
      gravityY: 380,
      alpha: { start: 1, end: 0 },
    });
    this.sparks = make(FX_FRAMES.spark, {
      lifespan: 420,
      speed: { min: 20, max: 65 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
    });
    this.leaves = make(FX_FRAMES.leaf, {
      lifespan: 700,
      speed: { min: 20, max: 55 },
      angle: { min: 220, max: 320 },
      gravityY: 140,
      rotate: { min: 0, max: 360 },
    });
    this.confetti = make(FX_FRAMES.confetti, {
      lifespan: { min: 1400, max: 2300 },
      speedX: { min: -35, max: 35 },
      speedY: { min: 15, max: 70 },
      gravityY: 45,
      rotate: { min: 0, max: 360 },
      tint: [0xffffff, 0x7cc8f2, 0xffd23f, 0xe8433a, 0x5fd068, 0xf08ac0],
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, 4), quantity: 1 },
    });
  }

  dustPuff(x: number, y: number, count = 2): void {
    this.dust.explode(count, x, y - 1);
  }

  sparkle(x: number, y: number): void {
    this.sparks.explode(6, x, y);
  }

  leafBurst(x: number, y: number): void {
    this.leaves.explode(5, x, y - 2);
  }

  /** Pisada: pedacitos marrones, "¡PLAF!" de historieta y olor. */
  splat(x: number, y: number): void {
    this.chunks.explode(12, x, y - 2);
    const burst = this.scene.add
      .image(Math.round(x), Math.round(y - 34), TEX.plaf)
      .setDepth(DEPTH.floatingText)
      .setScale(0.4)
      .setAngle(Phaser.Math.Between(-10, 10));
    this.scene.tweens.add({
      targets: burst,
      scale: 1,
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({ targets: burst, alpha: 0, y: burst.y - 6, delay: 380, duration: 220, onComplete: () => burst.destroy() });
      },
    });
    this.stink(x, y - 6, 3);
  }

  /** Baldosa floja: chorro de agua sucia. */
  splash(x: number, y: number): void {
    this.drops.explode(16, x, y - 1);
    this.dust.explode(2, x, y);
  }

  confettiBurst(scrollX: number): void {
    this.confetti.setPosition(scrollX, -6);
    this.confetti.explode(70);
  }

  /** Puntaje flotante chiquito ("+50"). */
  popup(x: number, y: number, text: string, color: number): void {
    const t = this.scene.add
      .bitmapText(Math.round(x), Math.round(y), FONTS.OUTLINE, text)
      .setOrigin(0.5, 1)
      .setTint(color)
      .setDepth(DEPTH.floatingText);
    this.scene.tweens.add({ targets: t, y: t.y - 14, duration: 650, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 420, duration: 230, onComplete: () => t.destroy() });
  }

  /** Líneas de olor que suben y se desvanecen. */
  stink(x: number, y: number, count = 3, duration = 1300): void {
    for (let i = 0; i < count; i++) {
      const s = this.scene.add
        .sprite(Math.round(x + (i - (count - 1) / 2) * 7), Math.round(y), TEX.stink, 'stink0')
        .setDepth(DEPTH.effects)
        .setOrigin(0.5, 1)
        .setAlpha(0);
      s.play({ key: ANIM.stink, startFrame: i % 3 });
      this.scene.tweens.add({
        targets: s,
        y: s.y - 16,
        alpha: { from: 0.95, to: 0 },
        delay: i * 120,
        duration,
        ease: 'Sine.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Signo de exclamación sobre la cabeza. */
  exclaim(x: number, y: number): void {
    const e = this.scene.add.image(Math.round(x), Math.round(y), TEX.fx, FX_FRAMES.exclaim).setDepth(DEPTH.floatingText).setScale(0.5);
    this.scene.tweens.add({ targets: e, scale: 1, y: e.y - 4, duration: 140, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: e, alpha: 0, delay: 520, duration: 150, onComplete: () => e.destroy() });
  }

  flies(target: () => FlyTarget, count: number, radius = 9): FlySwarm {
    const swarm = new FlySwarm(this.scene, count, target, radius);
    this.swarms.add(swarm);
    return swarm;
  }

  removeSwarm(swarm: FlySwarm): void {
    swarm.destroy();
    this.swarms.delete(swarm);
  }

  update(dt: number): void {
    this.swarms.forEach((s) => s.update(dt));
  }
}
