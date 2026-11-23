import Phaser from 'phaser';
import { DEPTH } from '../../config/constants';
import { ANIM } from '../../graphics/animations';
import { TEX } from '../../graphics/keys';
import type { EffectsSystem, FlySwarm } from '../../systems/EffectsSystem';
import type { Footprint } from '../../systems/Collision';
import type { ObstaclePlacement } from '../../world/LevelLayout';
import { OBSTACLE_TYPES, variantOf, type ObstacleTypeDef, type ObstacleVariant } from './ObstacleTypes';

export type ObstacleState = 'active' | 'hit' | 'passed';

/** Un obstáculo concreto en la vereda. */
export class Obstacle {
  readonly def: ObstacleTypeDef;
  readonly variant: ObstacleVariant;
  readonly x: number;
  readonly y: number;
  state: ObstacleState = 'active';
  /** Menor distancia vertical entre huellas medida mientras el jugador lo pasaba. */
  closestGap = Infinity;
  /** Se lo atravesó siendo invulnerable: al superarlo no suma puntos. */
  touchedWhileSafe = false;
  /** El jugador sigue parado encima desde que lo tocó siendo invulnerable. */
  safeContact = false;
  readonly sprite: Phaser.GameObjects.Image;
  private readonly cover?: Phaser.GameObjects.Image;
  /** Un sorete camuflado que ya quedó a la vista (escobazo, manguerazo). */
  revealed = false;
  private readonly stinkSprite?: Phaser.GameObjects.Sprite;
  private readonly swarm?: FlySwarm;
  private visible = true;

  constructor(
    scene: Phaser.Scene,
    placement: ObstaclePlacement,
    private readonly effects: EffectsSystem,
  ) {
    this.def = OBSTACLE_TYPES[placement.type];
    this.variant = variantOf(placement.type, placement.variant);
    this.x = placement.x;
    this.y = placement.y;
    this.sprite = scene.add
      .image(this.x, this.y, this.variant.texture, this.variant.frame)
      .setOrigin(0.5, this.variant.originY)
      .setDepth(this.def.layer === 'pile' ? this.y : DEPTH.groundDecal);
    if (placement.variant % 2 === 1 && this.def.id === 'poop') this.sprite.setFlipX(true);

    if (this.def.id === 'camo') {
      this.cover = scene.add.image(this.x, this.y + 1, TEX.leafCover).setOrigin(0.5, 0.75).setDepth(this.y + 0.3);
    }
    if (this.def.id === 'giant') {
      this.stinkSprite = scene.add.sprite(this.x + 2, this.y - 20, TEX.stink, 'stink0').setOrigin(0.5, 1).setDepth(this.y + 0.2).setAlpha(0.8);
      this.stinkSprite.play(ANIM.stink);
      this.swarm = effects.flies(() => ({ x: this.x, y: this.y - 16, depth: this.y, visible: this.visible }), 2, 11);
    }
  }

  get footprint(): Footprint {
    return this.variant.footprint;
  }

  get left(): number {
    return this.x - this.variant.footprint.w / 2;
  }

  get right(): number {
    return this.x + this.variant.footprint.w / 2;
  }

  /** Cambia al dibujo "usado" (aplastado o baldosa salpicada). */
  markUsed(): void {
    this.state = 'hit';
    if (this.variant.usedFrame) {
      this.sprite.setFrame(this.variant.usedFrame);
      this.sprite.setOrigin(0.5, this.variant.usedOriginY ?? this.variant.originY);
    }
    if (this.def.layer === 'pile') this.sprite.setDepth(this.y - 1);
    this.stinkSprite?.setAlpha(1);
  }

  /** Saca las hojas de encima: el sorete escondido queda a la vista (sigue siendo un obstáculo). */
  reveal(): boolean {
    if (this.def.id !== 'camo' || this.revealed || this.state !== 'active') return false;
    this.revealed = true;
    this.cover?.destroy();
    return true;
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.sprite.setVisible(visible);
    this.cover?.setVisible(visible);
    this.stinkSprite?.setVisible(visible);
  }

  destroy(): void {
    this.sprite.destroy();
    if (!this.revealed) this.cover?.destroy();
    this.stinkSprite?.destroy();
    if (this.swarm) this.effects.removeSwarm(this.swarm);
  }
}
