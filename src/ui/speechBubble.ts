import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { addText } from './text';

/**
 * Globito de diálogo pixelado sobre la cabeza de un personaje. Se borra solo
 * a los `ms` milisegundos (o antes, con destroy()).
 */
export class SpeechBubble {
  readonly container: Phaser.GameObjects.Container;
  private readonly timer: Phaser.Time.TimerEvent;
  private alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, ms = 2800) {
    const label = addText(scene, 0, 0, text, { outline: false, color: 0x21142b, maxWidth: 150, align: 'center', origin: [0.5, 1] });
    const w = Math.ceil(label.width) + 8;
    const h = Math.ceil(label.height) + 6;
    const g = scene.add.graphics();
    g.fillStyle(0xfff4d6, 1).fillRoundedRect(-w / 2, -h - 2, w, h, 3);
    g.lineStyle(1, 0x21142b, 1).strokeRoundedRect(-w / 2, -h - 2, w, h, 3);
    g.fillStyle(0xfff4d6, 1).fillTriangle(-3, -3, 3, -3, 0, 2);
    label.setPosition(0, -5);
    this.container = scene.add.container(Math.round(x), Math.round(y), [g, label]).setDepth(DEPTH.floatingText);
    this.timer = scene.time.delayedCall(ms, () => this.destroy());
  }

  get active(): boolean {
    return this.alive;
  }

  setPosition(x: number, y: number): void {
    if (this.alive) this.container.setPosition(Math.round(x), Math.round(y));
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.timer.remove(false);
    this.container.destroy();
  }
}
