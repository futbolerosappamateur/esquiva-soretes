import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS } from '../src/config/controls';
import { KeyboardInputState } from '../src/input/KeyboardInputState';

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const WASD = ['KeyA', 'KeyD', 'KeyW', 'KeyS'];

/** Todas las combinaciones de teclas de dirección apretadas (16 por juego de teclas). */
function subsets(keys: string[]): string[][] {
  const out: string[][] = [];
  for (let mask = 0; mask < 1 << keys.length; mask++) out.push(keys.filter((_, i) => mask & (1 << i)));
  return out;
}

describe('KeyboardInputState', () => {
  for (const [name, keys] of [
    ['flechas', ARROWS],
    ['WASD', WASD],
  ] as const) {
    it(`registra el salto con cualquier combinación de ${name} apretadas`, () => {
      for (const held of subsets(keys)) {
        for (const jumpKey of KEY_BINDINGS.jump) {
          const s = new KeyboardInputState();
          held.forEach((k) => s.keyDown(k));
          s.keyDown(jumpKey);
          expect(s.consumeJumpPress(), `${held.join('+') || 'nada'} + ${jumpKey}`).toBe(true);
          // Se consume una sola vez.
          expect(s.consumeJumpPress()).toBe(false);
        }
      }
    });
  }

  it('calcula la dirección y anula teclas opuestas', () => {
    const s = new KeyboardInputState();
    s.keyDown('ArrowDown');
    s.keyDown('ArrowRight');
    expect(s.direction()).toEqual({ x: 1, y: 1 });
    s.keyDown('KeyA');
    expect(s.direction()).toEqual({ x: 0, y: 1 });
    s.keyUp('ArrowRight');
    expect(s.direction()).toEqual({ x: -1, y: 1 });
    s.keyDown('KeyW');
    expect(s.direction()).toEqual({ x: -1, y: 0 });
  });

  it('el salto no altera la dirección y la dirección no altera el salto', () => {
    const s = new KeyboardInputState();
    s.keyDown('ArrowDown');
    s.keyDown('ArrowLeft');
    s.keyDown('Space');
    expect(s.direction()).toEqual({ x: -1, y: 1 });
    expect(s.consumeJumpPress()).toBe(true);
    s.keyUp('Space');
    expect(s.direction()).toEqual({ x: -1, y: 1 });
  });

  it('un toque rapidísimo (keydown + keyup en el mismo cuadro) igual cuenta', () => {
    const s = new KeyboardInputState();
    s.keyDown('Space');
    s.keyUp('Space');
    expect(s.consumeJumpPress()).toBe(true);
  });

  it('la repetición automática no genera saltos extra pero mantiene la tecla', () => {
    const s = new KeyboardInputState();
    s.keyDown('Space');
    expect(s.consumeJumpPress()).toBe(true);
    s.keyDown('Space', true);
    s.keyDown('Space', true);
    expect(s.consumeJumpPress()).toBe(false);
    s.clear();
    s.keyDown('ArrowRight', true);
    expect(s.direction()).toEqual({ x: 1, y: 0 });
  });

  it('pausa con Escape o P', () => {
    const s = new KeyboardInputState();
    s.keyDown('KeyP');
    expect(s.consumePausePress()).toBe(true);
    s.keyDown('Escape');
    expect(s.consumePausePress()).toBe(true);
    expect(s.consumePausePress()).toBe(false);
  });
});
