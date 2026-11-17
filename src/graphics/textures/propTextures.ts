import Phaser from 'phaser';
import { packStrip, PixelCanvas } from '../PixelCanvas';
import { PROP_FRAMES, TEX } from '../keys';
import { PAL } from '../../config/palette';
import { RNG } from '../../core/rng';
import { mix, shade } from '../color';
import { measureText } from '../fontData';

/** Medidas de los árboles: la base del tronco está en el borde inferior del lienzo. */
export const TREE_SIZE = { w: 72, h: 140 };

interface CanopyPalette {
  dark: string;
  mid: string;
  light: string;
  shine: string;
  outline: string;
}

const PLATANO: CanopyPalette = { dark: PAL.leafDark, mid: PAL.leaf, light: PAL.leafLight, shine: PAL.leafShine, outline: '#173a1b' };
const JACARANDA: CanopyPalette = { dark: '#5a3f9e', mid: '#7f62c9', light: '#a58be0', shine: '#cbb8f2', outline: '#2c1d52' };

function drawTree(seed: number, canopy: CanopyPalette): PixelCanvas {
  const { w: W, h: H } = TREE_SIZE;
  const pc = new PixelCanvas(W, H);
  const rng = new RNG(seed);
  const baseX = 36;
  const trunkTop = 50;

  // Tronco de plátano con manchas de corteza.
  for (let y = trunkTop; y < H; y++) {
    const t = (y - trunkTop) / (H - trunkTop);
    const half = 3 + t * 1.4;
    const x0 = Math.round(baseX - half);
    const x1 = Math.round(baseX + half);
    pc.rect(x0, y, x1 - x0, 1, PAL.bark);
    pc.px(x1 - 1, y, PAL.barkDark);
    pc.px(x0, y, mix(PAL.bark, PAL.barkLight, 0.4));
  }
  for (let i = 0; i < 22; i++) {
    pc.rect(baseX + rng.int(-3, 1), rng.int(trunkTop, H - 5), 2, rng.int(2, 4), rng.pick([PAL.barkLight, '#9aa070', '#8a7a5c', '#c2b393']));
  }
  pc.rect(baseX - 6, H - 3, 12, 3, PAL.bark);
  pc.hline(baseX - 6, H - 1, 12, PAL.barkDark);
  pc.line(baseX, trunkTop + 8, baseX - 15, trunkTop - 12, PAL.bark, 3);
  pc.line(baseX, trunkTop + 6, baseX + 13, trunkTop - 16, PAL.bark, 3);
  pc.line(baseX, trunkTop + 2, baseX + 1, trunkTop - 22, PAL.bark, 3);

  const blobs = [
    { x: 36, y: 32, r: 22 },
    { x: 17, y: 38, r: 15 },
    { x: 55, y: 36, r: 15 },
    { x: 24, y: 20, r: 14 },
    { x: 48, y: 18, r: 15 },
    { x: 36, y: 13, r: 12 },
  ];
  blobs.forEach((b) => pc.disc(b.x, b.y + 2, b.r, canopy.dark));
  blobs.forEach((b) => pc.disc(b.x, b.y, b.r - 1, canopy.mid));
  blobs.forEach((b) => pc.disc(Math.round(b.x - b.r * 0.3), Math.round(b.y - b.r * 0.35), Math.round(b.r * 0.5), canopy.light));
  // Textura de follaje: grupitos oscuros y brillos.
  for (let i = 0; i < 90; i++) {
    const b = rng.pick(blobs);
    const a = rng.next() * Math.PI * 2;
    const r = rng.next() * (b.r - 3);
    const x = Math.round(b.x + Math.cos(a) * r);
    const y = Math.round(b.y + Math.sin(a) * r);
    const lower = y > b.y;
    pc.rect(x, y, 2, 1, lower ? canopy.dark : canopy.shine);
    if (lower) pc.px(x + 1, y + 1, canopy.dark);
  }
  pc.outline(canopy.outline);
  return pc;
}

function drawLamp(): PixelCanvas {
  const pc = new PixelCanvas(16, 82);
  const iron = '#24302b';
  const ironLight = '#3d5048';
  pc.rect(3, 76, 10, 5, iron);
  pc.rect(4, 70, 8, 6, iron);
  pc.vline(5, 70, 6, ironLight);
  pc.rect(5, 66, 6, 4, iron);
  pc.rect(7, 22, 2, 44, iron);
  pc.vline(7, 22, 44, ironLight);
  pc.rect(5, 44, 6, 2, iron);
  pc.rect(6, 24, 4, 2, iron);
  // Farol: techito, vidrio y remate
  pc.rect(4, 19, 8, 3, iron);
  pc.rect(3, 8, 10, 11, iron);
  pc.rect(4, 9, 8, 9, '#f6eebc');
  pc.rect(4, 9, 2, 9, '#fff9dc');
  pc.vline(8, 9, 9, iron);
  pc.rect(2, 6, 12, 2, iron);
  pc.rect(4, 4, 8, 2, iron);
  pc.rect(6, 2, 4, 2, iron);
  pc.px(7, 0, iron);
  pc.px(7, 1, iron);
  pc.outline(PAL.outline);
  return pc;
}

function drawBin(withBags: boolean): PixelCanvas {
  const pc = new PixelCanvas(withBags ? 26 : 12, 24);
  pc.rect(5, 12, 2, 12, '#4a4a52');
  pc.rect(1, 3, 10, 10, '#e07a2c');
  pc.rect(1, 3, 10, 2, '#f29a4c');
  pc.rect(0, 2, 12, 2, '#5a5a62');
  for (let x = 2; x < 10; x += 3) pc.vline(x, 6, 6, '#b85a1c');
  pc.vline(10, 4, 9, '#b85a1c');
  if (withBags) {
    // Bolsas de basura apiladas al pie del cesto (clásico porteño).
    pc.ellipse(10, 15, 10, 9, '#24222a');
    pc.ellipse(16, 13, 10, 11, '#2f2c36');
    pc.px(13, 16, '#55505f');
    pc.px(19, 15, '#55505f');
    pc.rect(20, 13, 2, 2, '#55505f');
    pc.px(20, 12, '#2f2c36');
    pc.px(21, 11, '#2f2c36');
  }
  pc.outline(PAL.outline);
  return pc;
}

function drawBusStop(): PixelCanvas {
  const pc = new PixelCanvas(16, 60);
  pc.rect(7, 14, 2, 46, '#9a9aa3');
  pc.vline(7, 14, 46, '#c6c6ce');
  pc.rect(0, 0, 16, 16, '#1f4f8f');
  pc.rect(1, 1, 14, 14, '#2f6fbf');
  pc.rect(1, 11, 14, 3, '#ffd23f');
  // Pictograma de colectivo
  pc.rect(3, 3, 10, 6, '#ffffff');
  pc.rect(4, 4, 3, 2, '#2f6fbf');
  pc.rect(8, 4, 3, 2, '#2f6fbf');
  pc.px(5, 9, '#ffffff');
  pc.px(11, 9, '#ffffff');
  pc.outline(PAL.outline);
  return pc;
}

function drawCafeTable(): PixelCanvas {
  const pc = new PixelCanvas(26, 16);
  pc.rect(8, 6, 10, 2, '#e6e1d6');
  pc.vline(13, 8, 7, '#3a3238');
  pc.hline(10, 15, 7, '#3a3238');
  for (const cx of [1, 21]) {
    pc.vline(cx + 1, 2, 14, '#5a3a22');
    pc.rect(cx + 1, 9, 4, 1, '#5a3a22');
    pc.vline(cx + 4, 9, 6, '#5a3a22');
  }
  pc.rect(10, 4, 2, 2, '#ffffff');
  pc.outline(PAL.outline);
  return pc;
}

function drawTreePit(): PixelCanvas {
  const pc = new PixelCanvas(26, 10);
  pc.rect(0, 0, 26, 10, '#bcb6aa');
  pc.rect(1, 1, 24, 8, PAL.soil);
  pc.dither(2, 2, 22, 6, PAL.soilDark);
  pc.hline(0, 0, 26, '#d8d2c6');
  pc.px(5, 6, PAL.dryLeaf1);
  pc.px(19, 3, PAL.dryLeaf2);
  pc.px(16, 7, PAL.dryLeaf3);
  return pc;
}

function drawRootTiles(): PixelCanvas {
  // Baldosas levantadas por las raíces: inclinadas y partidas.
  const pc = new PixelCanvas(34, 11);
  const tiles = [
    { x: 0, y: 3, c: PAL.tileLight },
    { x: 8, y: 1, c: PAL.tile },
    { x: 18, y: 2, c: PAL.tileLight },
    { x: 26, y: 4, c: PAL.tile },
  ];
  for (const t of tiles) {
    pc.rect(t.x, t.y + 1, 9, 6, '#6e6450');
    pc.rect(t.x, t.y, 8, 6, t.c);
    pc.hline(t.x, t.y, 8, shade(t.c, 0.1));
  }
  pc.line(4, 5, 7, 8, '#6e6450');
  pc.line(20, 3, 23, 7, '#6e6450');
  pc.line(12, 9, 26, 9, PAL.barkDark);
  pc.line(14, 10, 22, 10, PAL.bark);
  return pc;
}

function drawNewsKiosk(): PixelCanvas {
  const pc = new PixelCanvas(46, 50);
  const green = '#2f6b4a';
  pc.rect(5, 12, 36, 36, green);
  pc.rect(5, 12, 36, 2, shade(green, 0.2));
  pc.rect(1, 6, 44, 6, shade(green, -0.25));
  pc.rect(0, 4, 46, 3, shade(green, -0.4));
  const label = 'DIARIOS';
  pc.text(label, Math.round(23 - measureText(label) / 2), 6, '#ffd23f');
  const rng = new RNG(8);
  for (let y = 16; y < 40; y += 8) {
    for (let x = 8; x < 38; x += 6) {
      const c = rng.pick(['#e8433a', '#ffd23f', '#4fb3ff', '#ffffff', '#f08ac0', '#5fd068']);
      pc.rect(x, y, 5, 7, c);
      pc.hline(x + 1, y + 2, 3, shade(c, -0.4));
    }
  }
  pc.rect(5, 46, 36, 4, shade(green, -0.3));
  pc.outline(PAL.outline);
  return pc;
}

interface CarStyle {
  body: string;
  top?: string;
  small?: boolean;
  taxi?: boolean;
}

function drawCar(style: CarStyle): PixelCanvas {
  const W = style.small ? 56 : 78;
  const pc = new PixelCanvas(W, 32);
  const body = style.body;
  const dark = shade(body, -0.35);
  const light = shade(body, 0.25);
  const glass = '#9ccbe0';
  const top = style.top ?? body;
  const wheelY = 25;
  if (style.small) {
    pc.ellipse(2, 8, 52, 30, top);
    pc.rect(2, 16, 52, 9, body);
    pc.rect(12, 9, 13, 7, glass);
    pc.rect(28, 9, 14, 7, glass);
    pc.line(13, 15, 18, 10, '#d4ecf7');
    pc.hline(2, 16, 52, light);
    pc.vline(26, 16, 8, dark);
  } else {
    pc.rect(2, 13, 74, 11, body);
    pc.rect(4, 12, 70, 2, body);
    pc.rect(20, 4, 36, 9, top);
    pc.line(14, 12, 20, 4, top, 2);
    pc.line(62, 12, 56, 4, top, 2);
    pc.rect(21, 5, 15, 7, glass);
    pc.rect(39, 5, 15, 7, glass);
    pc.line(16, 12, 21, 6, glass);
    pc.line(60, 12, 55, 6, glass);
    pc.line(23, 11, 27, 6, '#d4ecf7');
    pc.hline(2, 13, 74, light);
    pc.vline(37, 13, 10, dark);
    pc.vline(56, 13, 10, dark);
    pc.rect(31, 16, 3, 1, dark);
    pc.rect(50, 16, 3, 1, dark);
    if (style.taxi) {
      pc.rect(31, 1, 14, 3, '#ffffff');
      pc.hline(33, 2, 10, '#1f1a24');
    }
  }
  // Paragolpes y luces
  pc.rect(0, 19, 4, 4, '#b4b4bc');
  pc.rect(W - 4, 19, 4, 4, '#b4b4bc');
  pc.rect(W - 4, 15, 3, 3, '#fff6c8');
  pc.rect(1, 15, 3, 3, '#e8433a');
  // Ruedas
  for (const wx of style.small ? [12, W - 13] : [16, W - 17]) {
    pc.disc(wx, wheelY, 7, dark);
    pc.disc(wx, wheelY, 5, '#1f1a24');
    pc.disc(wx, wheelY, 2, '#b4b4bc');
  }
  pc.outline(PAL.outline);
  return pc;
}

function drawContainer(): PixelCanvas {
  const pc = new PixelCanvas(40, 30);
  const green = '#4f6b55';
  pc.rect(3, 6, 34, 18, green);
  pc.rect(1, 3, 38, 4, shade(green, -0.3));
  pc.rect(3, 12, 34, 2, '#e8e8e4');
  for (let x = 6; x < 36; x += 6) pc.vline(x, 15, 8, shade(green, -0.2));
  pc.disc(9, 26, 3, '#1f1a24');
  pc.disc(31, 26, 3, '#1f1a24');
  // Una bolsa que asoma
  pc.ellipse(24, 0, 10, 6, '#2f2c36');
  pc.outline(PAL.outline);
  return pc;
}

function drawPigeonFrames(): { name: string; canvas: PixelCanvas }[] {
  const body = '#8c93a6';
  const dark = '#5d6375';
  const make = (headDown: boolean, wings: 'none' | 'up' | 'down'): PixelCanvas => {
    const pc = new PixelCanvas(12, 10);
    pc.ellipse(2, 4, 8, 4, body);
    pc.rect(0, 5, 3, 2, dark);
    if (headDown) {
      pc.rect(8, 6, 3, 2, body);
      pc.px(11, 7, '#e8b25a');
      pc.px(9, 6, '#1f1a24');
      pc.px(8, 5, '#5fae8a');
    } else {
      pc.rect(8, 2, 3, 3, body);
      pc.px(11, 3, '#e8b25a');
      pc.px(9, 2, '#1f1a24');
      pc.px(8, 5, '#5fae8a');
      pc.px(9, 5, '#9a6fb0');
    }
    if (wings === 'up') pc.line(3, 4, 6, 0, dark, 2);
    else if (wings === 'down') pc.line(3, 6, 6, 9, dark, 2);
    else pc.hline(3, 5, 4, dark);
    if (wings === 'none') {
      pc.px(5, 8, '#e88a8a');
      pc.px(7, 8, '#e88a8a');
    }
    pc.outline('#2b2530');
    return pc;
  };
  return [
    { name: 'peck0', canvas: make(false, 'none') },
    { name: 'peck1', canvas: make(true, 'none') },
    { name: 'fly0', canvas: make(false, 'up') },
    { name: 'fly1', canvas: make(false, 'down') },
  ];
}

/** Cartel de calle de la esquina (fondo negro y letras blancas). */
export function ensureCornerSign(textures: Phaser.Textures.TextureManager, street: string): string {
  const key = TEX.cornerSign(street);
  if (textures.exists(key)) return key;
  const label = street.toUpperCase();
  const tw = measureText(label);
  const W = Math.max(30, tw + 10);
  const pc = new PixelCanvas(W, 66);
  const cx = Math.floor(W / 2);
  pc.rect(cx - 1, 12, 3, 54, '#8a8a92');
  pc.vline(cx - 1, 12, 54, '#b4b4bc');
  pc.rect(0, 0, W, 13, '#f4f4f0');
  pc.rect(1, 1, W - 2, 11, '#1f1a24');
  pc.text(label, Math.round(cx - tw / 2), 4, '#ffffff');
  pc.outline(PAL.outline);
  pc.addTo(textures, key);
  return key;
}

export const CAR_STYLES: CarStyle[] = [
  { body: '#c62b22' },
  { body: '#2f5a8a' },
  { body: '#e8e8e4' },
  { body: '#1f1a24', top: '#f2c23c', taxi: true },
  { body: '#7fb8d9', small: true },
  { body: '#d8c49a' },
  { body: '#e8833a', small: true },
  { body: '#3f7a4a' },
];

export function generatePropTextures(textures: Phaser.Textures.TextureManager): void {
  drawTree(31, PLATANO).addTo(textures, TEX.tree(0));
  drawTree(57, PLATANO).addTo(textures, TEX.tree(1));
  drawTree(83, JACARANDA).addTo(textures, TEX.tree(2));
  drawLamp().addTo(textures, TEX.lamp);
  drawNewsKiosk().addTo(textures, TEX.newsKiosk);
  drawContainer().addTo(textures, TEX.container);
  CAR_STYLES.forEach((s, i) => drawCar(s).addTo(textures, TEX.car(i)));

  packStrip(textures, TEX.props, [
    { name: PROP_FRAMES.bin, canvas: drawBin(false) },
    { name: PROP_FRAMES.bags, canvas: drawBin(true) },
    { name: PROP_FRAMES.busStop, canvas: drawBusStop() },
    { name: PROP_FRAMES.cafeTable, canvas: drawCafeTable() },
    { name: PROP_FRAMES.treePit, canvas: drawTreePit() },
    { name: PROP_FRAMES.rootTiles, canvas: drawRootTiles() },
  ]);

  packStrip(textures, TEX.pigeon, drawPigeonFrames());
}
