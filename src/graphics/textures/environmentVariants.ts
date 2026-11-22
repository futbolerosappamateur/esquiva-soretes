import Phaser from 'phaser';
import { GAME_WIDTH } from '../../config/constants';
import { RNG } from '../../core/rng';
import { CORNER_SPECS, FACADE_SPECS, VERSALLES_SPECS } from '../facadeSpecs';
import { hexToRgb } from '../color';
import { TEX } from '../keys';
import { PixelCanvas } from '../PixelCanvas';

/**
 * Variantes de ambientación generadas a partir de los gráficos base:
 * cielos (noche, atardecer, nublado), horizonte nocturno, fachadas de noche
 * con ventanas encendidas y árboles otoñales.
 */

/** Copia una textura ya generada a un lienzo nuevo (para transformarla). */
function canvasFromTexture(textures: Phaser.Textures.TextureManager, key: string): PixelCanvas | null {
  if (!textures.exists(key)) return null;
  const src = textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const pc = new PixelCanvas(src.width, src.height);
  pc.ctx.drawImage(src, 0, 0);
  return pc;
}

/** Oscurece hacia un azul nocturno (multiplicación + luz ambiente). */
function nightPixel(d: Uint8ClampedArray, i: number): void {
  d[i] = Math.round(d[i] * 0.36 + 8);
  d[i + 1] = Math.round(d[i + 1] * 0.4 + 10);
  d[i + 2] = Math.round(d[i + 2] * 0.6 + 26);
}

function drawSkyNight(): PixelCanvas {
  const pc = new PixelCanvas(GAME_WIDTH, 132);
  pc.bands(0, 0, GAME_WIDTH, 132, ['#0d0b24', '#141230', '#1b183d', '#24204c', '#2f2a5c', '#3d3468', '#4d3f70']);
  const rng = new RNG(808);
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, GAME_WIDTH - 1);
    const y = rng.int(0, 90);
    pc.px(x, y, rng.chance(0.25) ? '#fff3c4' : rng.chance(0.5) ? '#c8d0ff' : '#8f94c8');
  }
  // Luna llena con cráteres.
  pc.disc(392, 26, 10, '#f6efcf');
  pc.disc(388, 23, 3, '#e2d9b4');
  pc.disc(396, 30, 2, '#e2d9b4');
  pc.disc(393, 20, 1.5, '#e2d9b4');
  return pc;
}

function drawSkyDusk(): PixelCanvas {
  const pc = new PixelCanvas(GAME_WIDTH, 132);
  pc.bands(0, 0, GAME_WIDTH, 132, ['#6fa4d6', '#8fb3d8', '#b9bcd2', '#e0c4b8', '#f2c79a', '#f6cf8a', '#f8dca2']);
  return pc;
}

function drawSkyOvercast(): PixelCanvas {
  const pc = new PixelCanvas(GAME_WIDTH, 132);
  pc.bands(0, 0, GAME_WIDTH, 132, ['#8e98a6', '#98a2ae', '#a3acb6', '#adb5bd', '#b7bec4', '#c1c7cb', '#cbd0d2']);
  return pc;
}

/** Horizonte de noche: siluetas oscuras con ventanitas encendidas. */
function nightSkyline(textures: Phaser.Textures.TextureManager): PixelCanvas | null {
  const pc = canvasFromTexture(textures, TEX.skyline);
  if (!pc) return null;
  const img = pc.ctx.getImageData(0, 0, pc.width, pc.height);
  const d = img.data;
  const rng = new RNG(77);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    // Las ventanitas (más claras que la pared) a veces quedan encendidas.
    const lum = d[i] + d[i + 1] + d[i + 2];
    if (lum > 560 && rng.chance(0.3)) {
      d[i] = 255;
      d[i + 1] = 214;
      d[i + 2] = 120;
    } else {
      d[i] = Math.round(d[i] * 0.22 + 18);
      d[i + 1] = Math.round(d[i + 1] * 0.24 + 18);
      d[i + 2] = Math.round(d[i + 2] * 0.42 + 40);
    }
  }
  pc.ctx.putImageData(img, 0, 0);
  return pc;
}

/** Colores de vidrios y aberturas de las fachadas (ver facadeTextures.ts). */
const WINDOW_COLORS = ['#4f7393', '#86abc6', '#6c90ae', '#2b2438', '#3d3a4f', '#5d6a85', '#3a5468', '#5d7288'].map(hexToRgb);
/** Interiores de las vidrieras de los negocios. */
const SHOP_INTERIORS = ['#f4e4c4', '#e9dcb8', '#3a2f2a', '#e6d6b0', '#d99a4a', '#e2a54d', '#e8b25a', '#f2f4f2'].map(hexToRgb);

const matches = (d: Uint8ClampedArray, i: number, list: [number, number, number][]) =>
  list.some(([r, g, b]) => d[i] === r && d[i + 1] === g && d[i + 2] === b);

/**
 * Fachada nocturna: todo se oscurece salvo un grupo de ventanas (elegidas
 * por zonas conectadas, así cada ventana queda entera prendida o apagada)
 * y algunas vidrieras de negocios abiertos.
 */
function nightFacade(source: PixelCanvas, seed: number, litRatio: number): PixelCanvas {
  const W = source.width;
  const H = source.height;
  const pc = new PixelCanvas(W, H);
  pc.ctx.drawImage(source.canvas, 0, 0);
  const img = pc.ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const rng = new RNG(seed);
  const kind = new Uint8Array(W * H); // 1 = ventana, 2 = vidriera
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    if (matches(d, i, WINDOW_COLORS)) kind[p] = 1;
    else if (matches(d, i, SHOP_INTERIORS) && p / W > H - 40) kind[p] = 2;
  }
  // Zonas conectadas de ventana → prendidas o apagadas en bloque.
  const label = new Int32Array(W * H).fill(-1);
  const lit: boolean[] = [];
  const stack: number[] = [];
  for (let p = 0; p < W * H; p++) {
    if (kind[p] !== 1 || label[p] >= 0) continue;
    const id = lit.length;
    lit.push(rng.chance(litRatio));
    label[p] = id;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop()!;
      const qx = q % W;
      const neighbors = [q - W, q + W, qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1];
      for (const n of neighbors) {
        if (n < 0 || n >= W * H || kind[n] !== 1 || label[n] >= 0) continue;
        label[n] = id;
        stack.push(n);
      }
    }
  }
  const shopLit = rng.chance(0.75);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    const isLitWindow = kind[p] === 1 && lit[label[p]];
    const isLitShop = kind[p] === 2 && shopLit;
    if (isLitWindow || isLitShop) {
      const bright = d[i] + d[i + 1] + d[i + 2] > 330;
      d[i] = bright ? 255 : 240;
      d[i + 1] = bright ? 232 : 186;
      d[i + 2] = bright ? 160 : 92;
    } else {
      nightPixel(d, i);
    }
  }
  pc.ctx.putImageData(img, 0, 0);
  return pc;
}

/** Copas de los árboles en tonos otoñales (plátanos dorados, jacarandá ocre). */
const AUTUMN_MAP: Record<string, string> = {
  '#2f6b35': '#8a3b16',
  '#46913f': '#c8641e',
  '#71b84e': '#e39a2b',
  '#a7d96a': '#f2c94c',
  '#173a1b': '#4a1f0c',
  '#5a3f9e': '#7a4a1a',
  '#7f62c9': '#b0702a',
  '#a58be0': '#d49a3a',
  '#cbb8f2': '#efc66a',
  '#2c1d52': '#3a220c',
};

export function generateEnvironmentVariants(textures: Phaser.Textures.TextureManager, litWindowRatio = 0.45): void {
  drawSkyNight().addTo(textures, TEX.skyNight);
  drawSkyDusk().addTo(textures, TEX.skyDusk);
  drawSkyOvercast().addTo(textures, TEX.skyOvercast);
  nightSkyline(textures)?.addTo(textures, TEX.skylineNight);

  // Las de Versalles van al final: así no cambian las ventanas prendidas de las demás.
  [...FACADE_SPECS, ...CORNER_SPECS, ...VERSALLES_SPECS].forEach((spec, k) => {
    const base = canvasFromTexture(textures, TEX.facade(spec.id));
    if (base) nightFacade(base, 1000 + k * 37, litWindowRatio).addTo(textures, TEX.facadeNight(spec.id));
  });

  for (let v = 0; v < 3; v++) {
    const tree = canvasFromTexture(textures, TEX.tree(v));
    if (tree) tree.recolor(AUTUMN_MAP).addTo(textures, TEX.treeAutumn(v));
  }
}
