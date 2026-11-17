import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { clamp } from '../core/math';

/**
 * Cámara lateral que sigue el avance del jugador. Como en los beat 'em up,
 * sólo avanza: se puede retroceder dentro de la pantalla, pero la cámara
 * nunca vuelve atrás.
 */
export class CameraController {
  private scroll = 0;
  /** Posición del jugador en pantalla (fracción del ancho). */
  private readonly anchor = 0.36;

  constructor(
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly worldWidth: number,
  ) {
    cam.setBounds(0, 0, worldWidth, GAME_HEIGHT);
    cam.setScroll(0, 0);
  }

  get left(): number {
    return Math.round(this.scroll);
  }

  get right(): number {
    return Math.round(this.scroll) + GAME_WIDTH;
  }

  update(dt: number, targetX: number): void {
    const desired = targetX - GAME_WIDTH * this.anchor;
    if (desired > this.scroll) this.scroll += (desired - this.scroll) * Math.min(1, dt * 7);
    this.scroll = clamp(this.scroll, 0, Math.max(0, this.worldWidth - GAME_WIDTH));
    this.cam.setScroll(Math.round(this.scroll), 0);
  }
}
