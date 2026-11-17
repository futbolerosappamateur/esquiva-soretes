import Phaser from 'phaser';
import { hexToRgb } from './color';
import { getGlyph, GLYPH_BODY_TOP, GLYPH_SPACING, measureText } from './fontData';

/** Paleta para mapas de caracteres: cada letra del mapa apunta a un color. */
export type CharPalette = Record<string, string | undefined>;

export interface FrameRect {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lienzo de pixel art. Todas las operaciones trabajan en píxeles enteros para
 * que las texturas generadas por código se vean nítidas al escalar.
 */
export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('El navegador no soporta Canvas 2D');
    ctx.imageSmoothingEnabled = false;
    this.canvas = canvas;
    this.ctx = ctx;
  }

  rect(x: number, y: number, w: number, h: number, color: string): this {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(x + w) - rx;
    const rh = Math.round(y + h) - ry;
    if (rw <= 0 || rh <= 0) return this;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(rx, ry, rw, rh);
    return this;
  }

  px(x: number, y: number, color: string): this {
    return this.rect(x, y, 1, 1, color);
  }

  clear(x = 0, y = 0, w = this.width, h = this.height): this {
    this.ctx.clearRect(x, y, w, h);
    return this;
  }

  hline(x: number, y: number, length: number, color: string): this {
    return this.rect(x, y, length, 1, color);
  }

  vline(x: number, y: number, length: number, color: string): this {
    return this.rect(x, y, 1, length, color);
  }

  /** Línea de Bresenham con grosor opcional (cuadrado de lado `thickness`). */
  line(x0: number, y0: number, x1: number, y1: number, color: string, thickness = 1): this {
    let ax = Math.round(x0);
    let ay = Math.round(y0);
    const bx = Math.round(x1);
    const by = Math.round(y1);
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((thickness - 1) / 2);
    this.ctx.fillStyle = color;
    for (let guard = 0; guard < 2048; guard++) {
      this.ctx.fillRect(ax - off, ay - off, thickness, thickness);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ax += sx;
      }
      if (e2 <= dx) {
        err += dx;
        ay += sy;
      }
    }
    return this;
  }

  /** Elipse rellena definida por su caja (x, y, ancho, alto). */
  ellipse(x: number, y: number, w: number, h: number, color: string): this {
    const rx = w / 2;
    const ry = h / 2;
    for (let j = 0; j < h; j++) {
      const dy = j + 0.5 - ry;
      const t = 1 - (dy * dy) / (ry * ry);
      if (t <= 0) continue;
      const half = rx * Math.sqrt(t);
      const xs = Math.round(rx - half);
      const xe = Math.round(rx + half);
      this.rect(x + xs, y + j, xe - xs, 1, color);
    }
    return this;
  }

  /** Borde de una elipse (1 px). */
  ellipseRing(x: number, y: number, w: number, h: number, color: string): this {
    const tmp = new PixelCanvas(w + 2, h + 2);
    tmp.ellipse(1, 1, w, h, '#ffffff');
    const inner = new PixelCanvas(w + 2, h + 2);
    inner.ellipse(2, 2, w - 2, h - 2, '#ffffff');
    const a = tmp.ctx.getImageData(0, 0, w + 2, h + 2).data;
    const b = inner.ctx.getImageData(0, 0, w + 2, h + 2).data;
    for (let j = 0; j < h + 2; j++) {
      for (let i = 0; i < w + 2; i++) {
        const k = (j * (w + 2) + i) * 4 + 3;
        if (a[k] > 0 && b[k] === 0) this.px(x + i - 1, y + j - 1, color);
      }
    }
    return this;
  }

  /** Disco centrado en (cx, cy). */
  disc(cx: number, cy: number, r: number, color: string): this {
    return this.ellipse(cx - r, cy - r, r * 2, r * 2, color);
  }

  /**
   * Dibuja un mapa de caracteres. Los caracteres sin color en la paleta
   * (por ejemplo '.') se dejan transparentes.
   */
  map(x: number, y: number, rows: readonly string[], palette: CharPalette, flipX = false): this {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const color = palette[row[i]];
        if (!color) continue;
        const px = flipX ? x + row.length - 1 - i : x + i;
        this.px(px, y + j, color);
      }
    }
    return this;
  }

  /** Patrón de tablero de ajedrez (tramado típico de 16 bits). */
  dither(x: number, y: number, w: number, h: number, color: string, phase = 0): this {
    this.ctx.fillStyle = color;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if ((i + j + phase) % 2 === 0) this.ctx.fillRect(x + i, y + j, 1, 1);
      }
    }
    return this;
  }

  /** Salpica píxeles sueltos de colores con una densidad dada (0..1). */
  speckle(x: number, y: number, w: number, h: number, colors: readonly string[], density: number, rnd: () => number): this {
    const count = Math.round(w * h * density);
    for (let n = 0; n < count; n++) {
      const px = x + Math.floor(rnd() * w);
      const py = y + Math.floor(rnd() * h);
      this.px(px, py, colors[Math.floor(rnd() * colors.length)]);
    }
    return this;
  }

  /** Degradé vertical en bandas, con una fila tramada entre bandas. */
  bands(x: number, y: number, w: number, h: number, colors: readonly string[]): this {
    const n = colors.length;
    const bandH = h / n;
    for (let b = 0; b < n; b++) {
      const by = Math.round(y + b * bandH);
      const bh = Math.round(y + (b + 1) * bandH) - by;
      this.rect(x, by, w, bh, colors[b]);
      if (b > 0) this.dither(x, by, w, 1, colors[b - 1]);
      if (b > 0 && bh > 3) this.dither(x, by + 1, w, 1, colors[b - 1], 1);
    }
    return this;
  }

  /** Copia otro lienzo (opcionalmente espejado horizontalmente). */
  draw(source: PixelCanvas | HTMLCanvasElement, x: number, y: number, flipX = false): this {
    const src = source instanceof PixelCanvas ? source.canvas : source;
    if (!flipX) {
      this.ctx.drawImage(src, Math.round(x), Math.round(y));
    } else {
      this.ctx.save();
      this.ctx.translate(Math.round(x) + src.width, Math.round(y));
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(src, 0, 0);
      this.ctx.restore();
    }
    return this;
  }

  /**
   * Agrega un contorno de 1 px alrededor de todos los píxeles opacos.
   * Es el borde oscuro característico de los sprites de 16 bits.
   */
  outline(color: string, region?: { x: number; y: number; w: number; h: number }, diagonals = false): this {
    const rx = region?.x ?? 0;
    const ry = region?.y ?? 0;
    const w = region?.w ?? this.canvas.width;
    const h = region?.h ?? this.canvas.height;
    const img = this.ctx.getImageData(rx, ry, w, h);
    const d = img.data;
    const [r, g, b] = hexToRgb(color);
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        let near =
          (x > 0 && solid[i - 1] === 1) ||
          (x < w - 1 && solid[i + 1] === 1) ||
          (y > 0 && solid[i - w] === 1) ||
          (y < h - 1 && solid[i + w] === 1);
        if (!near && diagonals) {
          near =
            (x > 0 && y > 0 && solid[i - w - 1] === 1) ||
            (x < w - 1 && y > 0 && solid[i - w + 1] === 1) ||
            (x > 0 && y < h - 1 && solid[i + w - 1] === 1) ||
            (x < w - 1 && y < h - 1 && solid[i + w + 1] === 1);
        }
        if (near) {
          d[i * 4] = r;
          d[i * 4 + 1] = g;
          d[i * 4 + 2] = b;
          d[i * 4 + 3] = 255;
        }
      }
    }
    this.ctx.putImageData(img, rx, ry);
    return this;
  }

  /** Reemplaza colores exactos (útil para variantes de paleta). */
  recolor(mapping: Record<string, string>): this {
    const img = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const d = img.data;
    const table = Object.entries(mapping).map(([from, to]) => [hexToRgb(from), hexToRgb(to)] as const);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      for (const [f, t] of table) {
        if (d[i] === f[0] && d[i + 1] === f[1] && d[i + 2] === f[2]) {
          d[i] = t[0];
          d[i + 1] = t[1];
          d[i + 2] = t[2];
          break;
        }
      }
    }
    this.ctx.putImageData(img, 0, 0);
    return this;
  }

  /** Pinta todos los píxeles visibles de un mismo color (útil para sombras). */
  recolorAll(color: string): this {
    const img = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const d = img.data;
    const [r, g, b] = hexToRgb(color);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    this.ctx.putImageData(img, 0, 0);
    return this;
  }

  /** Escribe texto con la fuente pixelada. `y` es el borde superior de las mayúsculas. */
  text(text: string, x: number, y: number, color: string, scale = 1): this {
    let cx = Math.round(x);
    for (const ch of text) {
      const g = getGlyph(ch);
      if (!g) continue;
      for (let j = 0; j < g.rows.length; j++) {
        const row = g.rows[j];
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '#') this.rect(cx + i * scale, y + (j - GLYPH_BODY_TOP) * scale, scale, scale, color);
        }
      }
      cx += (g.width + GLYPH_SPACING) * scale;
    }
    return this;
  }

  /** Texto centrado horizontalmente en `cx`. */
  textCentered(text: string, cx: number, y: number, color: string, scale = 1): this {
    const w = measureText(text) * scale;
    return this.text(text, Math.round(cx - w / 2), y, color, scale);
  }

  /** Registra el lienzo como textura de Phaser (reemplaza si ya existía). */
  addTo(textures: Phaser.Textures.TextureManager, key: string, frames?: FrameRect[]): Phaser.Textures.Texture {
    if (textures.exists(key)) textures.remove(key);
    const tex = textures.addCanvas(key, this.canvas);
    if (!tex) throw new Error(`No se pudo crear la textura ${key}`);
    frames?.forEach((f) => tex.add(f.name, 0, f.x, f.y, f.w, f.h));
    return tex;
  }
}

export interface PackedFrame {
  name: string;
  canvas: PixelCanvas;
}

/** Empaqueta lienzos de distinto tamaño en una tira horizontal (1 px de separación). */
export function packStrip(textures: Phaser.Textures.TextureManager, key: string, cells: PackedFrame[]): Phaser.Textures.Texture {
  const width = cells.reduce((acc, c) => acc + c.canvas.width + 1, 0);
  const height = Math.max(...cells.map((c) => c.canvas.height));
  const sheet = new PixelCanvas(width, height);
  const rects: FrameRect[] = [];
  let x = 0;
  for (const c of cells) {
    sheet.draw(c.canvas, x, 0);
    rects.push({ name: c.name, x, y: 0, w: c.canvas.width, h: c.canvas.height });
    x += c.canvas.width + 1;
  }
  return sheet.addTo(textures, key, rects);
}

/**
 * Arma una hoja de sprites a partir de varios lienzos del mismo tamaño
 * y la registra con un frame por cada nombre.
 */
export function buildSheet(
  textures: Phaser.Textures.TextureManager,
  key: string,
  frames: { name: string; canvas: PixelCanvas }[],
  columns = 8,
): Phaser.Textures.Texture {
  if (frames.length === 0) throw new Error(`Hoja ${key} sin frames`);
  const fw = frames[0].canvas.width;
  const fh = frames[0].canvas.height;
  const cols = Math.min(columns, frames.length);
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelCanvas(cols * fw, rows * fh);
  const rects: FrameRect[] = [];
  frames.forEach((f, i) => {
    const x = (i % cols) * fw;
    const y = Math.floor(i / cols) * fh;
    sheet.draw(f.canvas, x, y);
    rects.push({ name: f.name, x, y, w: fw, h: fh });
  });
  return sheet.addTo(textures, key, rects);
}
