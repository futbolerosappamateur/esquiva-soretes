/**
 * Estado compartido de los controles táctiles. Lo escribe la HUD (donde se
 * dibujan el joystick y los botones) y lo lee el controlador del juego.
 */
class TouchStateStore {
  /** Vector del joystick, cada eje entre -1 y 1. */
  x = 0;
  y = 0;
  active = false;
  private jumpQueued = false;
  private pauseQueued = false;
  private specialQueued = false;
  /** Lo actualiza la escena de juego para dibujar el botón especial (0..1, 1 = listo). */
  specialCharge = 1;
  specialIcon: string | null = null;

  queueJump(): void {
    this.jumpQueued = true;
  }

  queueSpecial(): void {
    this.specialQueued = true;
  }

  consumeSpecial(): boolean {
    const v = this.specialQueued;
    this.specialQueued = false;
    return v;
  }

  queuePause(): void {
    this.pauseQueued = true;
  }

  consumeJump(): boolean {
    const v = this.jumpQueued;
    this.jumpQueued = false;
    return v;
  }

  consumePause(): boolean {
    const v = this.pauseQueued;
    this.pauseQueued = false;
    return v;
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.active = false;
    this.jumpQueued = false;
    this.pauseQueued = false;
    this.specialQueued = false;
  }
}

export const touchState = new TouchStateStore();
