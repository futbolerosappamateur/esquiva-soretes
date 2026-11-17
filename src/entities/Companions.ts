import Phaser from 'phaser';
import { ANIM } from '../graphics/animations';
import { TEX } from '../graphics/keys';
import type { Player } from './Player';

/**
 * Perros que acompañan al paseador. Son sólo visuales: siguen al jugador
 * con un poco de retraso, atados con correas. Cuando se enredan, se cruzan.
 */
export class CompanionDogs {
  private readonly dogs: { sprite: Phaser.GameObjects.Sprite; x: number; y: number; ox: number; oy: number }[] = [];
  private readonly leash: Phaser.GameObjects.Graphics;
  private clock = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    count: number,
  ) {
    this.leash = scene.add.graphics();
    for (let i = 0; i < count; i++) {
      const kind = i % 4;
      const sprite = scene.add.sprite(player.x, player.y, TEX.npcDog(kind), 'walk0').setOrigin(0.5, 1);
      sprite.play({ key: ANIM.dog(kind), startFrame: i % 2 });
      this.dogs.push({ sprite, x: player.x - 18 - i * 12, y: player.y + (i ? 6 : -4), ox: -18 - i * 12, oy: i ? 6 : -4 });
    }
  }

  update(dt: number, tangled: boolean, tint: number): void {
    this.clock += dt;
    const p = this.player;
    const dir = p.facing;
    const follow = Math.min(1, dt * 6);
    this.leash.clear();
    this.leash.setDepth(p.y + 0.4);
    this.dogs.forEach((d, i) => {
      // Enredados: los perros se cruzan y dan vueltas alrededor del paseador.
      const wobble = tangled ? Math.sin(this.clock * 9 + i * 2) * 10 : 0;
      const tx = p.x + d.ox * dir + wobble;
      const ty = p.y + d.oy + (tangled ? Math.cos(this.clock * 9 + i * 2) * 4 : 0);
      d.x += (tx - d.x) * follow;
      d.y += (ty - d.y) * follow;
      d.sprite.setPosition(Math.round(d.x), Math.round(d.y)).setDepth(d.y).setFlipX(dir < 0).setTint(tint);
      const moving = Math.abs(p.vx) + Math.abs(p.vy) > 10;
      if (moving && !d.sprite.anims.isPlaying) d.sprite.anims.resume();
      if (!moving && d.sprite.anims.isPlaying) d.sprite.anims.pause();
      this.leash.lineStyle(1, tangled ? 0xff5a4e : 0x3a2a20, 1);
      this.leash.lineBetween(p.x - 4 * dir, p.y - p.z - 20, d.x + 3 * dir, d.y - 7);
    });
  }

  destroy(): void {
    this.dogs.forEach((d) => d.sprite.destroy());
    this.leash.destroy();
  }
}
