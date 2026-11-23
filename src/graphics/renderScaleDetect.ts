/**
 * Elección de la resolución interna (ver renderScale.ts). Sin Phaser, para poder
 * probarla sin navegador.
 *
 * El juego se diseña en 480×270 (16:9) y se dibuja a 16k × 9k píxeles: la
 * escala es k/30 (480 = 16 × 30). Así el lienzo siempre mantiene exactamente
 * la proporción del diseño y el zoom de las cámaras da números redondos.
 */

/** Ancho y alto del diseño (unidades del juego). */
const BASE_W = 480;
const BASE_H = 270;
/** Pasos de la escala: 1/30 (el lienzo crece de a 16×9 píxeles). */
const STEPS = 30;

/** Escala máxima en una compu: 2880×1620 (cubre pantallas de 2560 y casi toda una 4K). */
export const MAX_SCALE_DESKTOP = 6;
/**
 * Con placa de video integrada (Intel, la de un celular): 1920×1080. Medido en
 * una Intel Iris Xe: 60 cuadros por segundo a 1920×1080, 33 a 2560×1440.
 */
export const MAX_SCALE_INTEGRATED = 4;
/** En celulares y tablets: 1440×810. En una pantalla chica no se nota más detalle y gasta batería. */
export const MAX_SCALE_TOUCH = 3;
/** Piso del control de velocidad: nunca baja de la resolución que tenía el juego antes (960×540). */
export const MIN_ADAPTIVE_SCALE = 2;

/**
 * Escala para que un equipo que dibuja a `fps` cuadros por segundo llegue a
 * unos 58: el trabajo crece con la cantidad de píxeles (escala al cuadrado),
 * con un 5 % de margen. Nunca sube ni baja del piso.
 */
export function scaleForFps(current: number, fps: number): number {
  const target = current * Math.sqrt(Math.max(1, fps) / 58) * 0.95;
  return Math.max(MIN_ADAPTIVE_SCALE, Math.min(current, Math.floor(target * 30) / 30));
}

/** Lleva una escala al paso más cercano (k/30). */
export function quantizeScale(scale: number): number {
  return Math.round(scale * STEPS) / STEPS;
}

/** `?scale=N` (de 1 a 8, admite decimales) fija la resolución: sirve para comparar y para las pruebas. */
export function forcedScale(search: string): number | null {
  const raw = new URLSearchParams(search).get('scale');
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 8) return null;
  return quantizeScale(n);
}

/** ¿Placa de video integrada (comparte la memoria con el procesador)? */
export function isIntegratedGpu(name: string): boolean {
  return /intel|mali|adreno|powervr|vivante|videocore/i.test(name);
}

/** ¿El navegador dibuja sin placa de video (por software)? */
export function isSoftwareRenderer(name: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/**
 * Escala para que el lienzo tenga tantos píxeles como la zona donde se ve:
 * el juego ocupa el mayor rectángulo 16:9 que entra en `viewW`×`viewH` (en
 * píxeles CSS) y la pantalla tiene `dpr` píxeles físicos por píxel CSS.
 */
export function fitScale(viewW: number, viewH: number, dpr: number, maxScale: number): number {
  const w = Math.max(1, Math.min(viewW, (viewH * BASE_W) / BASE_H)) * Math.max(0.5, dpr || 1);
  const k = Math.round(w / (BASE_W / STEPS));
  const maxK = Math.max(STEPS, Math.floor(maxScale * STEPS));
  return Math.min(maxK, Math.max(STEPS, k)) / STEPS;
}

export interface ScaleInput {
  /** location.search */
  search: string;
  /** Nombre de la placa que usa WebGL ('' si no se sabe). */
  renderer: string;
  /** ¿El puntero principal es un dedo (celular o tablet)? */
  touch: boolean;
  /** Tamaño de la zona del juego en píxeles CSS. */
  viewW: number;
  viewH: number;
  /** devicePixelRatio */
  dpr: number;
  /** Límite extra (lo baja el control de velocidad si el equipo no da abasto). */
  cap?: number;
}

/** Resolución interna para el tamaño actual de la ventana. */
export function pickRenderScale(i: ScaleInput): number {
  const forced = forcedScale(i.search);
  if (forced !== null) return forced;
  if (isSoftwareRenderer(i.renderer)) return 1;
  const device = i.touch ? MAX_SCALE_TOUCH : isIntegratedGpu(i.renderer) ? MAX_SCALE_INTEGRATED : MAX_SCALE_DESKTOP;
  const max = Math.min(device, i.cap ?? Infinity);
  return fitScale(i.viewW, i.viewH, i.dpr, max);
}

export interface AssetScaleInput {
  search: string;
  touch: boolean;
  /** Pantalla completa (screen.width/height) y zona actual, en píxeles CSS. */
  screenW: number;
  screenH: number;
  viewW: number;
  viewH: number;
  dpr: number;
}

/**
 * Detalle de los gráficos de interfaz que se dibujan una sola vez (paneles y
 * botones): el que necesita la pantalla completa, para que no se vean borrosos
 * si después se agranda la ventana. Entre 2 y 4 (3 en celulares) para no
 * gastar memoria de más.
 */
export function pickAssetScale(i: AssetScaleInput): number {
  const forced = forcedScale(i.search);
  const max = i.touch ? 3 : 4;
  if (forced !== null) return Math.min(max, Math.max(1, Math.ceil(forced - 0.01)));
  const w = Math.max(i.screenW, i.viewW);
  const h = Math.max(i.screenH, i.viewH);
  const s = Math.min(w / BASE_W, h / BASE_H) * Math.max(0.5, i.dpr || 1);
  return Math.min(max, Math.max(2, Math.ceil(s - 0.05)));
}

let rendererCache: string | null = null;

/** Nombre de la placa que usa WebGL ('' si no se puede saber). */
export function webglRendererName(): string {
  if (rendererCache === null) rendererCache = queryRenderer();
  return rendererCache;
}

function queryRenderer(): string {
  if (typeof document === 'undefined') return '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/** Resolución máxima a la que dibuja este equipo (manda en el detalle de los dibujos que se descargan). */
export function deviceMaxScale(i: { search: string; renderer: string; touch: boolean }): number {
  const forced = forcedScale(i.search);
  if (forced !== null) return forced;
  if (isSoftwareRenderer(i.renderer)) return 1;
  return i.touch ? MAX_SCALE_TOUCH : isIntegratedGpu(i.renderer) ? MAX_SCALE_INTEGRATED : MAX_SCALE_DESKTOP;
}

/** De los detalles en que viene un dibujo, el más chico que alcanza (o el más grande, si ninguno alcanza). */
export function pickArtScale(available: number[], need: number): number {
  const sorted = [...available].sort((a, b) => a - b);
  return sorted.find((s) => s >= need - 1e-6) ?? sorted[sorted.length - 1];
}

/** ¿El puntero principal es un dedo? (sin romper fuera del navegador). */
export function touchPrimary(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/** Detalle de los dibujos definitivos para este equipo: 192 px por cuadro con placa integrada o en el celular, 288 con placa aparte. */
export function detectArtScale(available: number[]): number {
  const search = typeof location === 'undefined' ? '' : location.search;
  return pickArtScale(available, deviceMaxScale({ search, renderer: webglRendererName(), touch: touchPrimary() }));
}
