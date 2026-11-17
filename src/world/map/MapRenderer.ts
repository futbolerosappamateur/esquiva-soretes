import Phaser from 'phaser';
import { hexToRgb, mix, shade } from '../../graphics/color';
import { PixelCanvas } from '../../graphics/PixelCanvas';
import { normalizeName } from '../../data/campaign';
import type { MapRaster, ProjectedMap } from './geo';

export type BarrioStatus = 'locked' | 'next' | 'available' | 'completed';

export interface BarrioVisual {
  status: BarrioStatus;
  /** 0..1 durante la animación de desbloqueo (de gris a color). */
  unlockT?: number;
}

/** Colores por comuna (con una variación por barrio para distinguir vecinos). */
const COMUNA_COLORS = [
  '#c9b48a', '#e8a04f', '#d96f8f', '#a77fd9', '#6fb3d9', '#7fd98f', '#d9c45f', '#e07a5f',
  '#8fc46f', '#c48fd9', '#5fbfb0', '#d9945f', '#9fb0e0', '#e0b07f', '#7fcf9f', '#cf8faf',
];
const LOCKED_GRAY = '#7d7488';
/** Barrios con costa sobre el Río de la Plata (para dibujar el río del lado este). */
const COASTAL = new Set(['NUNEZ', 'BELGRANO', 'PALERMO', 'RECOLETA', 'RETIRO', 'PUERTO MADERO', 'LA BOCA'].map(normalizeName));

const WATER = hexToRgb('#3a6fc4');
const WATER_LIGHT = hexToRgb('#5a8fe0');
const LAND = hexToRgb('#5d7a4e');
const LAND_DARK = hexToRgb('#566f48');
const OUTLINE = hexToRgb('#21142b');
const BORDER = hexToRgb('#3b2741');

/**
 * Dibuja el mapa de la Ciudad en una textura de canvas: fondo (río y
 * provincia, decorativos) y cada barrio pintado según su estado.
 */
export class MapRenderer {
  readonly texture: Phaser.Textures.CanvasTexture;
  private readonly base: Uint8ClampedArray;
  private readonly colors: [number, number, number][];

  constructor(
    textures: Phaser.Textures.TextureManager,
    key: string,
    readonly map: ProjectedMap,
    readonly raster: MapRaster,
  ) {
    if (textures.exists(key)) textures.remove(key);
    const tex = textures.createCanvas(key, raster.width, raster.height);
    if (!tex) throw new Error('No se pudo crear la textura del mapa');
    this.texture = tex;
    this.base = this.drawBackground();
    this.colors = map.barrios.map((b, i) => {
      const c = COMUNA_COLORS[b.comuna % COMUNA_COLORS.length];
      return hexToRgb(shade(c, ((i % 3) - 1) * 0.07));
    });
  }

  /** Río de la Plata al este, Riachuelo al sur y provincia alrededor (aproximado, decorativo). */
  private drawBackground(): Uint8ClampedArray {
    const { width: W, height: H, ids, eastEdge } = this.raster;
    const data = new Uint8ClampedArray(W * H * 4);
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < H; y++) if (eastEdge[y] >= 0) {
      if (top < 0) top = y;
      bottom = y;
    }
    // Último renglón con costa sobre el río (de ahí para abajo la orilla es la provincia).
    const coastal = (y: number) => {
      const x = eastEdge[y];
      if (x < 0) return false;
      const id = ids[y * W + x];
      return id > 0 && COASTAL.has(this.map.barrios[id - 1].key);
    };
    let lastCoast = top;
    for (let y = top; y <= bottom; y++) if (coastal(y)) lastCoast = y;
    const waterFrom = (y: number): number => {
      if (top < 0) return W;
      if (y < top) return eastEdge[top] - (top - y) * 0.9 + 2;
      if (y <= lastCoast) return coastal(y) ? eastEdge[y] + 2 : eastEdge[y] + 4;
      return eastEdge[lastCoast] + (y - lastCoast) * 0.7 + 6;
    };
    for (let y = 0; y < H; y++) {
      const wx = waterFrom(y);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        let c = (x + y) % 2 === 0 ? LAND : LAND_DARK;
        if (x >= wx && ids[y * W + x] === 0) c = (x * 7 + y * 13) % 23 === 0 ? WATER_LIGHT : WATER;
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
        data[i + 3] = 255;
      }
    }
    // Riachuelo: franja de agua debajo del borde sur de la ciudad.
    for (let y = Math.floor(H * 0.55); y < H - 2; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (ids[p] === 0 || ids[p + W] !== 0) continue;
        for (const dy of [1, 2]) {
          const q = (p + W * dy) * 4;
          if (ids[p + W * dy] !== 0) break;
          data[q] = WATER[0];
          data[q + 1] = WATER[1];
          data[q + 2] = WATER[2];
        }
      }
    }
    return data;
  }

  private colorFor(index: number, v: BarrioVisual): [number, number, number] {
    const c = this.colors[index];
    const gray = hexToRgb(LOCKED_GRAY);
    const lockedMix = v.status === 'next' ? 0.55 : 0.78;
    const t = v.status === 'locked' || v.status === 'next' ? lockedMix * (1 - (v.unlockT ?? 0)) : 0;
    return [Math.round(c[0] + (gray[0] - c[0]) * t), Math.round(c[1] + (gray[1] - c[1]) * t), Math.round(c[2] + (gray[2] - c[2]) * t)];
  }

  /** Repinta el mapa con el estado de cada barrio. */
  compose(visuals: BarrioVisual[]): void {
    const { width: W, height: H, ids } = this.raster;
    const ctx = this.texture.getContext();
    const img = ctx.createImageData(W, H);
    const d = img.data;
    d.set(this.base);
    const fills = visuals.map((v, i) => this.colorFor(i, v));
    const darker = fills.map((c) => {
      const s = hexToRgb(shade(`#${[c[0], c[1], c[2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`, -0.12));
      return s;
    });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        const id = ids[p];
        if (id === 0) {
          // Contorno de la ciudad.
          const near = (x > 0 && ids[p - 1]) || (x < W - 1 && ids[p + 1]) || (y > 0 && ids[p - W]) || (y < H - 1 && ids[p + W]);
          if (near) {
            const i = p * 4;
            d[i] = OUTLINE[0];
            d[i + 1] = OUTLINE[1];
            d[i + 2] = OUTLINE[2];
          }
          continue;
        }
        const i = p * 4;
        const border = (x < W - 1 && ids[p + 1] !== id) || (y < H - 1 && ids[p + W] !== id);
        const v = visuals[id - 1];
        const locked = v.status === 'locked' || v.status === 'next';
        // Tramado de 16 bits: los bloqueados quedan con textura de "papel viejo".
        const dither = locked && (v.unlockT ?? 0) < 0.5 && (x + y) % 2 === 0;
        const c = border ? BORDER : dither ? darker[id - 1] : fills[id - 1];
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
      }
    }
    ctx.putImageData(img, 0, 0);
    this.texture.refresh();
  }

  /** Pinta los nombres decorativos del río y la provincia sobre la textura. */
  decorate(labels: { text: string; x: number; y: number; color: string }[]): void {
    const pc = new PixelCanvas(this.raster.width, this.raster.height);
    for (const l of labels) pc.textCentered(l.text, l.x, l.y, l.color);
    this.texture.getContext().drawImage(pc.canvas, 0, 0);
    this.texture.refresh();
  }

  /** Lienzo con el contorno de un barrio (para resaltar la selección). */
  outlineCanvas(index: number, color: string): { canvas: HTMLCanvasElement; x: number; y: number } | null {
    const { width: W, height: H, ids } = this.raster;
    const id = index + 1;
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ids[y * W + x] === id) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    if (x1 < 0) return null;
    const pc = new PixelCanvas(x1 - x0 + 3, y1 - y0 + 3);
    const inner = mix(color, '#ffffff', 0.5);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = y * W + x;
        if (ids[p] !== id) continue;
        const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1 || ids[p - 1] !== id || ids[p + 1] !== id || ids[p - W] !== id || ids[p + W] !== id;
        if (edge) pc.px(x - x0 + 1, y - y0 + 1, color);
        else if ((x + y) % 4 === 0) pc.px(x - x0 + 1, y - y0 + 1, `${inner}55`);
      }
    }
    return { canvas: pc.canvas, x: x0 - 1, y: y0 - 1 };
  }
}
