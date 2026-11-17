import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { clamp } from '../core/math';

/**
 * Cámara lateral que sigue el avance del jugador. Como en los beat 'em up,
 * sólo avanza: se puede retroceder dentro de la pantalla, pero la cámara
 * nunca vuelve atrás. Al llegar a una esquina se adelanta para encuadrar
 * el cruce completo (calzada, semáforos y vereda de enfrente).
 */
export class CameraController {
  private scroll = 0;
  /** Posición del jugador en pantalla (fracción del ancho). */
  private readonly anchor = 0.36;

  constructor(
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly worldWidth: number,
    startScroll = 0,
  ) {
    cam.setBounds(0, 0, worldWidth, GAME_HEIGHT);
    this.scroll = clamp(startScroll, 0, Math.max(0, worldWidth - GAME_WIDTH));
    cam.setScroll(Math.round(this.scroll), 0);
  }

  get left(): number {
    return Math.round(this.scroll);
  }

  get right(): number {
    return Math.round(this.scroll) + GAME_WIDTH;
  }

  /** Salto inmediato (checkpoints y depuración). */
  jumpTo(scroll: number): void {
    this.scroll = clamp(scroll, 0, Math.max(0, this.worldWidth - GAME_WIDTH));
    this.cam.setScroll(Math.round(this.scroll), 0);
  }

  /** Scroll que correspondería a seguir a un jugador en `x`. */
  static followScroll(x: number): number {
    return x - GAME_WIDTH * 0.36;
  }

  /**
   * @param lookAhead scroll mínimo deseado (por ejemplo, para encuadrar un cruce).
   */
  update(dt: number, targetX: number, lookAhead: number | null = null): void {
    let desired = targetX - GAME_WIDTH * this.anchor;
    if (lookAhead !== null) desired = Math.max(desired, lookAhead);
    if (desired > this.scroll) this.scroll += (desired - this.scroll) * Math.min(1, dt * (lookAhead !== null ? 3.2 : 7));
    this.scroll = clamp(this.scroll, 0, Math.max(0, this.worldWidth - GAME_WIDTH));
    this.cam.setScroll(Math.round(this.scroll), 0);
  }
}
