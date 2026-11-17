import Phaser from 'phaser';
import { LAYOUT } from '../config/constants';
import { ANIM } from '../graphics/animations';
import { TEX } from '../graphics/keys';
import { NPC_FRAME, WALKER_HAND } from '../graphics/textures/npcTextures';
import type { NpcPlacement } from '../world/LevelLayout';

const SPEEDS = { walker: 22, lady: 13, tourist: 17 } as const;

/**
 * Peatón decorativo que camina por detrás de la zona jugable
 * (el paseador lleva a sus perros con correa).
 */
export class Npc {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly dogs: Phaser.GameObjects.Sprite[] = [];
  private readonly leash?: Phaser.GameObjects.Graphics;
  private x: number;
  private dir: 1 | -1;
  private readonly speed: number;
  private visible = true;

  constructor(
    scene: Phaser.Scene,
    private readonly placement: NpcPlacement,
  ) {
    this.x = placement.x;
    this.dir = placement.dir;
    this.speed = SPEEDS[placement.kind];
    const y = LAYOUT.npcLaneY;
    const texture = placement.kind === 'walker' ? TEX.npcWalker : placement.kind === 'lady' ? TEX.npcLady : TEX.npcTourist;
    const anim = placement.kind === 'walker' ? ANIM.walker : placement.kind === 'lady' ? ANIM.lady : ANIM.tourist;
    this.sprite = scene.add.sprite(this.x, y, texture, 'walk0').setOrigin(0.5, (NPC_FRAME.groundY + 1) / NPC_FRAME.h).setDepth(y);
    this.sprite.play({ key: anim, startFrame: Phaser.Math.Between(0, 1) });
    this.sprite.setFlipX(this.dir < 0);

    if (placement.kind === 'walker') {
      this.leash = scene.add.graphics().setDepth(y + 1);
      placement.dogs.forEach((kind, i) => {
        const dog = scene.add
          .sprite(this.x, y + 1 + (i % 3), TEX.npcDog(kind), 'walk0')
          .setOrigin(0.5, 1)
          .setDepth(y + 1 + (i % 3));
        dog.play({ key: ANIM.dog(kind), startFrame: i % 2 });
        dog.setFlipX(this.dir < 0);
        this.dogs.push(dog);
      });
    }
  }

  /** Camina por su cuadra y da la vuelta en las esquinas (nunca cruza la calle). */
  update(dt: number): void {
    this.x += this.dir * this.speed * dt;
    if (this.x < this.placement.minX && this.dir < 0) this.turn(1);
    else if (this.x > this.placement.maxX && this.dir > 0) this.turn(-1);
    const rx = Math.round(this.x);
    this.sprite.x = rx;
    if (this.dogs.length > 0 && this.leash) {
      this.leash.clear();
      if (!this.visible) return;
      this.leash.lineStyle(1, 0x3a2a20, 1);
      const handX = rx + (WALKER_HAND.x - NPC_FRAME.w / 2) * this.dir;
      const handY = this.sprite.y - (NPC_FRAME.groundY + 1 - WALKER_HAND.y);
      this.dogs.forEach((dog, i) => {
        const offset = 16 + i * 9 + Math.sin(this.x * 0.15 + i) * 1.5;
        dog.x = Math.round(rx + offset * this.dir);
        this.leash!.lineBetween(handX, handY, dog.x + 3 * this.dir, dog.y - dog.height + 3);
      });
    }
  }

  private turn(dir: 1 | -1): void {
    this.dir = dir;
    this.sprite.setFlipX(dir < 0);
    this.dogs.forEach((d) => d.setFlipX(dir < 0));
  }

  setTint(tint: number): void {
    this.sprite.setTint(tint);
    this.dogs.forEach((d) => d.setTint(tint));
  }

  get posX(): number {
    return this.x;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.sprite.setVisible(v);
    this.dogs.forEach((d) => d.setVisible(v));
    this.leash?.setVisible(v);
  }

  destroy(): void {
    this.sprite.destroy();
    this.dogs.forEach((d) => d.destroy());
    this.leash?.destroy();
  }

  get kind(): NpcPlacement['kind'] {
    return this.placement.kind;
  }
}
