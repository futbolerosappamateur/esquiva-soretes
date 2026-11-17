/**
 * Phaser vuelve a procesar toda la cola de teclas con cada evento del
 * navegador que llega dentro del mismo cuadro. Para las teclas que no tienen
 * un objeto Key registrado, eso hace que un mismo KeyboardEvent llegue varias
 * veces a los oyentes de "keydown" (escribir rápido "LUCIA" daba "LUUCUCIIAI").
 *
 * Este envoltorio deja pasar cada evento una sola vez.
 */
export function uniqueKeyEvents(handler: (event: KeyboardEvent) => void): (event: KeyboardEvent) => void {
  const seen = new WeakSet<KeyboardEvent>();
  return (event: KeyboardEvent) => {
    if (seen.has(event)) return;
    seen.add(event);
    handler(event);
  };
}
