import Phaser from 'phaser';
import { PAL } from '../../config/palette';
import { ICON_FRAMES, TEX } from '../keys';
import { packStrip, PixelCanvas } from '../PixelCanvas';

/** Íconos de interfaz v0.2: monedas, estrellas, candados, insignias, basura, etc. */

function coinFace(width: number): PixelCanvas {
  const pc = new PixelCanvas(9, 9);
  const x = Math.round((9 - width) / 2);
  pc.ellipse(x, 0, width, 9, '#c98a1b');
  if (width > 3) {
    pc.ellipse(x + 1, 1, width - 2, 7, '#ffd23f');
    pc.vline(x + Math.round(width / 2), 2, 5, '#c98a1b');
    pc.px(x + 1, 2, '#fff3a0');
  }
  pc.outline(PAL.outline);
  return pc;
}

function star(size: number, filled: boolean): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2 + 0.3;
  const outer = size / 2 - 0.6;
  const inner = outer * 0.45;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inside(x + 0.5, y + 0.5)) pc.px(x, y, filled ? (y < size * 0.45 ? '#fff07a' : '#ffd23f') : '#4a3657');
    }
  }
  pc.outline(PAL.outline);
  return pc;
}

function lock(): PixelCanvas {
  const pc = new PixelCanvas(9, 11);
  pc.rect(2, 0, 5, 1, '#c4c8d2').rect(1, 1, 1, 4, '#c4c8d2').rect(7, 1, 1, 4, '#c4c8d2');
  pc.rect(0, 5, 9, 6, '#e9c46a');
  pc.hline(0, 5, 9, '#fff1cf');
  pc.rect(4, 7, 1, 2, '#5a3a22');
  pc.outline(PAL.outline);
  return pc;
}

function check(): PixelCanvas {
  const pc = new PixelCanvas(10, 8);
  pc.line(1, 4, 3, 6, '#6fe07a', 2).line(3, 6, 8, 1, '#6fe07a', 2);
  pc.outline(PAL.outline);
  return pc;
}

function badge(): PixelCanvas {
  const pc = new PixelCanvas(12, 14);
  pc.rect(2, 9, 3, 5, '#e8433a').rect(7, 9, 3, 5, '#3c7fd9');
  pc.disc(6, 6, 5, '#ffd23f');
  pc.disc(6, 6, 3, '#ffb000');
  pc.px(5, 4, '#fff3a0').px(4, 5, '#fff3a0');
  pc.outline(PAL.outline);
  return pc;
}

function trash(): PixelCanvas {
  const pc = new PixelCanvas(10, 12);
  pc.rect(0, 2, 10, 2, '#5f7a64');
  pc.rect(3, 0, 4, 2, '#5f7a64');
  pc.rect(1, 4, 8, 8, '#4f6b55');
  for (let x = 2; x < 9; x += 2) pc.vline(x, 5, 6, '#3c5242');
  pc.outline(PAL.outline);
  return pc;
}

function arrowDown(): PixelCanvas {
  const pc = new PixelCanvas(9, 8);
  for (let i = 0; i < 4; i++) pc.hline(i, 4 + i, 9 - i * 2, '#ffd23f');
  pc.rect(3, 0, 3, 4, '#ffd23f');
  pc.outline(PAL.outline);
  return pc;
}

/** Zapatilla aplastada por un auto: marca de cubierta encima. */
function sneakerFlat(): PixelCanvas {
  const pc = new PixelCanvas(20, 14);
  pc.ellipse(4, 6, 13, 5, '#e6e6ee');
  pc.rect(2, 7, 16, 3, '#e6e6ee');
  pc.rect(2, 10, 16, 2, '#c4c8d2');
  for (let i = 0; i < 5; i++) pc.rect(4 + i * 3, 6, 2, 5, '#3a3542');
  pc.outline(PAL.outline);
  // Rayitas de "¡pisado!"
  pc.px(1, 2, '#ffd23f').px(2, 3, '#ffd23f').px(18, 2, '#ffd23f').px(17, 3, '#ffd23f');
  return pc;
}

function sun(): PixelCanvas {
  const pc = new PixelCanvas(11, 11);
  pc.disc(5.5, 5.5, 3, '#ffd23f');
  for (const [x, y] of [[5, 0], [5, 10], [0, 5], [10, 5], [2, 2], [8, 2], [2, 8], [8, 8]]) pc.px(x, y, '#ffb000');
  pc.outline(PAL.outline);
  return pc;
}

function moon(): PixelCanvas {
  const pc = new PixelCanvas(10, 10);
  pc.disc(5, 5, 4, '#fff3c4');
  pc.disc(7, 4, 3.4, 'rgba(0,0,0,0)');
  const cut = new PixelCanvas(10, 10);
  cut.disc(7, 4, 3, '#000');
  const a = pc.ctx.getImageData(0, 0, 10, 10);
  const b = cut.ctx.getImageData(0, 0, 10, 10).data;
  for (let i = 0; i < a.data.length; i += 4) if (b[i + 3] > 0) a.data[i + 3] = 0;
  pc.ctx.putImageData(a, 0, 0);
  pc.outline(PAL.outline);
  return pc;
}

function leaf(): PixelCanvas {
  const pc = new PixelCanvas(10, 10);
  pc.ellipse(1, 2, 8, 6, '#e3a13a');
  pc.line(1, 8, 8, 2, '#9e4f22');
  pc.outline(PAL.outline);
  return pc;
}

function plusMinus(plus: boolean): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(1, 0, 14, 16, 'rgba(18, 12, 24, 0.7)');
  pc.rect(0, 1, 16, 14, 'rgba(18, 12, 24, 0.7)');
  pc.rect(4, 7, 8, 2, '#ffffff');
  if (plus) pc.rect(7, 4, 2, 8, '#ffffff');
  return pc;
}

function back(): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(1, 0, 14, 16, 'rgba(18, 12, 24, 0.7)');
  pc.rect(0, 1, 16, 14, 'rgba(18, 12, 24, 0.7)');
  for (let i = 0; i < 4; i++) pc.vline(4 + i, 7 - i, 2 + i * 2, '#ffffff');
  pc.rect(8, 7, 4, 2, '#ffffff');
  return pc;
}

function flag(): PixelCanvas {
  const pc = new PixelCanvas(9, 12);
  pc.rect(1, 0, 1, 12, '#c4c8d2');
  pc.rect(2, 0, 6, 5, '#f4f4f0');
  pc.rect(3, 1, 2, 1, '#1f1a24').rect(5, 2, 2, 1, '#1f1a24').rect(3, 3, 2, 1, '#1f1a24');
  pc.outline(PAL.outline);
  return pc;
}

function litter(kind: 'paper' | 'can' | 'bottle'): PixelCanvas {
  const pc = new PixelCanvas(10, 8);
  if (kind === 'paper') {
    pc.ellipse(1, 1, 8, 6, '#f3f1ea');
    pc.line(3, 2, 6, 5, '#c9c4b8').line(5, 2, 3, 5, '#c9c4b8');
  } else if (kind === 'can') {
    pc.rect(1, 3, 8, 4, '#d8352a');
    pc.rect(1, 3, 2, 4, '#c4c8d2');
    pc.hline(3, 4, 5, '#ff8a7a');
  } else {
    pc.rect(0, 3, 7, 4, '#4f9a5a');
    pc.rect(7, 4, 3, 2, '#4f9a5a');
    pc.hline(1, 4, 5, '#9ee0a8');
  }
  pc.outline(PAL.outline);
  return pc;
}

export function generateHudTextures(textures: Phaser.Textures.TextureManager): void {
  packStrip(textures, TEX.icons, [
    { name: ICON_FRAMES.coin, canvas: coinFace(9) },
    { name: ICON_FRAMES.star, canvas: star(13, true) },
    { name: ICON_FRAMES.starEmpty, canvas: star(13, false) },
    { name: ICON_FRAMES.starSmall, canvas: star(9, true) },
    { name: ICON_FRAMES.starSmallEmpty, canvas: star(9, false) },
    { name: ICON_FRAMES.lock, canvas: lock() },
    { name: ICON_FRAMES.check, canvas: check() },
    { name: ICON_FRAMES.badge, canvas: badge() },
    { name: ICON_FRAMES.trash, canvas: trash() },
    { name: ICON_FRAMES.arrowDown, canvas: arrowDown() },
    { name: ICON_FRAMES.sneakerFlat, canvas: sneakerFlat() },
    { name: ICON_FRAMES.sun, canvas: sun() },
    { name: ICON_FRAMES.moon, canvas: moon() },
    { name: ICON_FRAMES.leaf, canvas: leaf() },
    { name: ICON_FRAMES.plus, canvas: plusMinus(true) },
    { name: ICON_FRAMES.minus, canvas: plusMinus(false) },
    { name: ICON_FRAMES.back, canvas: back() },
    { name: ICON_FRAMES.flag, canvas: flag() },
  ]);
  // Moneda girando.
  packStrip(textures, TEX.coin, [
    { name: 'c0', canvas: coinFace(9) },
    { name: 'c1', canvas: coinFace(6) },
    { name: 'c2', canvas: coinFace(3) },
    { name: 'c3', canvas: coinFace(6) },
  ]);
  packStrip(textures, TEX.litter, [
    { name: 'paper', canvas: litter('paper') },
    { name: 'can', canvas: litter('can') },
    { name: 'bottle', canvas: litter('bottle') },
  ]);
}
