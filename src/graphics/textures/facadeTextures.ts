import Phaser from 'phaser';
import { PixelCanvas } from '../PixelCanvas';
import { TEX } from '../keys';
import { RNG } from '../../core/rng';
import { mix, shade } from '../color';
import { measureText } from '../fontData';
import { CORNER_SPECS, FACADE_SPECS, type FacadeSpec, type ShopKind } from '../facadeSpecs';

export { CORNER_SPECS, FACADE_SPECS, type FacadeSpec, type ShopKind };

/**
 * Fachadas porteñas generadas por código a partir de una especificación.
 * Cambiando la lista FACADE_SPECS se pueden crear barrios nuevos.
 */

const GROUND_H = 46;
const FLOOR_H = 32;
const CORNICE_H = 8;
const TOP_EXTRA = 40;
const IRON = '#2b2530';

export function facadeHeight(spec: FacadeSpec): number {
  return TOP_EXTRA + CORNICE_H + spec.floors * FLOOR_H + GROUND_H;
}

interface ShopStyle {
  name: string;
  signBg: string;
  signText: string;
  awningA: string;
  awningB: string;
  interior: string;
  contents: (pc: PixelCanvas, x: number, y: number, w: number, h: number, rng: RNG) => void;
  outside?: (pc: PixelCanvas, x: number, w: number, bottom: number, rng: RNG) => void;
}

const FRUITS = ['#f08a24', '#e0402e', '#6cbf3c', '#f2d03c', '#9b3fb5'];

function crate(pc: PixelCanvas, x: number, bottom: number, rng: RNG): void {
  pc.rect(x, bottom - 6, 14, 6, '#b07a3c');
  pc.hline(x, bottom - 4, 14, '#8a5a2a');
  pc.vline(x, bottom - 6, 6, '#8a5a2a');
  pc.vline(x + 13, bottom - 6, 6, '#8a5a2a');
  const fruit = rng.pick(FRUITS);
  for (let i = 0; i < 5; i++) {
    pc.rect(x + 1 + i * 3 - (i % 2), bottom - 9 + (i % 2), 3, 3, fruit);
    pc.px(x + 1 + i * 3 - (i % 2), bottom - 9 + (i % 2), shade(fruit, 0.35));
  }
}

function bistro(pc: PixelCanvas, x: number, bottom: number): void {
  // Mesita redonda y dos sillas tipo Thonet.
  pc.rect(x + 6, bottom - 9, 9, 2, '#d9d4c8');
  pc.vline(x + 10, bottom - 7, 6, '#3a3238');
  pc.hline(x + 8, bottom - 1, 5, '#3a3238');
  for (const cx of [x, x + 17]) {
    pc.vline(cx + 1, bottom - 12, 12, '#5a3a22');
    pc.rect(cx + 1, bottom - 6, 4, 1, '#5a3a22');
    pc.vline(cx + 4, bottom - 6, 6, '#5a3a22');
    pc.px(cx + 2, bottom - 12, '#5a3a22');
  }
}

const SHOPS: Record<ShopKind, ShopStyle> = {
  kiosco: {
    name: 'KIOSCO',
    signBg: '#d9342b',
    signText: '#ffe14d',
    awningA: '#d9342b',
    awningB: '#fff4e0',
    interior: '#f4e4c4',
    contents: (pc, x, y, w, h, rng) => {
      for (const sy of [y + Math.round(h * 0.4), y + h - 2]) {
        pc.hline(x, sy, w - 12, '#a8763c');
        for (let i = x + 1; i < x + w - 13; i += 3) pc.rect(i, sy - 3, 2, 3, rng.pick(['#e8433a', '#4fb3ff', '#ffd23f', '#5fd068', '#f08ac0', '#ffffff']));
      }
      pc.rect(x + w - 10, y + 1, 9, h - 1, '#ffffff');
      pc.rect(x + w - 10, y + 1, 9, 3, '#3c7fd9');
      pc.vline(x + w - 2, y + 5, h - 6, '#c9d6e6');
    },
  },
  verduleria: {
    name: 'VERDULERÍA',
    signBg: '#3f8f3a',
    signText: '#ffffff',
    awningA: '#3f8f3a',
    awningB: '#f2f7e8',
    interior: '#e9dcb8',
    contents: (pc, x, y, w, h, rng) => {
      for (let i = x + 1; i + 14 < x + w; i += 15) crate(pc, i, y + h, rng);
      pc.hline(x, y + 5, w, '#a8763c');
      for (let i = x + 2; i < x + w - 2; i += 4) pc.rect(i, y + 2, 3, 3, rng.pick(FRUITS));
    },
    outside: (pc, x, w, bottom, rng) => {
      for (let i = x + 2; i + 14 < x + w - 14; i += 16) crate(pc, i, bottom, rng);
    },
  },
  antiguedades: {
    name: 'ANTIGÜEDADES',
    signBg: '#3a2a20',
    signText: '#e6c35c',
    awningA: '#7a2a33',
    awningB: '#f3e2c4',
    interior: '#3a2f2a',
    contents: (pc, x, y, w, h) => {
      // Gramófono
      pc.rect(x + 4, y + h - 5, 8, 5, '#6b4226');
      pc.vline(x + 9, y + h - 9, 4, '#c9a24a');
      pc.line(x + 9, y + h - 9, x + 15, y + h - 15, '#e6c35c', 2);
      pc.line(x + 12, y + h - 8, x + 16, y + h - 14, '#c9a24a', 2);
      // Lámpara
      pc.rect(x + w - 26, y + 3, 7, 4, '#e8b25a');
      pc.vline(x + w - 23, y + 7, h - 9, '#c9a24a');
      pc.hline(x + w - 25, y + h - 2, 5, '#c9a24a');
      // Cuadros
      pc.rect(x + 22, y + 3, 8, 6, '#e6c35c');
      pc.rect(x + 23, y + 4, 6, 4, '#4f7a5a');
      pc.rect(x + 33, y + 5, 6, 8, '#e6c35c');
      pc.rect(x + 34, y + 6, 4, 6, '#7a4a6a');
    },
  },
  almacen: {
    name: 'ALMACÉN',
    signBg: '#efe0bd',
    signText: '#8a2a2a',
    awningA: '#2f5a8a',
    awningB: '#f4f1e6',
    interior: '#e6d6b0',
    contents: (pc, x, y, w, h, rng) => {
      pc.hline(x, y + Math.round(h / 2), w - 2, '#8a5a2a');
      pc.hline(x, y + h - 1, w - 2, '#8a5a2a');
      for (let i = x + 1; i < x + w - 3; i += 3) {
        const bottle = rng.chance(0.5);
        const c = bottle ? rng.pick(['#2f6b35', '#6b3d1c', '#3c7fd9']) : rng.pick(['#e8433a', '#ffd23f', '#f4f1e6']);
        if (bottle) {
          pc.rect(i, y + Math.round(h / 2) - 5, 2, 5, c);
          pc.px(i, y + Math.round(h / 2) - 6, '#d9d4c8');
        } else pc.rect(i, y + h - 4, 2, 3, c);
      }
      // Salame colgando
      pc.vline(x + w - 8, y, 2, '#3a2a20');
      pc.rect(x + w - 9, y + 2, 3, 6, '#8a3a2a');
    },
  },
  bar: {
    name: 'BAR',
    signBg: '#1f1a24',
    signText: '#fff1cf',
    awningA: '#24563b',
    awningB: '#ead9b5',
    interior: '#d99a4a',
    contents: (pc, x, y, w, h) => {
      pc.hline(x, y + 3, w - 2, '#7a4a24');
      for (let i = x + 2; i < x + w - 4; i += 3) pc.rect(i, y, 1, 3, i % 2 ? '#2f6b35' : '#7a2a20');
      for (let i = x + 4; i < x + w - 10; i += 14) {
        pc.rect(i, y + h - 7, 8, 2, '#4a2a18');
        pc.vline(i + 4, y + h - 5, 5, '#4a2a18');
      }
    },
    outside: (pc, x, _w, bottom) => bistro(pc, x + 4, bottom),
  },
  cafe: {
    name: 'CAFÉ',
    signBg: '#1f1a24',
    signText: '#ffd23f',
    awningA: '#8a2a2a',
    awningB: '#f3e2c4',
    interior: '#e2a54d',
    contents: (pc, x, y, w, h) => {
      pc.hline(x, y + 3, w - 2, '#7a4a24');
      for (let i = x + 4; i < x + w - 10; i += 13) {
        pc.rect(i, y + h - 7, 8, 2, '#4a2a18');
        pc.vline(i + 4, y + h - 5, 5, '#4a2a18');
        pc.rect(i + 2, y + h - 9, 2, 2, '#ffffff');
      }
    },
    outside: (pc, x, w, bottom) => {
      bistro(pc, x + 4, bottom);
      if (w > 70) bistro(pc, x + 34, bottom);
    },
  },
  pizzeria: {
    name: 'PIZZERÍA',
    signBg: '#f2d03c',
    signText: '#c62b22',
    awningA: '#c62b22',
    awningB: '#fff4e0',
    interior: '#e8b25a',
    contents: (pc, x, y, w, h) => {
      pc.ellipse(x + 6, y + h - 12, 16, 10, '#f2c14e');
      pc.ellipse(x + 7, y + h - 11, 14, 8, '#e8692b');
      for (const [dx, dy] of [[10, 4], [14, 6], [17, 3], [12, 8]]) pc.rect(x + 6 + dx - 4, y + h - 12 + dy, 2, 2, '#9a1f1a');
      pc.rect(x + w - 26, y + 2, 12, 9, '#2b2530');
      for (let j = 0; j < 3; j++) pc.hline(x + w - 24, y + 4 + j * 2, 8, '#f4f1e6');
    },
  },
  farmacia: {
    name: 'FARMACIA',
    signBg: '#ffffff',
    signText: '#2e9e4f',
    awningA: '#2e9e4f',
    awningB: '#ffffff',
    interior: '#f2f4f2',
    contents: (pc, x, y, w, h, rng) => {
      for (const sy of [y + 5, y + Math.round(h / 2) + 2, y + h - 1]) {
        pc.hline(x, sy, w - 2, '#b8c4bc');
        for (let i = x + 1; i < x + w - 3; i += 3) pc.rect(i, sy - 3, 2, 3, rng.pick(['#4fb3ff', '#e8433a', '#5fd068', '#ffd23f', '#ffffff', '#b36cf0']));
      }
    },
  },
};

function bayCenters(width: number): number[] {
  const n = Math.max(2, Math.round((width - 16) / 34));
  const span = (width - 16) / n;
  return Array.from({ length: n }, (_, i) => Math.round(8 + span * (i + 0.5)));
}

function drawCornice(pc: PixelCanvas, top: number, W: number, spec: FacadeSpec): void {
  const t = spec.trim;
  pc.rect(0, top, W, 2, shade(t, 0.08));
  pc.rect(0, top + 2, W, 3, shade(t, -0.12));
  for (let x = 2; x < W - 2; x += 4) pc.rect(x, top + 2, 2, 2, t);
  pc.hline(0, top + 5, W, t);
  pc.hline(0, top + 6, W, shade(spec.wall, -0.3));
  pc.hline(0, top + 7, W, shade(spec.wall, -0.14));
}

function drawBalustrade(pc: PixelCanvas, y: number, W: number, trim: string): void {
  pc.rect(0, y, W, 2, trim);
  pc.rect(0, y + 6, W, 2, shade(trim, -0.05));
  for (let x = 3; x < W - 3; x += 4) {
    pc.rect(x, y + 2, 2, 4, shade(trim, -0.08));
    pc.px(x + 1, y + 3, shade(trim, -0.3));
  }
  for (const px of [0, Math.round(W / 2) - 2, W - 5]) {
    pc.rect(px, y - 1, 5, 9, trim);
    pc.vline(px + 4, y - 1, 9, shade(trim, -0.2));
    pc.rect(px + 1, y - 4, 3, 3, trim);
    pc.px(px + 2, y - 5, trim);
  }
}

function drawParapet(pc: PixelCanvas, y: number, W: number, spec: FacadeSpec): void {
  pc.rect(0, y, W, 6, spec.wall);
  pc.rect(0, y - 1, W, 2, shade(spec.trim, -0.05));
}

function drawTank(pc: PixelCanvas, x: number, baseY: number): void {
  pc.vline(x + 2, baseY - 4, 4, '#5a5a62');
  pc.vline(x + 11, baseY - 4, 4, '#5a5a62');
  pc.rect(x, baseY - 13, 14, 9, '#9a9aa3');
  pc.ellipse(x, baseY - 15, 14, 4, '#b4b4bc');
  pc.vline(x + 1, baseY - 12, 7, '#c6c6ce');
  pc.vline(x + 12, baseY - 12, 8, '#77777f');
}

function drawDome(pc: PixelCanvas, cx: number, baseY: number, spec: FacadeSpec): void {
  pc.rect(cx - 12, baseY - 8, 24, 8, spec.trim);
  for (const dx of [-8, -1, 6]) pc.rect(cx + dx, baseY - 6, 3, 4, '#3d3a4f');
  pc.ellipse(cx - 13, baseY - 28, 26, 24, '#4f6f74');
  pc.rect(cx - 13, baseY - 16, 26, 8, '#4f6f74');
  pc.ellipse(cx - 11, baseY - 26, 10, 18, '#7aa0a2');
  pc.ellipse(cx - 9, baseY - 24, 4, 10, '#a6c6c4');
  for (const dx of [-6, 0, 6]) pc.line(cx + dx, baseY - 25, cx + dx * 1.5, baseY - 9, '#3f5c60');
  pc.rect(cx - 2, baseY - 33, 4, 6, spec.trim);
  pc.vline(cx, baseY - 39, 6, '#3a3a40');
  pc.hline(cx - 2, baseY - 37, 5, '#3a3a40');
}

type WindowStyle = 'open' | 'closed' | 'glass';

function drawWindow(pc: PixelCanvas, cx: number, y: number, spec: FacadeSpec, style: WindowStyle): void {
  const w = 12;
  const h = 20;
  const x = Math.round(cx - w / 2);
  const t = spec.trim;
  pc.rect(x - 2, y - 1, w + 4, h + 1, t);
  pc.rect(x - 3, y - 4, w + 6, 3, t);
  pc.hline(x - 2, y - 5, w + 4, shade(t, 0.12));
  pc.rect(cx - 1, y - 5, 2, 4, shade(t, -0.12));
  pc.hline(x - 3, y - 1, w + 6, shade(spec.wall, -0.25));
  if (style === 'closed') {
    pc.rect(x, y, w, h, spec.wood);
    for (let j = y + 1; j < y + h; j += 2) pc.hline(x, j, w, shade(spec.wood, -0.25));
    pc.vline(x + w / 2, y, h, shade(spec.wood, -0.45));
  } else if (style === 'open') {
    pc.rect(x, y, w, h, '#2b2438');
    pc.rect(x + 1, y + 1, 3, h - 1, '#e8d8c0');
    pc.vline(x + 3, y + 1, h - 1, '#cbb89a');
    pc.rect(x + w - 3, y + 1, 2, h - 1, '#d9c7aa');
    for (const sx of [x - 6, x + w + 2]) {
      pc.rect(sx, y, 4, h, spec.wood);
      for (let j = y + 1; j < y + h; j += 2) pc.hline(sx, j, 4, shade(spec.wood, -0.25));
    }
  } else {
    pc.rect(x, y, w, h, '#4f7393');
    pc.line(x + 1, y + h - 3, x + w - 3, y + 2, '#86abc6');
    pc.line(x + 4, y + h - 2, x + w - 2, y + 5, '#6c90ae');
    pc.vline(x + w / 2, y, h, t);
    pc.hline(x, y + 7, w, t);
  }
}

function drawBalcony(pc: PixelCanvas, cx: number, y: number, spec: FacadeSpec, rng: RNG): void {
  const w = 16;
  const x = Math.round(cx - w / 2);
  pc.rect(x - 1, y, w + 2, 2, spec.trim);
  pc.hline(x - 1, y + 2, w + 2, shade(spec.wall, -0.3));
  pc.rect(x, y + 2, 2, 2, shade(spec.trim, -0.15));
  pc.rect(x + w - 2, y + 2, 2, 2, shade(spec.trim, -0.15));
  pc.hline(x - 1, y - 7, w + 2, IRON);
  pc.hline(x - 1, y - 1, w + 2, IRON);
  for (let i = x - 1; i <= x + w; i += 2) pc.vline(i, y - 6, 5, IRON);
  for (let i = x + 1; i < x + w - 1; i += 4) {
    pc.px(i, y - 4, IRON);
    pc.px(i + 1, y - 5, IRON);
    pc.px(i + 1, y - 3, IRON);
  }
  if (spec.plants && rng.chance(0.6)) {
    const px = x + rng.int(0, w - 5);
    pc.rect(px, y - 10, 4, 3, '#b5543a');
    pc.ellipse(px - 2, y - 15, 8, 6, '#3f8a3a');
    pc.px(px, y - 14, '#e8433a');
    pc.px(px + 3, y - 13, '#e8433a');
    pc.px(px + 1, y - 15, '#ff7aa8');
  }
}

function drawAC(pc: PixelCanvas, x: number, y: number, spec: FacadeSpec): void {
  pc.vline(x + 4, y + 7, 9, shade(spec.wall, -0.14));
  pc.rect(x, y, 10, 7, '#5a5a62');
  pc.rect(x + 1, y + 1, 8, 5, '#d9d9d6');
  for (let j = y + 2; j < y + 6; j++) pc.hline(x + 2, j, 4, j % 2 ? '#a6a6a2' : '#c4c4c0');
  pc.rect(x + 7, y + 2, 1, 3, '#8a8a86');
}

function drawFlag(pc: PixelCanvas, x: number, y: number): void {
  pc.line(x, y, x + 6, y - 6, '#5a5a62');
  pc.rect(x + 6, y - 12, 12, 3, '#74b9e8');
  pc.rect(x + 6, y - 9, 12, 3, '#ffffff');
  pc.rect(x + 6, y - 6, 12, 3, '#74b9e8');
  pc.px(x + 12, y - 8, '#f2c23c');
}

function drawCat(pc: PixelCanvas, x: number, y: number): void {
  const c = '#2b2530';
  pc.rect(x, y - 5, 5, 5, c);
  pc.rect(x + 1, y - 8, 4, 3, c);
  pc.px(x + 1, y - 9, c);
  pc.px(x + 4, y - 9, c);
  pc.px(x + 2, y - 7, '#9be04f');
  pc.px(x + 4, y - 7, '#9be04f');
  pc.line(x - 1, y - 1, x - 3, y - 5, c);
}

function drawDoor(pc: PixelCanvas, cx: number, bottom: number, spec: FacadeSpec): void {
  const w = 14;
  const h = 31;
  const x = cx - 7;
  const y = bottom - h;
  pc.ellipse(x - 2, y - 8, w + 4, 14, spec.trim);
  pc.rect(x - 2, y - 2, w + 4, h + 2, spec.trim);
  pc.ellipse(x, y - 6, w, 12, '#3a5468');
  pc.vline(cx, y - 6, 6, spec.trim);
  pc.line(cx, y, x + 2, y - 3, spec.trim);
  pc.line(cx, y, x + w - 3, y - 3, spec.trim);
  pc.rect(x, y, w, h, spec.wood);
  pc.vline(cx, y, h, shade(spec.wood, -0.4));
  for (const px of [x + 2, cx + 2]) {
    pc.rect(px, y + 3, 3, 10, shade(spec.wood, 0.14));
    pc.rect(px, y + 17, 3, 11, shade(spec.wood, 0.14));
    pc.vline(px + 3, y + 3, 10, shade(spec.wood, -0.2));
  }
  pc.px(cx - 2, y + 15, '#e6c35c');
  pc.px(cx + 1, y + 15, '#e6c35c');
  pc.rect(x - 3, bottom, w + 6, 2, '#bdb4a6');
}

function drawBarredWindow(pc: PixelCanvas, cx: number, y: number, spec: FacadeSpec): void {
  const w = 12;
  const h = 20;
  const x = cx - 6;
  pc.rect(x - 2, y - 2, w + 4, h + 4, spec.trim);
  pc.rect(x, y, w, h, '#3d3a4f');
  pc.rect(x + 1, y + 1, 3, h - 2, '#5d6a85');
  for (let i = x; i < x + w; i += 2) pc.vline(i, y - 1, h + 2, IRON);
  pc.hline(x, y + 3, w, IRON);
  pc.hline(x, y + h - 4, w, IRON);
  pc.rect(x - 3, y + h + 2, w + 6, 2, shade(spec.trim, -0.12));
}

function drawGraffiti(pc: PixelCanvas, x: number, y: number, w: number, h: number, rng: RNG): void {
  const tmp = new PixelCanvas(w + 6, h + 6);
  const colors = ['#e04fa0', '#9be04f', '#4fd6e0', '#ff8a1f', '#ffe14d', '#b36cf0', '#ffffff'];
  const c1 = rng.pick(colors);
  let px = 3;
  let py = 3 + rng.int(1, h - 1);
  while (px < w) {
    const nx = Math.min(w + 2, px + rng.int(3, 7));
    const ny = 3 + rng.int(0, h);
    tmp.line(px, py, nx, ny, c1, 2);
    px = nx;
    py = ny;
  }
  const c2 = rng.pick(colors.filter((c) => c !== c1));
  for (let i = 0; i < 3; i++) tmp.px(3 + rng.int(0, w), 3 + rng.int(0, h), c2);
  tmp.outline('#1f1a24');
  pc.draw(tmp, x - 3, y - 3);
}

function drawPoster(pc: PixelCanvas, x: number, y: number, rng: RNG, wall: string): void {
  const w = rng.int(8, 11);
  const h = rng.int(11, 14);
  const bg = rng.pick(['#f2d03c', '#e8433a', '#4fb3ff', '#ffffff', '#ff8a1f', '#9be04f', '#f0a0c8']);
  pc.rect(x, y, w, h, bg);
  pc.rect(x + 1, y + 2, w - 2, 3, shade(bg, -0.45));
  for (let j = y + 7; j < y + h - 1; j += 2) pc.hline(x + 1, j, rng.int(3, w - 2), shade(bg, -0.3));
  if (rng.chance(0.5)) {
    pc.px(x + w - 1, y, wall);
    pc.px(x + w - 2, y, wall);
    pc.px(x + w - 1, y + 1, wall);
  }
}

function drawShop(pc: PixelCanvas, y0: number, W: number, H: number, spec: FacadeSpec, rng: RNG): void {
  const style = SHOPS[spec.shop ?? 'kiosco'];
  const sx = 7;
  const sw = W - 14;
  // Cartel
  pc.rect(sx, y0 + 2, sw, 12, shade(style.signBg, -0.35));
  pc.rect(sx + 1, y0 + 3, sw - 2, 10, style.signBg);
  const textW = measureText(style.name);
  pc.text(style.name, Math.round(sx + sw / 2 - textW / 2), y0 + 6, style.signText);
  if (spec.shop === 'farmacia') {
    for (const cx of [sx + 6, sx + sw - 7]) {
      pc.rect(cx - 1, y0 + 5, 3, 7, '#2e9e4f');
      pc.rect(cx - 3, y0 + 7, 7, 3, '#2e9e4f');
    }
  }
  if (spec.shop === 'bar' || spec.shop === 'cafe') {
    // Firuletes de filete porteño a los costados del cartel.
    for (const [cx, dir] of [[sx + 6, 1], [sx + sw - 7, -1]] as const) {
      pc.px(cx, y0 + 8, '#e8433a');
      pc.px(cx + dir, y0 + 7, '#ffd23f');
      pc.px(cx + dir * 2, y0 + 6, '#5fd068');
      pc.px(cx + dir, y0 + 9, '#ffd23f');
      pc.px(cx + dir * 2, y0 + 10, '#5fd068');
      pc.px(cx - dir, y0 + 8, '#4fb3ff');
    }
  }
  // Toldo a rayas con festón
  const ay = y0 + 15;
  for (let x = sx - 2; x < sx + sw + 2; x++) {
    const stripe = Math.floor((x - sx + 2) / 4) % 2 === 0;
    const c = stripe ? style.awningA : style.awningB;
    pc.vline(x, ay, 5, c);
    if ((x - sx + 2) % 4 === 1 || (x - sx + 2) % 4 === 2) pc.px(x, ay + 5, c);
  }
  pc.hline(sx - 2, ay, sw + 4, shade(style.awningA, 0.2));
  pc.hline(sx, ay + 6, sw, shade(spec.wall, -0.3));
  // Vidriera y puerta
  const wy = ay + 8;
  const doorW = 12;
  const glassW = sw - doorW - 4;
  pc.rect(sx, wy, sw, H - wy, spec.wood);
  pc.rect(sx + 2, wy + 1, glassW, H - 7 - wy, style.interior);
  style.contents(pc, sx + 2, wy + 1, glassW, H - 7 - wy, rng);
  pc.line(sx + 4, H - 9, sx + 12, wy + 2, 'rgba(255,255,255,0.35)');
  pc.line(sx + 8, H - 9, sx + 14, wy + 4, 'rgba(255,255,255,0.22)');
  const dx = sx + sw - doorW - 1;
  pc.rect(dx, wy + 1, doorW, H - wy - 1, shade(spec.wood, -0.15));
  pc.rect(dx + 2, wy + 3, doorW - 4, H - wy - 9, '#5d7288');
  pc.line(dx + 3, H - 8, dx + 8, wy + 4, 'rgba(255,255,255,0.3)');
  pc.px(dx + 2, Math.round((wy + H) / 2), '#e6c35c');
  pc.rect(sx, H - 6, glassW + 3, 6, shade(spec.wood, -0.3));
  style.outside?.(pc, sx, glassW, H, rng);
}

function drawGroundFloor(pc: PixelCanvas, W: number, H: number, spec: FacadeSpec, rng: RNG): void {
  const y0 = H - GROUND_H;
  const plinth = mix(shade(spec.wall, -0.35), '#8f877c', 0.4);
  pc.rect(0, y0, W, 2, spec.trim);
  pc.hline(0, y0 + 2, W, shade(spec.wall, -0.2));
  pc.rect(0, H - 6, W, 6, plinth);
  pc.hline(0, H - 6, W, shade(plinth, 0.18));

  const bays = bayCenters(W);
  const freeSpans: [number, number][] = [];

  if (spec.ground === 'door') {
    const doorBay = Math.floor(bays.length / 2);
    bays.forEach((cx, i) => {
      if (i === doorBay) drawDoor(pc, cx, H - 2, spec);
      else drawBarredWindow(pc, cx, y0 + 12, spec);
    });
    let last = 3;
    for (const cx of bays) {
      freeSpans.push([last, cx - 10]);
      last = cx + 10;
    }
    freeSpans.push([last, W - 3]);
  } else if (spec.ground === 'shop') {
    drawShop(pc, y0, W, H, spec, rng);
  } else if (spec.ground === 'garage') {
    const gw = Math.min(42, W - 34);
    const gx = Math.round((W - gw) / 2);
    const gy = y0 + 12;
    pc.rect(gx - 2, gy - 2, gw + 4, H - gy + 2, spec.trim);
    pc.rect(gx, gy, gw, H - gy, '#9b9ba3');
    for (let j = gy + 1; j < H; j += 2) pc.hline(gx, j, gw, '#7d7d86');
    pc.rect(gx + 2, gy - 10, gw - 4, 7, '#f4f4f0');
    pc.rect(gx + 2, gy - 10, gw - 4, 1, '#c62b22');
    pc.rect(gx + 2, gy - 4, gw - 4, 1, '#c62b22');
    const label = 'GARAGE';
    pc.text(label, Math.round(gx + gw / 2 - measureText(label) / 2), gy - 9 + 1, '#c62b22');
    drawGraffiti(pc, gx + 4, gy + 6, gw - 10, 12, rng);
    freeSpans.push([3, gx - 4], [gx + gw + 4, W - 3]);
  } else {
    // Paredón con mural
    pc.rect(4, y0 + 8, W - 8, GROUND_H - 16, shade(spec.wall, -0.06));
    drawGraffiti(pc, 10, y0 + 14, W - 26, 14, rng);
    drawGraffiti(pc, 18, y0 + 22, W - 40, 8, rng);
    freeSpans.push([3, W - 3]);
  }

  // Afiches y grafitis en los tramos libres de pared.
  let posters = spec.posters ?? 0;
  for (const [a, b] of rng.shuffle([...freeSpans])) {
    if (posters <= 0) break;
    if (b - a >= 12) {
      drawPoster(pc, rng.int(a, b - 11), y0 + rng.int(9, 18), rng, spec.wall);
      posters--;
    }
  }
  if (spec.graffiti && spec.ground !== 'wall') {
    const span = freeSpans.find(([a, b]) => b - a >= 14);
    if (span) drawGraffiti(pc, span[0] + 1, H - 16, Math.min(22, span[1] - span[0] - 4), 6, rng);
  }
}

function drawUpperFloor(pc: PixelCanvas, y0: number, W: number, spec: FacadeSpec, rng: RNG, floorIndex: number): void {
  const bays = bayCenters(W);
  bays.forEach((cx, i) => {
    const style = rng.pick<WindowStyle>(['open', 'closed', 'closed', 'glass']);
    drawWindow(pc, cx, y0 + 6, spec, style);
    drawBalcony(pc, cx, y0 + 26, spec, rng);
    if (spec.ac && i < bays.length - 1 && rng.chance(0.4)) drawAC(pc, cx + 10, y0 + 9, spec);
  });
  if (spec.flag && floorIndex === spec.floors - 1) drawFlag(pc, bays[0] + 8, y0 + 20);
  if (spec.cat && floorIndex === spec.floors - 1) drawCat(pc, bays[bays.length - 1] - 2, y0 + 19);
  pc.hline(0, y0 + FLOOR_H - 2, W, shade(spec.trim, -0.05));
  pc.hline(0, y0 + FLOOR_H - 1, W, shade(spec.wall, -0.15));
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function drawFacade(spec: FacadeSpec): PixelCanvas {
  const W = spec.width;
  const H = facadeHeight(spec);
  const pc = new PixelCanvas(W, H);
  const rng = new RNG(hashString(spec.id));
  const rnd = () => rng.next();
  const top = TOP_EXTRA;

  pc.rect(0, top, W, H - top, spec.wall);
  pc.speckle(0, top, W, H - top, [shade(spec.wall, -0.07), shade(spec.wall, 0.07)], 0.04, rnd);

  for (let f = 0; f < spec.floors; f++) drawUpperFloor(pc, top + CORNICE_H + f * FLOOR_H, W, spec, rng, spec.floors - 1 - f);
  drawGroundFloor(pc, W, H, spec, rng);

  // Ochava de esquina: cara lateral en sombra.
  if (spec.corner) {
    const cx = spec.corner === 'left' ? 0 : W - 10;
    pc.rect(cx, top, 10, H - top, shade(spec.wall, -0.2));
    for (let y = top + CORNICE_H + 6; y < H - 20; y += FLOOR_H) pc.rect(cx + 3, y, 4, 18, '#3d3a4f');
  }

  // Pilastras laterales que separan una casa de la otra.
  pc.rect(0, top, 2, H - top, shade(spec.wall, -0.1));
  pc.vline(W - 1, top, H - top, shade(spec.wall, -0.32));
  pc.vline(W - 2, top, H - top, shade(spec.wall, -0.12));

  drawCornice(pc, top, W, spec);
  if (spec.roof === 'balustrade') drawBalustrade(pc, top - 8, W, spec.trim);
  else if (spec.roof === 'parapet') drawParapet(pc, top - 5, W, spec);
  else if (spec.roof === 'dome') {
    drawBalustrade(pc, top - 8, W, spec.trim);
    drawDome(pc, spec.corner === 'right' ? W - 22 : 22, top - 8, spec);
  }
  if (spec.tank) {
    const lift = spec.roof === 'balustrade' ? 8 : spec.roof === 'parapet' ? 5 : 0;
    drawTank(pc, rng.int(8, W - 24), top - lift);
  }
  return pc;
}

export function generateFacadeTextures(textures: Phaser.Textures.TextureManager): void {
  for (const spec of [...FACADE_SPECS, ...CORNER_SPECS]) {
    drawFacade(spec).addTo(textures, TEX.facade(spec.id));
  }
}
