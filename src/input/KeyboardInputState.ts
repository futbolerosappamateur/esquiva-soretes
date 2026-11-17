import { KEY_BINDINGS, type InputAction, type KeyBindings } from '../config/controls';

/**
 * Estado del teclado armado a partir de eventos (sin depender de Phaser).
 *
 * - Las direcciones se leen de las teclas mantenidas.
 * - El salto y la pausa se registran como "pulsaciones" en el keydown, así un
 *   toque rapidísimo que empieza y termina dentro del mismo cuadro no se pierde,
 *   y presionar saltar nunca depende de qué teclas de movimiento estén apretadas.
 */
export class KeyboardInputState {
  private readonly held = new Set<string>();
  private jumpPressed = false;
  private pausePressed = false;

  constructor(private readonly bindings: KeyBindings = KEY_BINDINGS) {}

  keyDown(code: string, repeat = false): void {
    // La repetición automática del sistema también confirma que la tecla sigue apretada
    // (sirve para recuperar teclas mantenidas después de una pausa).
    this.held.add(code);
    if (repeat) return;
    if (this.bindings.jump.includes(code)) this.jumpPressed = true;
    if (this.bindings.pause.includes(code)) this.pausePressed = true;
  }

  keyUp(code: string): void {
    this.held.delete(code);
  }

  isHeld(action: InputAction): boolean {
    return this.bindings[action].some((code) => this.held.has(code));
  }

  /** Vector de movimiento: cada eje vale -1, 0 o 1 (teclas opuestas se anulan). */
  direction(): { x: number; y: number } {
    const x = (this.isHeld('right') ? 1 : 0) - (this.isHeld('left') ? 1 : 0);
    const y = (this.isHeld('down') ? 1 : 0) - (this.isHeld('up') ? 1 : 0);
    return { x, y };
  }

  consumeJumpPress(): boolean {
    const v = this.jumpPressed;
    this.jumpPressed = false;
    return v;
  }

  consumePausePress(): boolean {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }

  /** Teclas que el navegador informa como apretadas (útil para diagnosticar ghosting). */
  heldCodes(): string[] {
    return [...this.held];
  }

  clear(): void {
    this.held.clear();
    this.jumpPressed = false;
    this.pausePressed = false;
  }
}

/**
 * "Salto anticipado": si se pide saltar un poquito antes de tocar el piso,
 * el salto se respeta al aterrizar.
 */
export class JumpBuffer {
  private remaining = 0;

  constructor(private readonly window: number) {}

  request(): void {
    this.remaining = this.window;
  }

  update(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt);
  }

  get pending(): boolean {
    return this.remaining > 0;
  }

  consume(): boolean {
    if (this.remaining <= 0) return false;
    this.remaining = 0;
    return true;
  }

  clear(): void {
    this.remaining = 0;
  }
}
