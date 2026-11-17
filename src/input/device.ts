/**
 * ¿El dispositivo se usa principalmente con el dedo? (celulares y tablets).
 * Una PC con pantalla táctil y mouse devuelve false: ahí los controles
 * táctiles aparecen recién cuando se toca la pantalla.
 */
export function isTouchPrimary(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
