/**
 * Pantalla de carga de la página (está en index.html): se ve desde el primer
 * instante, mientras bajan el código del juego y los dibujos, y se saca cuando
 * el juego ya puede mostrar su propia barra de progreso.
 */
export function setLoadingProgress(fraction: number): void {
  const hint = typeof document !== 'undefined' ? document.querySelector('#loading .hint') : null;
  if (hint) hint.textContent = `CARGANDO… ${Math.round(Math.min(1, Math.max(0, fraction)) * 100)} %`;
}

export function hideLoadingScreen(): void {
  if (typeof document !== 'undefined') document.getElementById('loading')?.remove();
}
