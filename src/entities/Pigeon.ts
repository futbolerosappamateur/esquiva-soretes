import Phaser from 'phaser';
import { ANIM } from '../graphics/animations';
import { TEX } from '../graphics/keys';

/** Paloma decorativa: picotea y sale volando cuando alguien se acerca. */
export class Pigeon {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private flying = false;
  private z = 0;
  private vx = 0;
  private vz = 0;
  private time = 0;
  alive = true;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private readonly y: number,
  ) {
    this.sprite = scene.add.sprite(x, y, TEX.pigeon, 'peck0').setOrigin(0.5, 1).setDepth(y);
    this.sprite.play({ key: ANIM.pigeonPeck, startFrame: Phaser.Math.Between(0, 7) });
    this.sprite.setFlipX(Math.random() < 0.5);
  }

  /** Devuelve true si en este cuadro se espantó (para el sonido de aleteo). */
  update(dt: number, threatX: number, threatY: number): boolean {
    if (!this.alive) return false;
    let scared = false;
    if (!this.flying) {
      if (Math.abs(threatX - this.x) < 46 && Math.abs(threatY - this.y) < 30) {
        this.flying = true;
        scared = true;
        const away = this.x >= threatX ? 1 : -1;
        this.vx = away * Phaser.Math.Between(55, 85);
        this.vz = Phaser.Math.Between(60, 90);
        this.sprite.setFlipX(away < 0);
        this.sprite.play(ANIM.pigeonFly);
      }
    } else {
      this.time += dt;
      this.x += this.vx * dt;
      this.vz += 30 * dt;
      this.z += this.vz * dt;
      if (this.time > 1.2) this.sprite.setAlpha(Math.max(0, 1 - (this.time - 1.2) / 0.6));
      if (this.time > 1.8) {
        this.alive = false;
        this.sprite.destroy();
        return scared;
      }
    }
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - this.z));
    return scared;
  }

  setVisible(v: boolean): void {
    if (this.alive) this.sprite.setVisible(v);
  }

  get posX(): number {
    return this.x;
  }

  destroy(): void {
    if (this.alive) this.sprite.destroy();
    this.alive = false;
  }
}
