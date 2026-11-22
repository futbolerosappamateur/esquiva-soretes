import Phaser from 'phaser';
import { packStrip, PixelCanvas } from '../PixelCanvas';
import { ICON_FRAMES, TEX, UI_FRAMES } from '../keys';
import { PAL } from '../../config/palette';
import { hexToRgb } from '../color';
import { gameFont } from '../BitmapFontBuilder';
import { applySmoothFilter } from '../../assets/AssetLoader';
import { ASSET_SCALE, fitToTexture } from '../renderScale';

function sneaker(dirty: boolean): PixelCanvas {
  const pc = new PixelCanvas(20, 14);
  const white = dirty ? '#d9cbb8' : '#ffffff';
  pc.ellipse(7, 5, 12, 7, white);
  pc.rect(2, 4, 9, 5, white);
  pc.rect(3, 2, 5, 3, white);
  pc.rect(2, 9, 16, 2, dirty ? '#6b3d1c' : '#c4c8d2');
  pc.hline(2, 11, 16, dirty ? '#4a2810' : '#9aa0ab');
  pc.line(5, 8, 8, 5, '#7cc8f2');
  pc.line(7, 8, 10, 5, '#7cc8f2');
  pc.px(9, 4, PAL.outline).px(11, 5, PAL.outline).px(13, 5, PAL.outline);
  if (dirty) {
    pc.ellipse(11, 7, 7, 4, '#87501f');
    pc.ellipse(12, 7, 4, 2, '#a86d34');
    pc.rect(3, 8, 4, 2, '#6b3d1c');
  }
  pc.outline(PAL.outline);
  if (dirty) {
    // Línea de olor
    pc.px(16, 0, '#9fd04a').px(17, 1, '#9fd04a').px(16, 2, '#9fd04a').px(17, 3, '#9fd04a');
  }
  return pc;
}

function ring(size: number, fill: string, stroke: string, strokeW: number): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  pc.ellipse(0, 0, size, size, stroke);
  const inner = new PixelCanvas(size, size);
  inner.ellipse(strokeW, strokeW, size - strokeW * 2, size - strokeW * 2, '#ffffff');
  // Recortar el interior y pintarlo con el relleno.
  const a = pc.ctx.getImageData(0, 0, size, size);
  const b = inner.ctx.getImageData(0, 0, size, size).data;
  const [fr, fg, fb] = parseRgba(fill);
  const fa = parseAlpha(fill);
  for (let i = 0; i < a.data.length; i += 4) {
    if (b[i + 3] > 0) {
      a.data[i] = fr;
      a.data[i + 1] = fg;
      a.data[i + 2] = fb;
      a.data[i + 3] = Math.round(fa * 255);
    }
  }
  pc.ctx.putImageData(a, 0, 0);
  return pc;
}

function parseRgba(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color);
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return [255, 255, 255];
  const [r, g, b] = m[1].split(',').map((s) => parseFloat(s));
  return [r, g, b];
}

function parseAlpha(color: string): number {
  const m = color.match(/rgba\(([^)]+)\)/);
  if (!m) return 1;
  return parseFloat(m[1].split(',')[3]);
}

function arrowUp(pc: PixelCanvas, cx: number, cy: number, color: string): void {
  for (let i = 0; i < 6; i++) pc.hline(cx - i, cy - 6 + i, i * 2 + 1, color);
  pc.rect(cx - 2, cy, 5, 6, color);
}

function pauseIcon(): PixelCanvas {
  const pc = new PixelCanvas(22, 22);
  pc.rect(1, 1, 20, 20, 'rgba(18, 12, 24, 0.55)');
  pc.rect(0, 2, 22, 18, 'rgba(18, 12, 24, 0.55)');
  pc.rect(2, 0, 18, 22, 'rgba(18, 12, 24, 0.55)');
  pc.rect(7, 6, 3, 10, '#ffffff');
  pc.rect(12, 6, 3, 10, '#ffffff');
  return pc;
}

function flagIcon(): PixelCanvas {
  const pc = new PixelCanvas(14, 16);
  pc.rect(6, 5, 2, 11, '#b4b4bc');
  pc.rect(0, 0, 14, 7, '#f4f4f0');
  pc.rect(1, 1, 12, 5, '#1f1a24');
  pc.hline(3, 3, 8, '#ffffff');
  pc.outline(PAL.outline);
  return pc;
}

function fullscreenIcon(): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(0, 0, 16, 16, 'rgba(18, 12, 24, 0.5)');
  const c = '#ffffff';
  pc.rect(3, 3, 4, 1, c).rect(3, 3, 1, 4, c);
  pc.rect(9, 3, 4, 1, c).rect(12, 3, 1, 4, c);
  pc.rect(3, 12, 4, 1, c).rect(3, 9, 1, 4, c);
  pc.rect(9, 12, 4, 1, c).rect(12, 9, 1, 4, c);
  return pc;
}

export function generateUiTextures(textures: Phaser.Textures.TextureManager): void {
  const jump = ring(48, 'rgba(255, 210, 63, 0.30)', 'rgba(255, 255, 255, 0.75)', 2);
  arrowUp(jump, 24, 22, 'rgba(255, 255, 255, 0.9)');
  const jumpDown = ring(48, 'rgba(255, 210, 63, 0.65)', 'rgba(255, 255, 255, 0.95)', 3);
  arrowUp(jumpDown, 24, 23, '#ffffff');

  packStrip(textures, TEX.ui, [
    { name: UI_FRAMES.sneakerClean, canvas: sneaker(false) },
    { name: UI_FRAMES.sneakerDirty, canvas: sneaker(true) },
    { name: UI_FRAMES.joyBase, canvas: ring(64, 'rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.55)', 2) },
    { name: UI_FRAMES.joyKnob, canvas: ring(28, 'rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.9)', 2) },
    { name: UI_FRAMES.jump, canvas: jump },
    { name: UI_FRAMES.jumpDown, canvas: jumpDown },
    { name: UI_FRAMES.pause, canvas: pauseIcon() },
    { name: UI_FRAMES.flag, canvas: flagIcon() },
    { name: UI_FRAMES.fullscreen, canvas: fullscreenIcon() },
  ]);
  drawLogo(textures);
  drawMascotSheet(textures);
  drawCursor(textures);
  drawHdIcons(textures);
}

// ---------------------------------------------------------------------------
// Botones y paneles (se generan a demanda según el tamaño pedido)
// ---------------------------------------------------------------------------
//
// A diferencia del resto de la interfaz, se dibujan con formas suaves y con
// el detalle de la pantalla completa (ASSET_SCALE píxeles por unidad), así los
// bordes y las esquinas se ven prolijos en una pantalla grande. La textura
// declara meta.displayScale = 1/ASSET_SCALE: quien la muestra usa
// fitToTexture (o addPanel / Button, que ya lo hacen).

export type ButtonState = 'idle' | 'focus' | 'down';

const BUTTON_COLORS: Record<ButtonState, { fill: string; light: string; dark: string }> = {
  idle: { fill: '#3b2741', light: '#5a3f63', dark: '#24162a' },
  focus: { fill: '#ffd23f', light: '#fff3a0', dark: '#d99a1f' },
  down: { fill: '#f0b52a', light: '#ffd23f', dark: '#b87a14' },
};

/** Lienzo con detalle: se dibuja en unidades del juego y queda a ASSET_SCALE píxeles por unidad. */
function hiResTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  frames: { name: string; x: number; y: number; w: number; h: number }[] = [],
): void {
  // Tope por si alguien pide un panel enorme (las placas de video tienen un máximo de textura).
  const s = Math.max(1, Math.min(ASSET_SCALE, Math.floor(4096 / Math.max(w, h))));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * s));
  canvas.height = Math.max(1, Math.round(h * s));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(s, s);
  paint(ctx);
  if (textures.exists(key)) textures.remove(key);
  const tex = textures.addCanvas(key, canvas);
  if (!tex) return;
  tex.customData = { meta: { displayScale: 1 / s, smooth: true } };
  applySmoothFilter(tex);
  for (const fr of frames) tex.add(fr.name, 0, Math.round(fr.x * s), Math.round(fr.y * s), Math.round(fr.w * s), Math.round(fr.h * s));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function ensureButtonTexture(textures: Phaser.Textures.TextureManager, w: number, h: number, state: ButtonState): string {
  const key = `btn-${w}x${h}-${state}`;
  if (textures.exists(key)) return key;
  const c = BUTTON_COLORS[state];
  hiResTexture(textures, key, w, h, (ctx) => {
    roundRect(ctx, 0, 0, w, h, 3.2);
    ctx.fillStyle = PAL.black;
    ctx.fill();
    const grad = ctx.createLinearGradient(0, 1, 0, h - 1);
    grad.addColorStop(0, c.light);
    grad.addColorStop(0.42, c.fill);
    grad.addColorStop(1, c.dark);
    roundRect(ctx, 1, 1, w - 2, h - 2, 2.4);
    ctx.fillStyle = grad;
    ctx.fill();
    // Brillo arriba y sombra abajo (relieve).
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = c.light;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(3.4, 1.9);
    ctx.lineTo(w - 3.4, 1.9);
    ctx.stroke();
    ctx.strokeStyle = c.dark;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(3.4, h - 1.9);
    ctx.lineTo(w - 3.4, h - 1.9);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  return key;
}

/**
 * Firulete de filete porteño para una esquina: un corchete redondeado rojo
 * que termina en dos rulos, con un punto amarillo y hojitas verde y celeste.
 * Se dibuja para la esquina de arriba a la izquierda (el resto, espejado).
 */
function filete(ctx: CanvasRenderingContext2D, x: number, y: number, fx: number, fy: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(fx * size, fy * size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Corchete con rulos en las puntas.
  ctx.strokeStyle = '#e8433a';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(6.2, 2.1);
  ctx.arc(6.2, 1.25, 0.85, Math.PI / 2, -Math.PI * 0.9, true);
  ctx.moveTo(6.2, 0.4);
  ctx.lineTo(2.6, 0.4);
  ctx.quadraticCurveTo(0.4, 0.4, 0.4, 2.6);
  ctx.lineTo(0.4, 6.2);
  ctx.arc(1.25, 6.2, 0.85, Math.PI, Math.PI * 0.4, true);
  ctx.stroke();
  // Hojitas.
  ctx.fillStyle = '#5fd068';
  ctx.beginPath();
  ctx.ellipse(4.0, 2.25, 1.05, 0.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7cc8f2';
  ctx.beginPath();
  ctx.ellipse(2.25, 4.0, 1.05, 0.5, -1.07, 0, Math.PI * 2);
  ctx.fill();
  // Punto amarillo en el ángulo.
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(2.15, 2.15, 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Panel oscuro con firuletes de filete porteño en las esquinas. */
export function ensurePanelTexture(textures: Phaser.Textures.TextureManager, w: number, h: number): string {
  const key = `panel-${w}x${h}`;
  if (textures.exists(key)) return key;
  hiResTexture(textures, key, w, h, (ctx) => {
    roundRect(ctx, 0, 0, w, h, 3.5);
    ctx.fillStyle = PAL.black;
    ctx.fill();
    roundRect(ctx, 1, 1, w - 2, h - 2, 2.8);
    ctx.fillStyle = '#4a3657';
    ctx.fill();
    const grad = ctx.createLinearGradient(0, 2, 0, h - 2);
    grad.addColorStop(0, 'rgba(44, 30, 56, 0.97)');
    grad.addColorStop(1, 'rgba(32, 21, 41, 0.97)');
    roundRect(ctx, 2, 2, w - 4, h - 4, 2.2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = '#5d4670';
    ctx.beginPath();
    ctx.moveTo(4, 2.7);
    ctx.lineTo(w - 4, 2.7);
    ctx.stroke();
    // Firuletes (más chicos en los paneles chiquitos, como las fichas de personaje).
    const size = Math.min(w, h) < 60 ? 0.62 : 0.85;
    const m = 3.6;
    filete(ctx, m, m, 1, 1, size);
    filete(ctx, w - m, m, -1, 1, size);
    filete(ctx, m, h - m, 1, -1, size);
    filete(ctx, w - m, h - m, -1, -1, size);
  });
  return key;
}

/** Cuántas escenas abiertas usan cada panel (los paneles grandes pesan varios MB: se liberan al salir). */
const panelUsers = new Map<string, number>();

/**
 * Imagen de un panel de w×h unidades, ya ajustada a su detalle. La textura se
 * libera cuando se cierra la última escena que la usa (si se vuelve a pedir,
 * se dibuja de nuevo).
 */
export function addPanelImage(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Image {
  const key = ensurePanelTexture(scene.textures, w, h);
  panelUsers.set(key, (panelUsers.get(key) ?? 0) + 1);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    const left = (panelUsers.get(key) ?? 1) - 1;
    if (left > 0) {
      panelUsers.set(key, left);
      return;
    }
    panelUsers.delete(key);
    if (scene.textures.exists(key)) scene.textures.remove(key);
  });
  return fitToTexture(scene.add.image(x, y, key));
}

// ---------------------------------------------------------------------------
// Logo, mascota y flechita del menú (formas suaves, con detalle de pantalla completa)
// ---------------------------------------------------------------------------

/** Tamaño del logo en unidades del juego (el menú lo centra arriba). */
export const LOGO_SIZE = { w: 190, h: 96 };

interface LogoLine {
  text: string;
  baseline: number;
  colors: string[];
  highlight: string;
  drips: boolean;
}

/** Lienzo del mismo tamaño y escala que `ctx` (para armar capas). */
function layerLike(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D | null {
  const c = document.createElement('canvas');
  c.width = ctx.canvas.width;
  c.height = ctx.canvas.height;
  const l = c.getContext('2d');
  if (!l) return null;
  l.setTransform(ctx.getTransform());
  l.font = ctx.font;
  l.textAlign = ctx.textAlign;
  l.textBaseline = ctx.textBaseline;
  return l;
}

/** Gotas que cuelgan de las letras que tocan el renglón (con una semilla fija: siempre las mismas). */
function logoDrips(ctx: CanvasRenderingContext2D, line: LogoLine, cx: number, cap: number): { x: number; len: number }[] {
  const mask = layerLike(ctx);
  if (!mask) return [];
  mask.fillStyle = '#ffffff';
  mask.fillText(line.text, cx, line.baseline);
  const s = ctx.getTransform().a;
  const w = mask.canvas.width;
  const row = Math.round((line.baseline - 0.8) * s);
  const px = mask.getImageData(0, row, w, 1).data;
  const inkAt = (x: number) => {
    const i = Math.round(x * s);
    return i >= 0 && i < w && px[i * 4 + 3] > 200;
  };
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const out: { x: number; len: number }[] = [];
  const width = mask.measureText(line.text).width;
  for (let x = cx - width / 2 + 3; x < cx + width / 2 - 3; x += 1.5) {
    if (inkAt(x) && inkAt(x + 2.4) && rnd() < 0.3) {
      out.push({ x: x + 1.2, len: Math.round(cap * (0.12 + rnd() * 0.26)) });
      x += 6;
    }
  }
  return out;
}

function dripPath(ctx: CanvasRenderingContext2D, d: { x: number; len: number }, baseline: number): void {
  const w = 2.6;
  ctx.beginPath();
  ctx.moveTo(d.x - w / 2, baseline - 2);
  ctx.lineTo(d.x - w / 2, baseline + d.len);
  ctx.arc(d.x, baseline + d.len, 1.9, Math.PI, 0, true);
  ctx.lineTo(d.x + w / 2, baseline - 2);
  ctx.closePath();
}

/** Logo con letras gordas, degradé, contorno, sombra y (en SORETES) chorreado. */
function drawLogo(textures: Phaser.Textures.TextureManager): void {
  const { w: W, h: H } = LOGO_SIZE;
  hiResTexture(textures, TEX.logo, W, H, (ctx) => {
    ctx.font = gameFont(100);
    const capRatio = ctx.measureText('H').actualBoundingBoxAscent / 100 || 0.7;
    const cap = 27;
    ctx.font = gameFont(cap / capRatio);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const cx = W / 2 - 1.5;
    const lines: LogoLine[] = [
      { text: 'ESQUIVA', baseline: 5 + cap, colors: ['#fff3a0', '#ffd23f', '#ffab2e', '#ff7a1f'], highlight: '#ffffff', drips: false },
      { text: 'SORETES', baseline: 5 + cap * 2 + 9, colors: ['#e7b27a', '#c98a4b', '#a0632e', '#7a4520'], highlight: '#f8dcb4', drips: true },
    ];
    const drips = lines.map((l) => (l.drips ? logoDrips(ctx, l, cx, cap) : []));
    const OUTLINE = 2.6;
    const BOLD = 1.3;
    const SHADOW = 2.8;

    // 1) Sombra.
    ctx.save();
    ctx.translate(SHADOW, SHADOW);
    ctx.fillStyle = ctx.strokeStyle = '#120c18';
    ctx.lineWidth = OUTLINE * 2 + BOLD;
    lines.forEach((l, i) => {
      ctx.strokeText(l.text, cx, l.baseline);
      for (const d of drips[i]) {
        dripPath(ctx, d, l.baseline);
        ctx.stroke();
      }
    });
    ctx.restore();

    // 2) Contorno.
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = OUTLINE * 2 + BOLD;
    lines.forEach((l, i) => {
      ctx.strokeText(l.text, cx, l.baseline);
      for (const d of drips[i]) {
        dripPath(ctx, d, l.baseline);
        ctx.stroke();
      }
    });

    // 3) Relleno con degradé (un poco engrosado) y brillo arriba.
    lines.forEach((l, i) => {
      const top = l.baseline - cap;
      const grad = ctx.createLinearGradient(0, top, 0, l.baseline);
      l.colors.forEach((c, k) => grad.addColorStop(k / (l.colors.length - 1), c));
      ctx.fillStyle = l.colors[l.colors.length - 1];
      for (const d of drips[i]) {
        dripPath(ctx, d, l.baseline);
        ctx.fill();
      }
      ctx.fillStyle = ctx.strokeStyle = grad;
      ctx.lineWidth = BOLD;
      ctx.strokeText(l.text, cx, l.baseline);
      ctx.fillText(l.text, cx, l.baseline);
      // Brillo: franja clara en la parte de arriba de las letras.
      const shine = layerLike(ctx);
      if (shine) {
        shine.fillStyle = shine.strokeStyle = '#ffffff';
        shine.lineWidth = BOLD;
        shine.lineJoin = 'round';
        shine.strokeText(l.text, cx, l.baseline);
        shine.fillText(l.text, cx, l.baseline);
        shine.globalCompositeOperation = 'source-in';
        const band = shine.createLinearGradient(0, top - 1, 0, top + cap * 0.32);
        band.addColorStop(0, l.highlight);
        band.addColorStop(1, 'rgba(255, 255, 255, 0)');
        shine.fillStyle = band;
        shine.fillRect(0, top - 2, W, cap * 0.4);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(shine.canvas, 0, 0);
        ctx.restore();
      }
    });
  });
}

/** El sorete mascota del menú (también es el avatar por defecto del modo online). */
function drawMascot(ctx: CanvasRenderingContext2D, ox: number, blink: boolean): void {
  ctx.save();
  ctx.translate(ox, 0);
  const rolls = [
    { x: 14, y: 19.6, rx: 12.6, ry: 4.7 },
    { x: 14, y: 14.1, rx: 9.8, ry: 4.2 },
    { x: 14, y: 8.9, rx: 6.9, ry: 3.6 },
    { x: 14.4, y: 4.5, rx: 3.9, ry: 3.1 },
  ];
  const ellipse = (x: number, y: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  };
  // Contorno de todo el cuerpo.
  ctx.fillStyle = PAL.outline;
  for (const r of rolls) {
    ellipse(r.x, r.y, r.rx + 1, r.ry + 1);
    ctx.fill();
  }
  // Rollos de abajo hacia arriba: base oscura, cuerpo, luz y brillito.
  for (const r of rolls) {
    ctx.fillStyle = PAL.poopDark;
    ellipse(r.x, r.y, r.rx, r.ry);
    ctx.fill();
    ctx.fillStyle = PAL.poop;
    ellipse(r.x, r.y - 0.5, r.rx - 0.4, r.ry - 0.6);
    ctx.fill();
    ctx.fillStyle = PAL.poopMid;
    ellipse(r.x - r.rx * 0.18, r.y - r.ry * 0.3, r.rx * 0.62, r.ry * 0.5);
    ctx.fill();
    ctx.fillStyle = PAL.poopShine;
    ctx.globalAlpha = 0.9;
    ellipse(r.x - r.rx * 0.52, r.y - r.ry * 0.45, Math.min(1.5, r.rx * 0.2), Math.min(0.9, r.ry * 0.22));
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Ojos.
  for (const ex of [10.2, 17.8]) {
    if (blink) {
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, 13.2, 1.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ellipse(ex, 13.2, 2.2, 2.7);
      ctx.fill();
      ctx.fillStyle = PAL.outline;
      ellipse(ex + 0.6, 13.8, 1.25, 1.55);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ellipse(ex + 0.2, 13.1, 0.45, 0.45);
      ctx.fill();
    }
  }
  // Cachetes y sonrisa con lengua.
  ctx.fillStyle = '#ef8f88';
  ctx.globalAlpha = 0.75;
  ellipse(6.6, 17.6, 1.6, 0.9);
  ctx.fill();
  ellipse(21.4, 17.6, 1.6, 0.9);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.outline;
  ctx.beginPath();
  ctx.moveTo(10.6, 17.6);
  ctx.quadraticCurveTo(14, 22.4, 17.4, 17.6);
  ctx.quadraticCurveTo(14, 19.2, 10.6, 17.6);
  ctx.fill();
  ctx.fillStyle = '#ec7383';
  ellipse(14, 19.7, 1.5, 0.8);
  ctx.fill();
  ctx.restore();
}

function drawMascotSheet(textures: Phaser.Textures.TextureManager): void {
  const w = 28;
  const h = 26;
  hiResTexture(
    textures,
    TEX.mascot,
    w * 2 + 1,
    h,
    (ctx) => {
      drawMascot(ctx, 0, false);
      drawMascot(ctx, w + 1, true);
    },
    [
      { name: 'idle', x: 0, y: 0, w, h },
      { name: 'blink', x: w + 1, y: 0, w, h },
    ],
  );
}

/** Flechita amarilla que marca la opción elegida en los menús. */
function drawCursor(textures: Phaser.Textures.TextureManager): void {
  hiResTexture(textures, TEX.cursor, 8, 12, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(1.3, 1.3);
    ctx.lineTo(6.7, 6);
    ctx.lineTo(1.3, 10.7);
    ctx.closePath();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = PAL.outline;
    ctx.stroke();
    const grad = ctx.createLinearGradient(0, 1, 0, 11);
    grad.addColorStop(0, '#fff3a0');
    grad.addColorStop(0.5, '#ffd23f');
    grad.addColorStop(1, '#f0a020');
    ctx.fillStyle = grad;
    ctx.fill();
  });
}

// ---------------------------------------------------------------------------
// Íconos de los menús con detalle (estrellas, moneda, candado, reloj...)
// ---------------------------------------------------------------------------
//
// Las mismas figuras y colores que los íconos pixelados (hudTextures.ts) y del
// mismo tamaño en unidades, pero dibujados con formas suaves. Se usan con
// `addIcon`; los íconos que no tienen versión suave (los de los poderes, por
// ejemplo) siguen saliendo de la hoja pixelada.

const OUT = PAL.outline;

type IconPainter = (ctx: CanvasRenderingContext2D) => void;

/** Contorno oscuro y relleno de la figura que está en el camino actual. */
function inkAndFill(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, outline = 1.5): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = outline;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / Math.max(1, stops.length - 1), c));
  return g;
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number): void {
  const inner = outer * 0.48;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const starIcon =
  (size: number, filled: boolean): IconPainter =>
  (ctx) => {
    const c = size / 2;
    starPath(ctx, c, c + 0.35, c - 0.85);
    inkAndFill(ctx, filled ? vgrad(ctx, 0.5, size - 0.5, ['#fff07a', '#ffd23f', '#f0a020']) : '#4a3657', size < 11 ? 1.3 : 1.5);
  };

const coinIcon: IconPainter = (ctx) => {
  ctx.beginPath();
  ctx.arc(4.5, 4.5, 3.85, 0, Math.PI * 2);
  inkAndFill(ctx, '#c98a1b', 1.3);
  ctx.beginPath();
  ctx.arc(4.5, 4.5, 2.9, 0, Math.PI * 2);
  ctx.fillStyle = vgrad(ctx, 1.6, 7.4, ['#ffe066', '#ffd23f', '#f2b42a']);
  ctx.fill();
  ctx.strokeStyle = '#c98a1b';
  ctx.lineWidth = 0.75;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4.5, 2.7);
  ctx.lineTo(4.5, 6.3);
  ctx.stroke();
  ctx.strokeStyle = '#fff3a0';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(4.5, 4.5, 2.3, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
};

const lockIcon: IconPainter = (ctx) => {
  // Arco (primero el contorno, después el metal).
  const shackle = () => {
    ctx.beginPath();
    ctx.moveTo(2.2, 5.4);
    ctx.lineTo(2.2, 3.6);
    ctx.arc(4.5, 3.6, 2.3, Math.PI, 0);
    ctx.lineTo(6.8, 5.4);
  };
  ctx.lineCap = 'round';
  shackle();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  shackle();
  ctx.strokeStyle = '#c4c8d2';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  roundRect(ctx, 0.75, 4.9, 7.5, 5.4, 1.2);
  inkAndFill(ctx, vgrad(ctx, 4.9, 10.3, ['#f6d989', '#e9c46a', '#d4a64a']), 1.4);
  ctx.strokeStyle = '#fff1cf';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(1.8, 5.75);
  ctx.lineTo(7.2, 5.75);
  ctx.stroke();
  ctx.fillStyle = '#5a3a22';
  ctx.beginPath();
  ctx.arc(4.5, 7.3, 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(4.15, 7.4, 0.7, 1.5);
};

const checkIcon: IconPainter = (ctx) => {
  const tick = () => {
    ctx.beginPath();
    ctx.moveTo(1.4, 4.1);
    ctx.lineTo(3.7, 6.3);
    ctx.lineTo(8.6, 1.4);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tick();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.1;
  ctx.stroke();
  tick();
  ctx.strokeStyle = '#6fe07a';
  ctx.lineWidth = 1.6;
  ctx.stroke();
};

const badgeIcon: IconPainter = (ctx) => {
  const ribbon = (x: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 3, 8);
    ctx.lineTo(x + 3, 13.3);
    ctx.lineTo(x + 1.5, 12.2);
    ctx.lineTo(x, 13.3);
    ctx.closePath();
    inkAndFill(ctx, color, 1.2);
  };
  ribbon(2, '#e8433a');
  ribbon(7, '#3c7fd9');
  ctx.beginPath();
  ctx.arc(6, 6, 4.8, 0, Math.PI * 2);
  inkAndFill(ctx, vgrad(ctx, 1.2, 10.8, ['#ffe680', '#ffd23f', '#f0a020']), 1.4);
  ctx.beginPath();
  ctx.arc(6, 6, 3.1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb000';
  ctx.fill();
  starPath(ctx, 6, 6.15, 2.1);
  ctx.fillStyle = '#fff3a0';
  ctx.fill();
};

const arrowDownIcon: IconPainter = (ctx) => {
  ctx.beginPath();
  ctx.moveTo(3.1, 0.8);
  ctx.lineTo(5.9, 0.8);
  ctx.lineTo(5.9, 3.7);
  ctx.lineTo(8.2, 3.7);
  ctx.lineTo(4.5, 7.3);
  ctx.lineTo(0.8, 3.7);
  ctx.lineTo(3.1, 3.7);
  ctx.closePath();
  inkAndFill(ctx, vgrad(ctx, 0.8, 7.3, ['#fff3a0', '#ffd23f', '#f0a020']), 1.4);
};

const sunIcon: IconPainter = (ctx) => {
  const rays = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(5.5 + Math.cos(a) * 3.9, 5.5 + Math.sin(a) * 3.9);
      ctx.lineTo(5.5 + Math.cos(a) * 4.7, 5.5 + Math.sin(a) * 4.7);
      ctx.stroke();
    }
  };
  rays(2.1, OUT);
  rays(0.9, '#ffb000');
  ctx.beginPath();
  ctx.arc(5.5, 5.5, 2.9, 0, Math.PI * 2);
  inkAndFill(ctx, vgrad(ctx, 2.6, 8.4, ['#fff07a', '#ffd23f']), 1.3);
};

const moonIcon: IconPainter = (ctx) => {
  // Media luna: un círculo al que se le come otro (en una capa aparte).
  const crescent = (grow: number, color: string) => {
    const layer = layerLike(ctx);
    if (!layer) return;
    layer.fillStyle = color;
    layer.beginPath();
    layer.arc(5, 5, 4 + grow, 0, Math.PI * 2);
    layer.fill();
    layer.globalCompositeOperation = 'destination-out';
    layer.beginPath();
    layer.arc(7.1, 3.7, 3.2 - grow, 0, Math.PI * 2);
    layer.fill();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.restore();
  };
  crescent(0.75, OUT);
  crescent(0, '#fff3c4');
};

const leafIcon: IconPainter = (ctx) => {
  ctx.beginPath();
  ctx.moveTo(1.4, 8.6);
  ctx.quadraticCurveTo(0.6, 2.2, 8.6, 1.4);
  ctx.quadraticCurveTo(8.2, 8.6, 1.4, 8.6);
  ctx.closePath();
  inkAndFill(ctx, vgrad(ctx, 1.4, 8.6, ['#f0b84e', '#e3a13a', '#c97f2a']), 1.3);
  ctx.strokeStyle = '#9e4f22';
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(7.6, 2.4);
  ctx.stroke();
};

const clockIcon: IconPainter = (ctx) => {
  ctx.beginPath();
  ctx.arc(5.5, 5.5, 4.55, 0, Math.PI * 2);
  inkAndFill(ctx, '#fff4d6', 1.4);
  ctx.strokeStyle = '#b9a98f';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(5.5 + Math.cos(a) * 3.3, 5.5 + Math.sin(a) * 3.3);
    ctx.lineTo(5.5 + Math.cos(a) * 3.9, 5.5 + Math.sin(a) * 3.9);
    ctx.stroke();
  }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(5.5, 5.5);
  ctx.lineTo(5.5, 2.5);
  ctx.moveTo(5.5, 5.5);
  ctx.lineTo(7.7, 5.5);
  ctx.stroke();
};

const trophyIcon: IconPainter = (ctx) => {
  const handles = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(2.6, 2.6, 1.6, Math.PI * 0.5, Math.PI * 1.5);
    ctx.moveTo(9.4, 1);
    ctx.arc(9.4, 2.6, 1.6, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  handles(2.2, OUT);
  handles(0.9, '#ffd23f');
  // Base y pie.
  roundRect(ctx, 3, 8.6, 6, 2.6, 0.7);
  inkAndFill(ctx, vgrad(ctx, 8.6, 11.2, ['#e0a640', '#c98a1b']), 1.3);
  ctx.beginPath();
  ctx.rect(5.1, 6.4, 1.8, 2.4);
  inkAndFill(ctx, '#c98a1b', 1.2);
  // Copa.
  ctx.beginPath();
  ctx.moveTo(2.3, 0.8);
  ctx.lineTo(9.7, 0.8);
  ctx.lineTo(9.7, 2.6);
  ctx.quadraticCurveTo(9.5, 6.6, 6, 6.8);
  ctx.quadraticCurveTo(2.5, 6.6, 2.3, 2.6);
  ctx.closePath();
  inkAndFill(ctx, vgrad(ctx, 0.8, 6.8, ['#fff07a', '#ffd23f', '#f0a020']), 1.3);
  ctx.strokeStyle = '#fff3a0';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(3.6, 1.8);
  ctx.lineTo(3.8, 4);
  ctx.stroke();
};

/** Íconos con versión suave: nombre del cuadro → tamaño (el mismo que el pixelado) y dibujo. */
const HD_ICONS: { name: string; w: number; h: number; paint: IconPainter }[] = [
  { name: ICON_FRAMES.coin, w: 9, h: 9, paint: coinIcon },
  { name: ICON_FRAMES.star, w: 13, h: 13, paint: starIcon(13, true) },
  { name: ICON_FRAMES.starEmpty, w: 13, h: 13, paint: starIcon(13, false) },
  { name: ICON_FRAMES.starSmall, w: 9, h: 9, paint: starIcon(9, true) },
  { name: ICON_FRAMES.starSmallEmpty, w: 9, h: 9, paint: starIcon(9, false) },
  { name: ICON_FRAMES.lock, w: 9, h: 11, paint: lockIcon },
  { name: ICON_FRAMES.check, w: 10, h: 8, paint: checkIcon },
  { name: ICON_FRAMES.badge, w: 12, h: 14, paint: badgeIcon },
  { name: ICON_FRAMES.arrowDown, w: 9, h: 8, paint: arrowDownIcon },
  { name: ICON_FRAMES.sun, w: 11, h: 11, paint: sunIcon },
  { name: ICON_FRAMES.moon, w: 10, h: 10, paint: moonIcon },
  { name: ICON_FRAMES.leaf, w: 10, h: 10, paint: leafIcon },
  { name: ICON_FRAMES.clock, w: 11, h: 11, paint: clockIcon },
  { name: ICON_FRAMES.trophy, w: 12, h: 12, paint: trophyIcon },
];

function drawHdIcons(textures: Phaser.Textures.TextureManager): void {
  const gap = 2;
  const W = HD_ICONS.reduce((acc, ic) => acc + ic.w + gap, 0);
  const H = Math.max(...HD_ICONS.map((ic) => ic.h));
  const frames: { name: string; x: number; y: number; w: number; h: number }[] = [];
  let x = 0;
  for (const ic of HD_ICONS) {
    frames.push({ name: ic.name, x, y: 0, w: ic.w, h: ic.h });
    x += ic.w + gap;
  }
  hiResTexture(
    textures,
    TEX.iconsHd,
    W,
    H,
    (ctx) => {
      frames.forEach((f, i) => {
        ctx.save();
        ctx.translate(f.x, f.y);
        HD_ICONS[i].paint(ctx);
        ctx.restore();
      });
    },
    frames,
  );
}

/**
 * Ícono de interfaz en (x, y), a `scale` veces su tamaño: el dibujado con
 * detalle si existe, si no el pixelado. Para animar su escala, partir de
 * `img.scaleX` (ya incluye el ajuste al detalle de la textura).
 */
export function addIcon(scene: Phaser.Scene, x: number, y: number, frame: string, scale = 1): Phaser.GameObjects.Image {
  const hd = scene.textures.exists(TEX.iconsHd) && scene.textures.get(TEX.iconsHd).has(frame);
  if (hd) return fitToTexture(scene.add.image(x, y, TEX.iconsHd, frame), scale);
  return scene.add.image(x, y, TEX.icons, frame).setScale(scale);
}
