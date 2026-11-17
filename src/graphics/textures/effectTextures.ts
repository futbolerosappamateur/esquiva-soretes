import Phaser from 'phaser';
import { buildSheet, packStrip, PixelCanvas } from '../PixelCanvas';
import { FX_FRAMES, TEX } from '../keys';
import { PAL } from '../../config/palette';

function dust(size: number): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  pc.ellipse(0, 0, size, size, '#d8ccb0');
  pc.ellipse(1, 0, size - 2, size - 2, '#efe6d0');
  return pc;
}

function spark(): PixelCanvas {
  const pc = new PixelCanvas(5, 5);
  pc.px(2, 0, '#fff6b0').px(2, 4, '#fff6b0').px(0, 2, '#fff6b0').px(4, 2, '#fff6b0');
  pc.rect(1, 1, 3, 3, '#ffd23f');
  pc.px(2, 2, '#ffffff');
  return pc;
}

function exclaim(): PixelCanvas {
  const pc = new PixelCanvas(11, 15);
  pc.ellipse(0, 0, 11, 12, '#ffffff');
  pc.px(2, 12, '#ffffff').px(1, 13, '#ffffff');
  pc.rect(4, 2, 3, 5, '#e8433a');
  pc.rect(4, 8, 3, 2, '#e8433a');
  pc.outline(PAL.outline);
  return pc;
}

function leaf(): PixelCanvas {
  const pc = new PixelCanvas(4, 3);
  pc.rect(0, 1, 3, 1, PAL.dryLeaf1).px(1, 0, PAL.dryLeaf2).px(3, 1, PAL.dryLeaf3);
  return pc;
}

/** Líneas de olor verdes, onduladas (3 cuadros de animación). */
function stinkFrames(): { name: string; canvas: PixelCanvas }[] {
  return [0, 1, 2].map((f) => {
    const pc = new PixelCanvas(9, 14);
    for (let y = 0; y < 13; y++) {
      const x = 4 + Math.round(Math.sin((y + f * 2) * 0.75) * 2);
      pc.px(x, y, y % 3 === 0 ? '#c4e86a' : '#8fc23c');
    }
    pc.outline('#3f5a1a');
    return { name: `stink${f}`, canvas: pc };
  });
}

function flyFrames(): { name: string; canvas: PixelCanvas }[] {
  return [0, 1].map((f) => {
    const pc = new PixelCanvas(5, 4);
    pc.rect(1, 2, 3, 2, '#1a1520');
    if (f === 0) {
      pc.px(1, 0, '#dfe8f2').px(3, 0, '#dfe8f2').px(1, 1, '#c3d0de').px(3, 1, '#c3d0de');
    } else {
      pc.px(0, 1, '#dfe8f2').px(4, 1, '#dfe8f2');
    }
    return { name: `fly${f}`, canvas: pc };
  });
}

/** Globo de historieta "¡PLAF!". */
function plaf(): PixelCanvas {
  const W = 46;
  const H = 28;
  const pc = new PixelCanvas(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const points: [number, number][] = [];
  const spikes = 10;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.68;
    points.push([cx + Math.cos(a) * (W / 2 - 1) * r, cy + Math.sin(a) * (H / 2 - 1) * r]);
  }
  const ctx = pc.ctx;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(Math.round(x), Math.round(y)) : ctx.lineTo(Math.round(x), Math.round(y))));
  ctx.closePath();
  ctx.fill();
  // Quitar el suavizado del polígono: cualquier píxel semitransparente pasa a sólido o vacío.
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  pc.ellipse(9, 7, W - 18, H - 14, '#fff3a0');
  pc.textCentered('¡PLAF!', cx + 1, cy - 3, '#7a2a10');
  pc.textCentered('¡PLAF!', cx, cy - 4, '#e8433a');
  pc.outline('#7a2a10');
  return pc;
}

export function generateEffectTextures(textures: Phaser.Textures.TextureManager): void {
  const drop = new PixelCanvas(2, 2);
  drop.rect(0, 0, 2, 2, '#8fb8cc').px(0, 0, '#d4ecf7');
  const chunk = new PixelCanvas(3, 3);
  chunk.rect(0, 0, 3, 3, PAL.poop).px(0, 0, PAL.poopLight).px(2, 2, PAL.poopDark);
  const confetti = new PixelCanvas(3, 2);
  confetti.rect(0, 0, 3, 2, '#ffffff');
  const shadow = new PixelCanvas(16, 6);
  shadow.ellipse(0, 0, 16, 6, '#2a1838');

  packStrip(textures, TEX.fx, [
    { name: FX_FRAMES.dust, canvas: dust(6) },
    { name: FX_FRAMES.dustSmall, canvas: dust(4) },
    { name: FX_FRAMES.drop, canvas: drop },
    { name: FX_FRAMES.chunk, canvas: chunk },
    { name: FX_FRAMES.spark, canvas: spark() },
    { name: FX_FRAMES.confetti, canvas: confetti },
    { name: FX_FRAMES.shadow, canvas: shadow },
    { name: FX_FRAMES.exclaim, canvas: exclaim() },
    { name: FX_FRAMES.leaf, canvas: leaf() },
  ]);
  buildSheet(textures, TEX.stink, stinkFrames(), 3);
  buildSheet(textures, TEX.fly, flyFrames(), 2);
  plaf().addTo(textures, TEX.plaf);
}
