import Phaser from 'phaser';
import { packStrip, PixelCanvas } from '../PixelCanvas';
import { TEX } from '../keys';
import { PAL } from '../../config/palette';
import { GAME_WIDTH } from '../../config/constants';
import { RNG } from '../../core/rng';
import { mix, shade } from '../color';

/**
 * Cielo, nubes, horizonte de la ciudad, baldosas, cordón, adoquines y
 * pequeños detalles del piso. Las texturas que se repiten (TileSprite)
 * tienen medidas potencia de dos.
 */

function drawSky(textures: Phaser.Textures.TextureManager): void {
  const pc = new PixelCanvas(GAME_WIDTH, 132);
  pc.bands(0, 0, GAME_WIDTH, 132, ['#58ace8', '#68b6ec', '#7bc1f0', '#90cbf2', '#a8d7f4', '#c2e3f6', '#d8eef7']);
  pc.addTo(textures, TEX.sky);
}

function drawCloud(pc: PixelCanvas, x: number, y: number, w: number, rng: RNG): void {
  const puffs = Math.max(3, Math.round(w / 9));
  const h = Math.round(w * 0.32);
  // Base aplanada
  pc.ellipse(x, y + h * 0.45, w, h * 0.6, '#d3e9f6');
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const pw = Math.round(w * rng.range(0.32, 0.46));
    const ph = Math.round(pw * rng.range(0.7, 0.9));
    const px = Math.round(x + t * (w - pw));
    const py = Math.round(y + h * 0.5 - ph * rng.range(0.55, 0.85) - Math.sin(t * Math.PI) * h * 0.35);
    pc.ellipse(px, py + 1, pw, ph, '#d3e9f6');
    pc.ellipse(px, py, pw, ph - 1, '#ffffff');
  }
  pc.ellipse(x + 2, y + h * 0.5, w - 4, h * 0.35, '#ffffff');
  pc.hline(x + 4, Math.round(y + h * 0.95), w - 8, '#c0dcef');
}

function drawClouds(textures: Phaser.Textures.TextureManager): void {
  const pc = new PixelCanvas(512, 64);
  const rng = new RNG(77);
  const clouds = [
    { x: 10, y: 14, w: 58 },
    { x: 120, y: 32, w: 40 },
    { x: 205, y: 10, w: 72 },
    { x: 330, y: 28, w: 46 },
    { x: 420, y: 16, w: 62 },
  ];
  clouds.forEach((c) => drawCloud(pc, c.x, c.y, c.w, rng));
  pc.addTo(textures, TEX.clouds);
}

/** Dibuja una función en x y en x-512 para que la textura empalme sin cortes. */
function wrapped(width: number, x: number, w: number, fn: (ox: number) => void): void {
  fn(x);
  if (x + w > width) fn(x - width);
  if (x < 0) fn(x + width);
}

function drawSkyline(textures: Phaser.Textures.TextureManager): void {
  const W = 512;
  const H = 128;
  const pc = new PixelCanvas(W, H);
  const rng = new RNG(314);
  const far = PAL.skylineFar;
  const near = PAL.skylineNear;
  const win = PAL.skylineWindow;

  // Fila lejana: edificios altos y finitos.
  let x = 0;
  while (x < W) {
    const w = rng.int(18, 40);
    const h = rng.int(44, 82);
    const top = H - h;
    const bx = x;
    wrapped(W, bx, w, (ox) => {
      pc.rect(ox, top, w, h, far);
      for (let wy = top + 4; wy < H - 6; wy += 6) {
        for (let wx = ox + 3; wx < ox + w - 3; wx += 4) if (rng.chance(0.6)) pc.rect(wx, wy, 2, 2, mix(far, win, 0.6));
      }
    });
    if (rng.chance(0.35)) {
      // Antena
      wrapped(W, bx, w, (ox) => {
        pc.vline(ox + Math.floor(w / 2), top - 10, 10, far);
        pc.hline(ox + Math.floor(w / 2) - 2, top - 7, 5, far);
      });
    }
    x += w + rng.int(2, 10);
  }

  // Iglesia con dos torres y cúpulas (homenaje genérico a las parroquias porteñas).
  const cx = 300;
  pc.rect(cx, H - 52, 44, 52, near);
  pc.rect(cx + 18, H - 62, 8, 10, near);
  pc.px(cx + 21, H - 66, near);
  pc.vline(cx + 22, H - 68, 6, near);
  for (const tx of [cx - 4, cx + 38]) {
    pc.rect(tx, H - 78, 10, 78, near);
    pc.ellipse(tx - 1, H - 88, 12, 12, near);
    pc.vline(tx + 5, H - 96, 8, near);
    pc.hline(tx + 3, H - 93, 5, near);
    pc.rect(tx + 3, H - 72, 4, 6, mix(near, win, 0.5));
  }
  pc.ellipse(cx + 12, H - 60, 20, 14, near);

  // Fila cercana: edificios bajos con tanques de agua, cúpulas y antenas.
  x = 0;
  while (x < W) {
    const w = rng.int(26, 56);
    const h = rng.int(24, 48);
    const top = H - h;
    const bx = x;
    if (bx > cx - 30 && bx < cx + 60) {
      x += 8;
      continue;
    }
    const kind = rng.int(0, 5);
    wrapped(W, bx, w, (ox) => {
      pc.rect(ox, top, w, h, near);
      for (let wy = top + 5; wy < H - 4; wy += 7) {
        for (let wx = ox + 3; wx < ox + w - 4; wx += 6) if (rng.chance(0.7)) pc.rect(wx, wy, 3, 3, mix(near, win, 0.45));
      }
      pc.hline(ox, top, w, shade(near, 0.1));
      if (kind === 0) {
        // Tanque de agua
        pc.rect(ox + 4, top - 9, 10, 6, near);
        pc.vline(ox + 5, top - 3, 3, near);
        pc.vline(ox + 12, top - 3, 3, near);
      } else if (kind === 1 && w > 34) {
        // Cúpula de esquina
        pc.ellipse(ox + w - 18, top - 12, 14, 14, near);
        pc.rect(ox + w - 18, top - 5, 14, 5, near);
        pc.vline(ox + w - 11, top - 18, 6, near);
      } else if (kind === 2) {
        pc.vline(ox + 6, top - 12, 12, near);
        pc.hline(ox + 3, top - 9, 7, near);
        pc.hline(ox + 4, top - 6, 5, near);
      }
    });
    x += w + rng.int(0, 6);
  }
  pc.addTo(textures, TEX.skyline);
}

/** Baldosas "vainilla" en perspectiva: 4x4 baldosas de 16x8 por textura. */
function drawSidewalk(textures: Phaser.Textures.TextureManager): void {
  const pc = new PixelCanvas(64, 32);
  const rng = new RNG(2024);
  const variants = [PAL.tile, mix(PAL.tile, PAL.tileLight, 0.35), mix(PAL.tile, PAL.tileDark, 0.3), PAL.tile];
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const x = tx * 16;
      const y = ty * 8;
      const base = rng.pick(variants);
      pc.rect(x, y, 16, 8, base);
      pc.hline(x, y, 16, PAL.grout);
      pc.vline(x, y, 8, PAL.grout);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          pc.px(x + 4 + i * 4, y + 2 + j * 2, shade(base, 0.12));
          pc.px(x + 4 + i * 4, y + 3 + j * 2 > y + 7 ? y + 7 : y + 3 + j * 2, shade(base, -0.08));
        }
      }
      if (rng.chance(0.15)) {
        // Fisura chiquita
        const cx = x + rng.int(3, 11);
        pc.line(cx, y + 2, cx + 2, y + 4, PAL.tileDark);
        pc.line(cx + 2, y + 4, cx + 1, y + 6, PAL.tileDark);
      }
    }
  }
  pc.addTo(textures, TEX.sidewalk);
}

function drawWallShadow(textures: Phaser.Textures.TextureManager): void {
  const pc = new PixelCanvas(64, 8);
  pc.rect(0, 0, 64, 2, 'rgba(42, 24, 56, 0.34)');
  pc.rect(0, 2, 64, 2, 'rgba(42, 24, 56, 0.18)');
  pc.dither(0, 4, 64, 1, 'rgba(42, 24, 56, 0.16)');
  pc.dither(0, 5, 64, 1, 'rgba(42, 24, 56, 0.1)', 1);
  pc.addTo(textures, TEX.wallShadow);
}

function drawCurb(textures: Phaser.Textures.TextureManager): void {
  const pc = new PixelCanvas(32, 8);
  pc.hline(0, 0, 32, '#ece8de');
  pc.rect(0, 1, 32, 2, PAL.curbTop);
  pc.hline(0, 3, 32, mix(PAL.curbTop, PAL.curbFace, 0.5));
  pc.rect(0, 4, 32, 2, PAL.curbFace);
  pc.rect(0, 6, 32, 2, PAL.curbShadow);
  pc.vline(31, 1, 5, PAL.curbShadow);
  pc.px(12, 4, mix(PAL.curbFace, PAL.curbShadow, 0.5));
  pc.px(22, 5, mix(PAL.curbFace, PAL.curbShadow, 0.5));
  pc.addTo(textures, TEX.curb);
}

/** Adoquines de San Telmo. */
function drawStreet(textures: Phaser.Textures.TextureManager): void {
  const pc = new PixelCanvas(64, 64);
  const rng = new RNG(99);
  pc.rect(0, 0, 64, 64, PAL.cobbleGap);
  const stoneColors = [PAL.cobble, PAL.cobbleLight, mix(PAL.cobble, PAL.cobbleDark, 0.4), mix(PAL.cobble, '#9a8a74', 0.4)];
  const widthSets = [
    [12, 14, 10, 16, 12],
    [16, 12, 12, 14, 10],
    [10, 16, 14, 12, 12],
    [14, 10, 16, 12, 12],
  ];
  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    const widths = widthSets[row % widthSets.length];
    let x = row % 2 === 0 ? 0 : 6;
    for (const w of widths) {
      const color = rng.pick(stoneColors);
      const draw = (ox: number) => {
        pc.rect(ox + 1, y, w - 2, 7, color);
        pc.rect(ox, y + 1, w, 5, color);
        pc.hline(ox + 1, y, w - 3, shade(color, 0.18));
        pc.px(ox, y + 1, shade(color, 0.12));
        pc.hline(ox + 2, y + 6, w - 3, shade(color, -0.22));
        pc.vline(ox + w - 1, y + 2, 4, shade(color, -0.18));
      };
      draw(x);
      if (x + w > 64) draw(x - 64);
      x += w;
    }
  }
  pc.addTo(textures, TEX.street);
}

/** Esquina con la calle transversal y la senda peatonal. */
function drawCrossStreet(textures: Phaser.Textures.TextureManager): void {
  const W = 112;
  const H = 170; // de y = 100 a y = 270 en pantalla
  const pc = new PixelCanvas(W, H);
  const rng = new RNG(4);
  const roadL = 18;
  const roadR = W - 18;
  // Tramo lejano de la transversal: una franja que se pierde entre los
  // edificios del fondo (el horizonte de la ciudad se ve por encima).
  for (let y = 16; y < 28; y++) {
    const t = (y - 16) / 12;
    const inset = Math.round((1 - t) * 6);
    pc.rect(roadL + inset, y, roadR - roadL - inset * 2, 1, mix('#8d8a86', PAL.cobble, t));
    pc.rect(roadL + inset - 4, y, 4, 1, mix('#b9b5ad', PAL.tile, t));
    pc.rect(roadR - inset, y, 4, 1, mix('#b9b5ad', PAL.tile, t));
  }
  pc.hline(roadL + 6, 16, roadR - roadL - 12, '#a7a39c');
  // Adoquines de la transversal
  for (let y = 28; y < H; y += 6) {
    let x = roadL + ((y / 6) % 2 === 0 ? 0 : 5);
    while (x < roadR) {
      const w = Math.min(rng.int(8, 12), roadR - x);
      const c = rng.pick([PAL.cobble, PAL.cobbleLight, mix(PAL.cobble, PAL.cobbleDark, 0.4)]);
      pc.rect(x, y, w, 6, PAL.cobbleGap);
      if (w > 2) {
        pc.rect(x + 1, y, w - 2, 5, c);
        pc.hline(x + 1, y, w - 3, shade(c, 0.15));
      }
      x += w;
    }
  }
  // Cordones laterales de las dos esquinas (ochavas)
  pc.rect(0, 28, roadL, 86, PAL.tile);
  pc.rect(roadR, 28, W - roadR, 86, PAL.tile);
  for (let y = 28; y < 114; y += 8) {
    pc.hline(0, y, roadL, PAL.grout);
    pc.hline(roadR, y, W - roadR, PAL.grout);
  }
  pc.rect(roadL - 3, 28, 3, 92, PAL.curbFace);
  pc.vline(roadL - 3, 28, 92, PAL.curbTop);
  pc.rect(roadR, 28, 3, 92, PAL.curbFace);
  pc.vline(roadR + 2, 28, 92, PAL.curbShadow);
  // Rampas en la esquina
  pc.rect(roadL - 3, 64, 3, 14, PAL.curbTop);
  pc.rect(roadR, 64, 3, 14, PAL.curbTop);
  // Senda peatonal (las franjas cruzan la transversal a lo largo de la vereda)
  for (let x = roadL + 4; x < roadR - 4; x += 9) {
    pc.rect(x, 44, 5, 62, '#f2efe6');
    pc.vline(x + 4, 44, 62, '#cfcac0');
  }
  // Cordón frontal continúa con la calle principal
  pc.rect(0, 114, roadL, 6, PAL.curbFace);
  pc.hline(0, 114, roadL, PAL.curbTop);
  pc.rect(roadR, 114, W - roadR, 6, PAL.curbFace);
  pc.hline(roadR, 114, W - roadR, PAL.curbTop);
  pc.addTo(textures, TEX.crossStreet);
}

/** Detalles decorativos del piso (sin marrones, para no confundir con soretes). */
function drawDecals(textures: Phaser.Textures.TextureManager): void {
  const crack1 = new PixelCanvas(12, 5);
  crack1.line(0, 1, 3, 2, '#8f8166').line(3, 2, 6, 1, '#8f8166').line(6, 1, 8, 3, '#8f8166').line(8, 3, 11, 4, '#8f8166');
  const crack2 = new PixelCanvas(10, 6);
  crack2.line(0, 0, 4, 3, '#8f8166').line(4, 3, 9, 2, '#8f8166').line(4, 3, 5, 5, '#8f8166');
  const stain1 = new PixelCanvas(12, 5);
  stain1.ellipse(0, 0, 12, 5, 'rgba(110, 100, 90, 0.28)');
  stain1.ellipse(3, 1, 5, 3, 'rgba(110, 100, 90, 0.2)');
  const stain2 = new PixelCanvas(8, 4);
  stain2.ellipse(0, 0, 8, 4, 'rgba(90, 96, 110, 0.25)');
  const gum = new PixelCanvas(9, 4);
  gum.rect(0, 0, 2, 1, '#8c8270').rect(5, 2, 2, 1, '#9b927f').px(8, 3, '#8c8270');
  const cover = new PixelCanvas(16, 8);
  cover.rect(0, 0, 16, 8, '#6d6a66').rect(1, 1, 14, 6, '#8a8782');
  for (let i = 0; i < 6; i++) cover.line(2 + i * 2, 6, 4 + i * 2, 1, '#77746f');
  cover.hline(1, 1, 14, '#a3a09a');
  const patch = new PixelCanvas(16, 8);
  patch.rect(0, 0, 16, 8, '#b9b4aa').hline(0, 0, 16, '#9a958b').vline(0, 0, 8, '#9a958b');
  patch.px(5, 3, '#a7a297').px(11, 5, '#a7a297');
  const paper = new PixelCanvas(6, 4);
  paper.rect(0, 1, 5, 2, '#f3f1ea').px(5, 2, '#d8d5cc').px(1, 0, '#f3f1ea');
  const butt = new PixelCanvas(4, 2);
  butt.rect(0, 0, 3, 1, '#f3f1ea').px(3, 0, '#e08a3c');
  const drain = new PixelCanvas(14, 6);
  drain.rect(0, 0, 14, 6, '#4a4744');
  for (let i = 1; i < 13; i += 2) drain.vline(i, 1, 4, '#26231f');
  packStrip(textures, TEX.decals, [
    { name: 'crack1', canvas: crack1 },
    { name: 'crack2', canvas: crack2 },
    { name: 'stain1', canvas: stain1 },
    { name: 'stain2', canvas: stain2 },
    { name: 'gum', canvas: gum },
    { name: 'cover', canvas: cover },
    { name: 'patch', canvas: patch },
    { name: 'paper', canvas: paper },
    { name: 'butt', canvas: butt },
    { name: 'drain', canvas: drain },
  ]);
}

export const DECAL_FRAMES = ['crack1', 'crack2', 'stain1', 'stain2', 'gum', 'cover', 'patch', 'paper', 'butt'] as const;

export function generateEnvironmentTextures(textures: Phaser.Textures.TextureManager): void {
  drawSky(textures);
  drawClouds(textures);
  drawSkyline(textures);
  drawSidewalk(textures);
  drawWallShadow(textures);
  drawCurb(textures);
  drawStreet(textures);
  drawCrossStreet(textures);
  drawDecals(textures);
}
