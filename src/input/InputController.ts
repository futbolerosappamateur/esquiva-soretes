import Phaser from 'phaser';
import { PLAYER_TUNING } from '../config/balance';
import { JumpBuffer, KeyboardInputState } from './KeyboardInputState';
import { touchState } from './TouchState';

/**
 * Unifica teclado y controles táctiles en una sola lectura por cuadro:
 * dirección de movimiento, salto (con buffer) y pausa.
 *
 * Todo se toma de los eventos de teclado (keydown/keyup) y se procesa en
 * KeyboardInputState, que no depende de Phaser y tiene pruebas automáticas.
 */
export class InputController {
  moveX = 0;
  moveY = 0;
  readonly keys = new KeyboardInputState();
  private readonly jumpBuffer = new JumpBuffer(PLAYER_TUNING.jumpBufferTime);
  private pauseRequested = false;
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  constructor(scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard;
    if (this.keyboard) {
      // Evita que las flechas y la barra espaciadora muevan la página.
      this.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
      this.keyboard.on('keydown', this.onKeyDown, this);
      this.keyboard.on('keyup', this.onKeyUp, this);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.keyboard?.off('keydown', this.onKeyDown, this);
        this.keyboard?.off('keyup', this.onKeyUp, this);
      });
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys.keyDown(event.code, event.repeat);
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.keyUp(event.code);
  }

  update(dt: number): void {
    let { x, y } = this.keys.direction();
    if (x === 0 && y === 0 && touchState.active) {
      x = touchState.x;
      y = touchState.y;
    }
    this.moveX = x;
    this.moveY = y;

    this.jumpBuffer.update(dt);
    // Se consumen los dos orígenes siempre (no en cortocircuito) para no dejar pedidos colgados.
    const keyJump = this.keys.consumeJumpPress();
    const touchJump = touchState.consumeJump();
    if (keyJump || touchJump) this.jumpBuffer.request();
    if (this.keys.consumePausePress() || touchState.consumePause()) this.pauseRequested = true;
  }

  /** Devuelve true si hay un salto pedido (y lo consume). */
  consumeJump(): boolean {
    return this.jumpBuffer.consume();
  }

  consumePause(): boolean {
    const v = this.pauseRequested;
    this.pauseRequested = false;
    return v;
  }

  /** Limpia teclas "trabadas" (por ejemplo, al volver de una pausa o de otra pestaña). */
  reset(): void {
    this.keys.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.jumpBuffer.clear();
    this.pauseRequested = false;
    touchState.reset();
  }
}
