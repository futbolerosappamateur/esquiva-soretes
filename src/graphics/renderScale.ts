import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { isTouchPrimary } from '../input/device';
import {
  forcedScale,
  isSoftwareRenderer,
  MIN_ADAPTIVE_SCALE,
  pickAssetScale,
  pickRenderScale,
  scaleForFps,
  webglRendererName,
  type ScaleInput,
} from './renderScaleDetect';

/**
 * Resolución interna del dibujo.
 *
 * El juego se diseña en 480×270: todas las posiciones, tamaños, textos y
 * cuentas usan esas unidades. Pero se DIBUJA con tantos píxeles como tiene la
 * zona de la pantalla donde se ve (hasta 2880×1620): en una pantalla de 1920
 * cada unidad del juego son 4×4 píxeles, así las letras y los dibujos
 * definitivos se ven nítidos en una pantalla grande en vez de estirados. Si
 * cambia el tamaño de la ventana (o se pasa a pantalla completa), cambia la
 * resolución y el diseño sigue igual.
 *
 * Cómo: todas las cámaras tienen zoom = escala, con origen arriba a la
 * izquierda, así `scrollX` sigue siendo el borde izquierdo de la pantalla.
 * Con ese origen, los límites automáticos de Phaser (`setBounds`) y
 * `worldView` no coinciden con lo visible: el juego limita la cámara a mano
 * (CameraController) y no usa `worldView`.
 *
 * - Topes: 2880×1620 con placa de video aparte, 1920×1080 con placa integrada
 *   (Intel) y 1440×810 en celulares. Más grande, el navegador agranda el lienzo.
 * - Sin placa de video (dibujo por software: compus viejas o con la aceleración
 *   desactivada) se usa la resolución original, 480×270, para no ir lento.
 * - Si el equipo no llega a dibujar fluido, la resolución baja sola (nunca
 *   por debajo de 960×540).
 * - `?scale=N` en la dirección la fija (de 1 a 8): sirve para comparar.
 */

const renderer = typeof document === 'undefined' ? '' : webglRendererName();
const search = typeof location === 'undefined' ? '' : location.search;
const touch = typeof window !== 'undefined' && isTouchPrimary();
/** Resolución fija: forzada por la dirección o por dibujar sin placa de video. */
const fixed = forcedScale(search) !== null || isSoftwareRenderer(renderer);
/** Límite que baja el control de velocidad (dura lo que dura la página abierta). */
let cap = Infinity;

function viewArea(game?: Phaser.Game): { viewW: number; viewH: number; dpr: number } {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const el = game?.canvas?.parentElement ?? (typeof document === 'undefined' ? null : document.getElementById('game'));
  const rect = el?.getBoundingClientRect();
  const viewW = rect && rect.width > 0 ? rect.width : typeof window === 'undefined' ? GAME_WIDTH : window.innerWidth;
  const viewH = rect && rect.height > 0 ? rect.height : typeof window === 'undefined' ? GAME_HEIGHT : window.innerHeight;
  return { viewW, viewH, dpr };
}

function input(game?: Phaser.Game): ScaleInput {
  return { search, renderer, touch, cap, ...viewArea(game) };
}

let current = pickRenderScale(input());

/**
 * Detalle de los gráficos de interfaz que se dibujan una sola vez (paneles,
 * botones): se muestran a escala 1/ASSET_SCALE (ver `fitToTexture`).
 */
export const ASSET_SCALE = (() => {
  const { viewW, viewH, dpr } = viewArea();
  const screenW = typeof screen === 'undefined' ? viewW : screen.width;
  const screenH = typeof screen === 'undefined' ? viewH : screen.height;
  return pickAssetScale({ search, touch, screenW, screenH, viewW, viewH, dpr });
})();

/** Escala actual: píxeles del lienzo por unidad del juego. */
export function renderScale(): number {
  return current;
}

type Listener = (scale: number, previous: number) => void;
const listeners = new Set<Listener>();

/** Avisa cuando cambia la resolución (por ejemplo, para volver a dibujar las letras). */
export function onRenderScaleChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let installed = false;

/** Aplica el zoom a todas las cámaras de todas las escenas (se llama una vez, antes de crear el juego). */
export function installRenderScale(): void {
  if (installed) return;
  installed = true;
  type Add = (...args: unknown[]) => Phaser.Cameras.Scene2D.Camera;
  const proto = Phaser.Cameras.Scene2D.CameraManager.prototype as unknown as { add: Add };
  const add = proto.add;
  proto.add = function (this: unknown, ...args: unknown[]) {
    const cam = add.apply(this, args);
    cam.setOrigin(0, 0);
    cam.setZoom(current);
    return cam;
  };
}

/** Tamaño del lienzo para una escala (siempre 16:9 exacto). */
export function canvasSizeFor(scale: number): { width: number; height: number } {
  return { width: Math.round(GAME_WIDTH * scale), height: Math.round(GAME_HEIGHT * scale) };
}

function applyScale(game: Phaser.Game, next: number): void {
  const previous = current;
  current = next;
  const { width, height } = canvasSizeFor(next);
  game.scale.setGameSize(width, height);
  for (const scene of game.scene.scenes) {
    for (const cam of scene.sys.cameras?.cameras ?? []) cam.setZoom(next);
  }
  listeners.forEach((fn) => fn(next, previous));
}

/**
 * Filtro con el que el navegador agranda el lienzo: suave si lo muestra casi
 * a su tamaño (letras y dibujos nítidos), por píxeles si lo estira mucho
 * (resolución baja: el pixel art no se empasta).
 */
function updateSmoothing(game: Phaser.Game): void {
  const canvas = game.canvas;
  if (!canvas || canvas.width <= 0) return;
  const shown = game.scale.displaySize.width * (window.devicePixelRatio || 1);
  canvas.style.imageRendering = shown / canvas.width >= 1.5 ? 'pixelated' : 'auto';
}

/** Cuadros por segundo por debajo de los cuales se baja la resolución (durante la partida). */
const SLOW_FPS = 50;
const SLOW_SECONDS = 3;

/**
 * Sigue el tamaño de la ventana y la fluidez del juego (se llama una vez,
 * después de crear el juego).
 */
export function watchRenderScale(game: Phaser.Game): void {
  let timer = 0;
  const check = () => {
    timer = 0;
    if (!fixed) {
      const next = pickRenderScale(input(game));
      if (next !== current) applyScale(game, next);
    }
    updateSmoothing(game);
  };
  const schedule = () => {
    if (!timer) timer = window.setTimeout(check, 150);
  };
  window.addEventListener('resize', schedule);
  game.scale.on(Phaser.Scale.Events.RESIZE, schedule);
  game.events.once(Phaser.Core.Events.READY, check);

  if (fixed) return;
  let slow: number[] = [];
  let wait = 0;
  window.setInterval(() => {
    if (document.hidden || !game.scene.isActive(SCENES.GAME)) {
      slow = [];
      return;
    }
    if (wait > 0) {
      wait--;
      return;
    }
    const fps = game.loop.actualFps;
    slow = current > MIN_ADAPTIVE_SCALE && fps > 0 && fps < SLOW_FPS ? [...slow, fps] : [];
    if (slow.length >= SLOW_SECONDS) {
      // Baja de una vez lo necesario (según cuánto le faltaba) y espera a que se acomode.
      const avg = slow.reduce((a, b) => a + b, 0) / slow.length;
      slow = [];
      wait = 3;
      cap = scaleForFps(current, avg);
      console.info(`[esquiva] el juego iba a ${Math.round(avg)} cuadros por segundo: resolución interna ${cap.toFixed(2)}×`);
      check();
    }
  }, 1000);
}

/** Posición de un puntero en unidades del juego (480×270), para escenas con la cámara quieta. */
export function logicalPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / current, y: p.y / current };
}

/**
 * Escala con la que se muestra una textura dibujada con más detalle (el atlas
 * declara `meta.displayScale`, por ejemplo 0,5 para cuadros dibujados al doble).
 */
export function displayScaleOf(texture: Phaser.Textures.Texture | null | undefined): number {
  const meta = (texture?.customData as { meta?: { displayScale?: unknown } } | undefined)?.meta;
  const s = meta?.displayScale;
  return typeof s === 'number' && s > 0 ? s : 1;
}

/** Ajusta la escala de un sprite según el detalle de su textura (multiplica una escala base). */
export function fitToTexture<T extends Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>(obj: T, base = 1): T {
  obj.setScale(base * displayScaleOf(obj.texture));
  return obj;
}
