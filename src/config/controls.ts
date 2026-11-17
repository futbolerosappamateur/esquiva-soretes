/**
 * Asignación de teclas (códigos físicos `KeyboardEvent.code`, así WASD funciona
 * igual en teclados QWERTY, AZERTY o en español).
 *
 * El salto tiene teclas alternativas a propósito: muchos teclados de membrana
 * (sobre todo de notebooks) no registran la barra espaciadora cuando ya hay
 * dos flechas apretadas, típicamente Abajo + Izquierda/Derecha ("ghosting").
 * X, J y K quedan en otras filas de la matriz del teclado y no tienen ese problema.
 */
export const KEY_BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyX', 'KeyJ', 'KeyK'],
  /** Habilidad especial del personaje. */
  special: ['KeyE'],
  pause: ['Escape', 'KeyP'],
  /** Reinicio rápido (sólo en contrarreloj). */
  restart: ['KeyR'],
} as const satisfies Record<string, readonly string[]>;

export type InputAction = keyof typeof KEY_BINDINGS;
export type KeyBindings = Record<InputAction, readonly string[]>;
