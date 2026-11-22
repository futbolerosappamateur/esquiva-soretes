import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { TEX } from '../graphics/keys';
import { fitToTexture } from '../graphics/renderScale';
import type { Button } from './Button';
import { uniqueKeyEvents } from '../input/keyEvents';

export interface MenuItem {
  button: Button;
  /** Para opciones ajustables con izquierda/derecha (por ejemplo, el volumen). */
  onAdjust?: (dir: -1 | 1) => void;
}

export interface MenuOptions {
  onBack?: () => void;
  initial?: number;
  depth?: number;
}

/**
 * Lista de botones navegable con teclado (flechas/WASD, Enter/Espacio,
 * Escape para volver), mouse y pantalla táctil. Muestra un cursor animado.
 */
export class ButtonMenu {
  private index = 0;
  private enabled = true;
  private readonly cursor: Phaser.GameObjects.Image;
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuItem[],
    private readonly opts: MenuOptions = {},
  ) {
    this.cursor = fitToTexture(scene.add.image(0, 0, TEX.cursor))
      .setDepth((opts.depth ?? 0) + 1)
      .setScrollFactor(0);
    scene.tweens.add({ targets: this.cursor, x: '+=3', duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    items.forEach((it, i) => (it.button.onHover = () => this.focus(i, true)));
    this.keyboard = scene.input.keyboard;
    this.keyboard?.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.focus(opts.initial ?? 0, false);
  }

  private readonly onKey = uniqueKeyEvents((event) => this.handleKey(event));

  private handleKey(event: KeyboardEvent): void {
    if (!this.enabled || this.items.length === 0) return;
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.focus(this.index - 1, true);
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.focus(this.index + 1, true);
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.items[this.index].onAdjust?.(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.items[this.index].onAdjust?.(1);
        break;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        this.items[this.index].button.activate();
        break;
      case 'Escape':
      case 'Backspace':
        if (this.opts.onBack) {
          audio.play('click');
          this.opts.onBack();
        }
        break;
      default:
        break;
    }
  }

  focus(i: number, sound: boolean): void {
    const n = this.items.length;
    const next = ((i % n) + n) % n;
    if (sound && next !== this.index) audio.play('click');
    this.index = next;
    this.items.forEach((it, k) => it.button.setFocused(k === this.index));
    const b = this.items[this.index].button;
    this.cursor.setPosition(Math.round(b.x - b.width / 2 - 8), Math.round(b.y));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.cursor.setVisible(enabled);
  }

  destroy(): void {
    this.keyboard?.off('keydown', this.onKey);
    this.cursor.destroy();
  }
}
