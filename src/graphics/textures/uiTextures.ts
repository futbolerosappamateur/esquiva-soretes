import Phaser from 'phaser';
import { buildSheet, packStrip, PixelCanvas } from '../PixelCanvas';
import { TEX, UI_FRAMES } from '../keys';
import { PAL } from '../../config/palette';
import { hexToRgb } from '../color';
import { measureText } from '../fontData';

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

function cursor(): PixelCanvas {
  const pc = new PixelCanvas(7, 11);
  for (let i = 0; i < 5; i++) pc.vline(1 + i, 1 + i, 9 - i * 2, '#ffd23f');
  pc.vline(1, 1, 9, '#fff3a0');
  pc.outline(PAL.outline);
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

/** Logo con letras gordas, degradé, contorno, sombra y (en SORETES) chorreado. */
function drawLogoLine(text: string, scale: number, colors: string[], highlight: string, drips: boolean): PixelCanvas {
  const textW = measureText(text) * scale;
  const capH = 7 * scale;
  const pad = 6;
  const dripRoom = drips ? 12 : 0;
  const W = textW + pad * 2;
  const H = capH + pad * 2 + dripRoom;
  const mask = new PixelCanvas(W, H);
  mask.text(text, pad, pad, '#ffffff', scale);

  const img = mask.ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const fill = new PixelCanvas(W, H);
  // Chorreado: gotas que cuelgan del borde inferior de algunas letras.
  if (drips) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let x = pad + 2; x < W - pad - 2; x += 3) {
      const y = pad + capH - 1;
      if (opaque(x, y) && opaque(x + 1, y) && rnd() < 0.28) {
        const len = 3 + Math.floor(rnd() * 8);
        fill.rect(x, y, 2, len, colors[colors.length - 1]);
        fill.rect(x - 1 + 1, y + len, 2, 2, colors[colors.length - 1]);
        fill.px(x - 1, y + len, colors[colors.length - 1]);
        fill.px(x + 2, y + len, colors[colors.length - 1]);
        x += 4;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!opaque(x, y)) continue;
      const t = Math.min(0.999, Math.max(0, (y - pad) / capH));
      let c = colors[Math.floor(t * colors.length)];
      if (!opaque(x, y - 1)) c = highlight;
      fill.px(x, y, c);
    }
  }
  fill.outline(PAL.outline);
  fill.outline(PAL.outline);

  const out = new PixelCanvas(W + 3, H + 3);
  const shadowCanvas = new PixelCanvas(W, H);
  shadowCanvas.draw(fill, 0, 0);
  shadowCanvas.recolorAll('#120c18');
  out.draw(shadowCanvas, 3, 3);
  out.draw(fill, 0, 0);
  return out;
}

function drawLogo(textures: Phaser.Textures.TextureManager): void {
  const top = drawLogoLine('ESQUIVA', 4, ['#fff3a0', '#ffd23f', '#ffab2e', '#ff7a1f'], '#ffffff', false);
  const bottom = drawLogoLine('SORETES', 4, ['#e7b27a', '#c98a4b', '#a0632e', '#7a4520'], '#f8dcb4', true);
  const W = Math.max(top.width, bottom.width);
  const H = top.height + bottom.height - 10;
  const pc = new PixelCanvas(W, H);
  pc.draw(top, Math.round((W - top.width) / 2), 0);
  pc.draw(bottom, Math.round((W - bottom.width) / 2), top.height - 10);
  pc.addTo(textures, TEX.logo);
}

function drawMascot(blink: boolean): PixelCanvas {
  const pc = new PixelCanvas(28, 26);
  const rolls = [
    { x: 1, y: 15, w: 26, h: 9 },
    { x: 4, y: 10, w: 20, h: 8 },
    { x: 7, y: 5, w: 14, h: 7 },
    { x: 10, y: 1, w: 8, h: 6 },
  ];
  for (const r of rolls) {
    pc.ellipse(r.x, r.y, r.w, r.h, PAL.poopDark);
    pc.ellipse(r.x + 1, r.y, r.w - 2, r.h - 1, PAL.poop);
    pc.ellipse(r.x + 2, r.y + 1, Math.round(r.w * 0.55), Math.max(2, r.h - 4), PAL.poopMid);
    pc.px(r.x + 3, r.y + 1, PAL.poopShine);
  }
  // Ojos y sonrisa
  if (blink) {
    pc.hline(8, 13, 4, PAL.outline);
    pc.hline(16, 13, 4, PAL.outline);
  } else {
    pc.rect(8, 11, 4, 5, '#ffffff');
    pc.rect(16, 11, 4, 5, '#ffffff');
    pc.rect(10, 13, 2, 3, PAL.outline);
    pc.rect(18, 13, 2, 3, PAL.outline);
    pc.px(10, 13, '#ffffff');
    pc.px(18, 13, '#ffffff');
  }
  pc.hline(11, 19, 6, PAL.outline);
  pc.px(10, 18, PAL.outline);
  pc.px(17, 18, PAL.outline);
  pc.rect(12, 20, 4, 1, '#ec7383');
  pc.px(6, 17, '#ef8f88');
  pc.px(21, 17, '#ef8f88');
  pc.outline(PAL.outline);
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
    { name: UI_FRAMES.cursor, canvas: cursor() },
    { name: UI_FRAMES.flag, canvas: flagIcon() },
    { name: UI_FRAMES.fullscreen, canvas: fullscreenIcon() },
  ]);
  drawLogo(textures);
  buildSheet(textures, TEX.mascot, [
    { name: 'idle', canvas: drawMascot(false) },
    { name: 'blink', canvas: drawMascot(true) },
  ]);
}

// ---------------------------------------------------------------------------
// Botones y paneles (se generan a demanda según el tamaño pedido)
// ---------------------------------------------------------------------------

export type ButtonState = 'idle' | 'focus' | 'down';

const BUTTON_COLORS: Record<ButtonState, { fill: string; light: string; dark: string }> = {
  idle: { fill: '#3b2741', light: '#5a3f63', dark: '#24162a' },
  focus: { fill: '#ffd23f', light: '#fff3a0', dark: '#d99a1f' },
  down: { fill: '#f0b52a', light: '#ffd23f', dark: '#b87a14' },
};

export function ensureButtonTexture(textures: Phaser.Textures.TextureManager, w: number, h: number, state: ButtonState): string {
  const key = `btn-${w}x${h}-${state}`;
  if (textures.exists(key)) return key;
  const c = BUTTON_COLORS[state];
  const pc = new PixelCanvas(w, h);
  pc.rect(1, 0, w - 2, h, PAL.black);
  pc.rect(0, 1, w, h - 2, PAL.black);
  pc.rect(1, 1, w - 2, h - 2, c.fill);
  pc.hline(2, 1, w - 4, c.light);
  pc.vline(1, 2, h - 4, c.light);
  pc.hline(2, h - 2, w - 4, c.dark);
  pc.vline(w - 2, 2, h - 4, c.dark);
  pc.addTo(textures, key);
  return key;
}

/** Panel oscuro con firuletes de filete porteño en las esquinas. */
export function ensurePanelTexture(textures: Phaser.Textures.TextureManager, w: number, h: number): string {
  const key = `panel-${w}x${h}`;
  if (textures.exists(key)) return key;
  const pc = new PixelCanvas(w, h);
  pc.rect(2, 0, w - 4, h, PAL.black);
  pc.rect(0, 2, w, h - 4, PAL.black);
  pc.rect(1, 1, w - 2, h - 2, PAL.black);
  pc.rect(2, 2, w - 4, h - 4, '#4a3657');
  pc.rect(3, 3, w - 6, h - 6, 'rgba(36, 24, 46, 0.96)');
  pc.hline(4, 3, w - 8, '#5d4670');
  const curl = (x: number, y: number, fx: number, fy: number) => {
    const p = (dx: number, dy: number, c: string) => pc.px(x + dx * fx, y + dy * fy, c);
    p(0, 0, '#e8433a');
    p(1, 0, '#e8433a');
    p(2, 1, '#ffd23f');
    p(2, 2, '#ffd23f');
    p(1, 3, '#5fd068');
    p(0, 2, '#5fd068');
    p(3, 0, '#7cc8f2');
    p(0, 3, '#7cc8f2');
  };
  curl(6, 6, 1, 1);
  curl(w - 7, 6, -1, 1);
  curl(6, h - 7, 1, -1);
  curl(w - 7, h - 7, -1, -1);
  pc.addTo(textures, key);
  return key;
}
