import Phaser from 'phaser';
import { packStrip, PixelCanvas, type CharPalette, type PackedFrame } from '../PixelCanvas';
import { POOP_FRAMES, TEX } from '../keys';
import { PAL } from '../../config/palette';
import { RNG } from '../../core/rng';

/** Paleta estándar de los soretes. */
const POOP_PAL: CharPalette = {
  D: PAL.poopDark,
  M: PAL.poop,
  m: PAL.poopMid,
  L: PAL.poopLight,
  H: PAL.poopShine,
};

/** Paleta apagada para el sorete camuflado entre hojas. */
const CAMO_PAL: CharPalette = {
  D: '#2e1a0c',
  M: '#5a3418',
  m: '#6e4320',
  L: '#8a5a2c',
  H: '#a8743c',
};

const PILE = [
  '.......D......',
  '......DLD.....',
  '....DDLmMD....',
  '...DHLmMMMD...',
  '...DmMMMMDD...',
  '..DDLLLmMMMD..',
  '.DHLmMMMMMMMD.',
  '.DmMMMMMMMMDD.',
  'DDHLLLmMMMMMMD',
  'DLmMMMMMMMMMMD',
  'DmMMMMMMMMMMMD',
  '.DDDDDDDDDDDD.',
];

const LOG = [
  '..DDDDDDDDDD....',
  '.DLLHLLmmMMMDD..',
  'DLmMMMMDMMMMMMD.',
  'DmMMMMMMDMMMMMMD',
  'DMMMMMMMMDMMMMMD',
  '.DDMMMMMMMMMMDD.',
  '...DDDDDDDDDD...',
];

const NUGGETS = [
  '..D..........',
  '.DLD.....D...',
  'DLmMD...DLD..',
  'DmMMD..DLmMD.',
  'DMMMMD.DmMMMD',
  '.DDDD..DMMMMD',
  '........DDDD.',
];

const SQUASH = [
  '...DDDDDDDDD....',
  '.DDmMLmMLmMMDD..',
  'DmMLMLMLMLMMMMD.',
  'DMMMMMMMMMMMMMMD',
  '.DDMMMMMMMMMMDD.',
  '...DDDDDDDDDD...',
];

const CAMO = [
  '....DD....',
  '...DLmD...',
  '..DmMMMD..',
  '.DLmMMMMD.',
  'DmMMMMMMMD',
  'DMMMMMMMMD',
  '.DDDDDDDD.',
];

/** Crea una celda con 1 px de margen para el contorno y la contornea. */
function cell(w: number, h: number, draw: (pc: PixelCanvas) => void, outline = true): PixelCanvas {
  const pc = new PixelCanvas(w + 2, h + 2);
  draw(pc);
  if (outline) pc.outline(PAL.outline);
  return pc;
}

function drawGiant(pc: PixelCanvas, ox: number, oy: number): void {
  const rolls = [
    { x: 0, y: 15, w: 30, h: 9 },
    { x: 3, y: 10, w: 24, h: 8 },
    { x: 6, y: 6, w: 18, h: 7 },
    { x: 9, y: 2, w: 12, h: 6 },
  ];
  for (const r of rolls) {
    pc.ellipse(ox + r.x, oy + r.y, r.w, r.h, PAL.poopDark);
    pc.ellipse(ox + r.x + 1, oy + r.y, r.w - 2, r.h - 1, PAL.poop);
    pc.ellipse(ox + r.x + 2, oy + r.y + 1, Math.round(r.w * 0.6), Math.max(2, r.h - 4), PAL.poopMid);
    pc.ellipse(ox + r.x + 3, oy + r.y + 1, Math.round(r.w * 0.32), 2, PAL.poopLight);
    pc.px(ox + r.x + 4, oy + r.y + 1, PAL.poopShine);
  }
  pc.rect(ox + 14, oy, 2, 3, PAL.poop);
  pc.px(ox + 15, oy, PAL.poopDark);
  pc.px(ox + 14, oy + 1, PAL.poopLight);
  // Detalles asquerosos (granitos de choclo).
  pc.px(ox + 21, oy + 19, '#e8c84a');
  pc.px(ox + 8, oy + 13, '#e8c84a');
  pc.px(ox + 17, oy + 8, '#e8c84a');
}

function drawGiantSquash(pc: PixelCanvas, ox: number, oy: number): void {
  pc.ellipse(ox, oy + 2, 32, 9, PAL.poopDark);
  pc.ellipse(ox + 1, oy + 2, 30, 8, PAL.poop);
  pc.ellipse(ox + 4, oy + 3, 20, 5, PAL.poopMid);
  pc.ellipse(ox + 9, oy, 14, 6, PAL.poop);
  pc.ellipse(ox + 10, oy + 1, 8, 3, PAL.poopLight);
  // Marca de suela
  for (let i = 0; i < 6; i++) pc.px(ox + 12 + i * 2, oy + 6, PAL.poopLight);
}

function drawTile(pc: PixelCanvas, x: number, y: number, base: string): void {
  pc.rect(x, y, 16, 8, base);
  // Relieve de 9 cuadraditos típico de la baldosa porteña "vainilla".
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      pc.px(x + 4 + i * 4, y + 1 + j * 2, PAL.tileLight);
      pc.px(x + 4 + i * 4, y + 2 + j * 2, PAL.tileDark);
    }
  }
}

function drawLeafPile(pc: PixelCanvas, w: number, h: number, seed: number, density: number): void {
  const rng = new RNG(seed);
  const colors = [PAL.dryLeaf1, PAL.dryLeaf2, PAL.dryLeaf3, PAL.dryLeaf4];
  // Sombrita suave bajo el montón.
  pc.ellipse(1, Math.round(h * 0.35), w - 2, Math.round(h * 0.65), '#b3a381');
  const count = Math.round(w * h * density);
  for (let n = 0; n < count; n++) {
    // Distribución elíptica: más hojas en el centro.
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next());
    const cx = w / 2 + Math.cos(a) * r * (w / 2 - 2);
    const cy = h / 2 + Math.sin(a) * r * (h / 2 - 1.5);
    const c = rng.pick(colors);
    const lx = Math.round(cx);
    const ly = Math.round(cy);
    if (rng.chance(0.5)) {
      pc.rect(lx, ly, 3, 1, c);
      pc.px(lx + 1, ly - 1, c);
      pc.px(lx + 3, ly, '#6e3a16');
    } else {
      pc.rect(lx, ly, 2, 2, c);
      pc.px(lx + 2, ly + 1, '#6e3a16');
    }
  }
}

export function generateObstacleTextures(textures: Phaser.Textures.TextureManager): void {
  const cells: PackedFrame[] = [
    { name: POOP_FRAMES.pile, canvas: cell(14, 12, (pc) => pc.map(1, 1, PILE, POOP_PAL)) },
    { name: POOP_FRAMES.log, canvas: cell(16, 7, (pc) => pc.map(1, 1, LOG, POOP_PAL)) },
    { name: POOP_FRAMES.nuggets, canvas: cell(13, 7, (pc) => pc.map(1, 1, NUGGETS, POOP_PAL)) },
    { name: POOP_FRAMES.squash, canvas: cell(16, 6, (pc) => pc.map(1, 1, SQUASH, POOP_PAL)) },
    { name: POOP_FRAMES.giant, canvas: cell(30, 24, (pc) => drawGiant(pc, 1, 1)) },
    { name: POOP_FRAMES.giantSquash, canvas: cell(32, 11, (pc) => drawGiantSquash(pc, 1, 1)) },
    { name: POOP_FRAMES.camo, canvas: cell(10, 7, (pc) => pc.map(1, 1, CAMO, CAMO_PAL)) },
  ];
  packStrip(textures, TEX.poops, cells);

  // Baldosa floja: un poquito levantada, con borde mojado y un brillo de agua.
  const idle = new PixelCanvas(16, 10);
  idle.rect(0, 1, 16, 9, '#4f4536');
  drawTile(idle, 0, 0, '#d9cdab');
  idle.hline(0, 0, 16, PAL.tileLight);
  idle.vline(15, 0, 9, '#4f4536');
  idle.hline(0, 8, 16, '#5f5442');
  idle.px(2, 9, '#6fa6c4');
  idle.px(9, 9, '#9fd0e8');
  idle.px(13, 9, '#6fa6c4');
  idle.px(1, 6, '#b8ad8e');
  idle.px(2, 7, '#b8ad8e');

  const triggered = new PixelCanvas(20, 12);
  triggered.ellipse(0, 4, 20, 8, '#6f8a99');
  triggered.ellipse(2, 5, 16, 6, '#8fb3c6');
  triggered.px(5, 6, '#d4ecf7');
  triggered.px(14, 8, '#d4ecf7');
  drawTile(triggered, 2, 1, '#b4a888');
  triggered.hline(2, 9, 16, '#4f4536');
  triggered.vline(17, 1, 9, '#4f4536');

  packStrip(textures, TEX.looseTile, [
    { name: 'idle', canvas: idle },
    { name: 'triggered', canvas: triggered },
  ]);

  // Montones de hojas secas (algunos esconden soretes, otros son señuelos).
  const pileA = new PixelCanvas(40, 14);
  drawLeafPile(pileA, 40, 14, 11, 0.32);
  const pileB = new PixelCanvas(40, 14);
  drawLeafPile(pileB, 40, 14, 23, 0.32);
  packStrip(textures, TEX.leafPile, [
    { name: 'pile0', canvas: pileA },
    { name: 'pile1', canvas: pileB },
  ]);

  // Hojas que tapan parcialmente al sorete camuflado.
  const cover = new PixelCanvas(16, 7);
  const rng = new RNG(5);
  const colors = [PAL.dryLeaf1, PAL.dryLeaf2, PAL.dryLeaf3, PAL.dryLeaf4];
  for (let n = 0; n < 16; n++) {
    const x = rng.int(0, 13);
    const y = rng.int(2, 5);
    const c = rng.pick(colors);
    cover.rect(x, y, 3, 1, c);
    cover.px(x + 1, y - 1, c);
  }
  cover.addTo(textures, TEX.leafCover);
}
