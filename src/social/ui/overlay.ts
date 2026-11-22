import type Phaser from 'phaser';
import { h } from './dom';
import './social.css';

/**
 * Capa HTML encima del juego para los formularios online (correo,
 * contraseña, apodo): campos de texto nativos, teclado del celular y gestor
 * de contraseñas. Vive dentro de #game para verse también en pantalla
 * completa. Mientras está abierta, el teclado de Phaser se apaga para que las
 * teclas lleguen a los campos.
 */
let game: Phaser.Game | null = null;
let root: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let onClose: (() => void) | null = null;
let onEscape: (() => void) | null = null;

export function attachOverlay(g: Phaser.Game): void {
  game = g;
}

export function overlayGame(): Phaser.Game | null {
  return game;
}

export function isPanelOpen(): boolean {
  return root !== null;
}

const handleKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
  (onEscape ?? closePanel)();
};

/** Abre (o reutiliza) el panel. `onClose` se llama al cerrarlo. */
export function openPanel(opts: { onClose?: () => void } = {}): void {
  if (!root) {
    const host = document.getElementById('game') ?? document.body;
    panel = h('div', { class: 'es-panel' });
    root = h('div', { class: 'es-overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cuenta online' } }, panel);
    // Un toque fuera del panel no debe llegar al juego.
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    host.append(root);
    setGameKeyboard(false);
    window.addEventListener('keydown', handleKey, true);
  }
  if (opts.onClose) onClose = opts.onClose;
}

/** Reemplaza el contenido del panel. `escape` = qué hace la tecla Esc en esta pantalla. */
export function renderPanel(content: (Node | null | undefined | false)[], escape?: () => void): void {
  if (!panel) return;
  onEscape = escape ?? null;
  panel.replaceChildren(...content.filter((n): n is Node => !!n));
  panel.scrollTop = 0;
  const first = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=radio])');
  first?.focus({ preventScroll: true });
}

export function closePanel(): void {
  if (!root) return;
  window.removeEventListener('keydown', handleKey, true);
  root.remove();
  root = null;
  panel = null;
  onEscape = null;
  setGameKeyboard(true);
  const cb = onClose;
  onClose = null;
  cb?.();
}

function setGameKeyboard(enabled: boolean): void {
  const kb = game?.input.keyboard;
  if (!kb) return;
  kb.enabled = enabled;
  // Teclas que quedaron "apretadas" mientras se escribía: se sueltan.
  if (enabled) game?.scene.getScenes(true).forEach((s) => s.input.keyboard?.resetKeys());
}
