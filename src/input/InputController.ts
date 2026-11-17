import Phaser from 'phaser';
import { PLAYER_TUNING } from '../config/balance';
import { touchState } from './TouchState';

type KeyName = 'left' | 'right' | 'up' | 'down' | 'a' | 'd' | 'w' | 's' | 'space' | 'esc' | 'p';

/**
 * Unifica teclado y controles táctiles en una sola lectura por cuadro:
 * dirección de movimiento, salto (con buffer) y pausa.
 *
 * El salto y la pausa se toman de los eventos de teclado (no del estado de
 * la tecla) para no perder toques muy rápidos que empiezan y terminan
 * dentro del mismo cuadro.
 */
export class InputController {
  moveX = 0;
  moveY = 0;
  private jumpBuffer = 0;
  private jumpRequested = false;
  private pauseRequested = false;
  private readonly keys: Partial<Record<KeyName, Phaser.Input.Keyboard.Key>> = {};
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  constructor(scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;
    if (this.keyboard) {
      const codes = Phaser.Input.Keyboard.KeyCodes;
      const map: Record<KeyName, number> = {
        left: codes.LEFT,
        right: codes.RIGHT,
        up: codes.UP,
        down: codes.DOWN,
        a: codes.A,
        d: codes.D,
        w: codes.W,
        s: codes.S,
        space: codes.SPACE,
        esc: codes.ESC,
        p: codes.P,
      };
      (Object.keys(map) as KeyName[]).forEach((k) => {
        this.keys[k] = this.keyboard!.addKey(map[k], true, false);
      });
      this.keyboard.on('keydown', this.onKeyDown, this);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyboard?.off('keydown', this.onKeyDown, this));
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.code === 'Space') this.jumpRequested = true;
    else if (event.code === 'Escape' || event.code === 'KeyP') this.pauseRequested = true;
  }

  private down(...names: KeyName[]): boolean {
    return names.some((n) => this.keys[n]?.isDown === true);
  }

  update(dt: number): void {
    let x = 0;
    let y = 0;
    if (this.down('left', 'a')) x -= 1;
    if (this.down('right', 'd')) x += 1;
    if (this.down('up', 'w')) y -= 1;
    if (this.down('down', 's')) y += 1;
    if (x === 0 && y === 0 && touchState.active) {
      x = touchState.x;
      y = touchState.y;
    }
    this.moveX = x;
    this.moveY = y;

    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpRequested || touchState.consumeJump()) {
      this.jumpRequested = false;
      this.jumpBuffer = PLAYER_TUNING.jumpBufferTime;
    }
    if (touchState.consumePause()) this.pauseRequested = true;
  }

  /** Devuelve true si hay un salto pedido (y lo consume). */
  consumeJump(): boolean {
    if (this.jumpBuffer <= 0) return false;
    this.jumpBuffer = 0;
    return true;
  }

  consumePause(): boolean {
    const v = this.pauseRequested;
    this.pauseRequested = false;
    return v;
  }

  /** Limpia teclas "trabadas" (por ejemplo, al volver de una pausa o de otra pestaña). */
  reset(): void {
    this.keyboard?.resetKeys();
    this.moveX = 0;
    this.moveY = 0;
    this.jumpBuffer = 0;
    this.jumpRequested = false;
    this.pauseRequested = false;
    touchState.reset();
  }
}
