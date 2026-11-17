import Phaser from 'phaser';
import { packStrip, PixelCanvas } from '../PixelCanvas';
import { TEX } from '../keys';
import { PAL } from '../../config/palette';
import { shade } from '../color';

/**
 * Peatones decorativos. Caminan por detrás de la zona jugable y no colisionan:
 * sólo aportan vida al barrio.
 */

interface PersonLook {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  hat?: { color: string; style: 'cap' | 'brim' | 'bun' };
}

interface PersonOptions {
  /** Brazo delantero estirado (sostiene correas o el changuito). */
  armForward?: boolean;
  armBack?: boolean;
  camera?: boolean;
  skirt?: boolean;
  shorts?: boolean;
  pattern?: string;
}

/** Punto (relativo al cuadro) donde el paseador sostiene las correas. */
export const WALKER_HAND = { x: 21, y: 22 };
export const NPC_FRAME = { w: 26, h: 40, groundY: 38 };

function drawPerson(pc: PixelCanvas, ox: number, look: PersonLook, frame: number, opts: PersonOptions = {}): void {
  const g = NPC_FRAME.groundY;
  const cx = ox + 12;
  const stride = frame === 0 ? 3 : 0;
  const legTop = 26;
  const bottomShade = shade(look.bottom, -0.25);
  // Piernas
  if (opts.skirt) {
    pc.line(cx - 1, legTop + 3, cx - 1 - stride, g - 1, look.skin, 2);
    pc.line(cx + 1, legTop + 3, cx + 1 + stride, g - 1, shade(look.skin, -0.1), 2);
  } else {
    pc.line(cx - 1, legTop, cx - 1 - stride, g - 1, bottomShade, 2);
    pc.line(cx + 1, legTop, cx + 1 + stride, g - 1, look.bottom, 2);
    if (opts.shorts) {
      pc.line(cx - 1, legTop + 5, cx - 1 - stride, g - 3, look.skin, 2);
      pc.line(cx + 1, legTop + 5, cx + 1 + stride, g - 3, look.skin, 2);
      pc.rect(cx - 1 - stride, g - 3, 2, 1, '#ffffff');
      pc.rect(cx + 1 + stride, g - 3, 2, 1, '#ffffff');
    }
  }
  pc.rect(cx - 2 - stride, g - 1, 3, 2, look.shoes);
  pc.rect(cx + 1 + stride, g - 1, 3, 2, look.shoes);
  // Brazo de atrás
  if (opts.armBack) pc.line(cx - 3, 17, cx - 8, 22, shade(look.skin, -0.15), 2);
  else pc.line(cx - 3, 17, cx - 4 + (frame === 0 ? 2 : -1), 25, shade(look.skin, -0.15), 2);
  // Torso (y pollera)
  pc.rect(cx - 4, 15, 8, opts.skirt ? 15 : 12, look.top);
  pc.vline(cx - 4, 15, opts.skirt ? 15 : 12, shade(look.top, -0.2));
  if (opts.pattern) {
    for (let y = 16; y < (opts.skirt ? 29 : 26); y += 3) {
      for (let x = cx - 3 + (y % 2); x < cx + 4; x += 3) pc.px(x, y, opts.pattern);
    }
  }
  if (!opts.skirt) pc.hline(cx - 4, 26, 8, look.bottom);
  if (opts.camera) {
    pc.line(cx - 2, 15, cx + 1, 20, '#1f1a24');
    pc.rect(cx + 1, 19, 4, 3, '#1f1a24');
    pc.px(cx + 3, 20, '#9ccbe0');
  }
  // Cabeza
  pc.disc(cx + 1, 10, 4, look.skin);
  pc.px(cx + 4, 10, look.skin);
  pc.px(cx + 3, 9, '#1f1a24');
  pc.rect(cx - 3, 5, 7, 3, look.hair);
  pc.rect(cx - 3, 7, 3, 4, look.hair);
  if (look.hat?.style === 'cap') {
    pc.rect(cx - 3, 4, 8, 3, look.hat.color);
    pc.rect(cx + 3, 6, 4, 1, look.hat.color);
  } else if (look.hat?.style === 'brim') {
    pc.rect(cx - 2, 3, 7, 4, look.hat.color);
    pc.rect(cx - 5, 6, 12, 1, look.hat.color);
  } else if (look.hat?.style === 'bun') {
    pc.disc(cx - 3, 5, 2, look.hat.color);
    pc.rect(cx - 3, 5, 7, 3, look.hat.color);
  }
  // Brazo delantero
  if (opts.armForward) {
    pc.line(cx + 3, 17, cx + 8, 21, look.skin, 2);
    pc.rect(cx + 8, 21, 2, 2, look.skin);
  } else {
    pc.line(cx + 3, 17, cx + 3 + (frame === 0 ? -2 : 1), 25, look.skin, 2);
  }
}

function personFrames(look: PersonLook, opts: PersonOptions): { name: string; canvas: PixelCanvas }[] {
  return [0, 1].map((frame) => {
    const pc = new PixelCanvas(NPC_FRAME.w, NPC_FRAME.h);
    drawPerson(pc, 0, look, frame, opts);
    pc.outline(PAL.outline);
    return { name: `walk${frame}`, canvas: pc };
  });
}

function ladyFrames(): { name: string; canvas: PixelCanvas }[] {
  const look: PersonLook = { skin: '#e8b48f', hair: '#d9d4d0', top: '#7a4a9a', bottom: '#7a4a9a', shoes: '#3a2a20', hat: { color: '#d9d4d0', style: 'bun' } };
  return [0, 1].map((frame) => {
    const pc = new PixelCanvas(40, NPC_FRAME.h);
    drawPerson(pc, 14, look, frame, { armBack: true, skirt: true, pattern: '#f0c0e0' });
    // Changuito escocés
    const g = NPC_FRAME.groundY;
    pc.line(10, 22, 18, 21, '#7d7d86');
    pc.rect(2, 21, 10, 13, '#c62b22');
    for (let y = 22; y < 34; y += 3) pc.hline(2, y, 10, '#2f6b35');
    for (let x = 3; x < 12; x += 3) pc.vline(x, 21, 13, '#2f6b35');
    pc.disc(5, g - 2, 2 + (frame === 0 ? 0 : 0), '#1f1a24');
    pc.px(5, g - 2, '#9a9aa3');
    pc.outline(PAL.outline);
    return { name: `walk${frame}`, canvas: pc };
  });
}

type DogKind = 'small' | 'medium' | 'big' | 'sausage';

function drawDog(kind: DogKind, frame: number): PixelCanvas {
  const spec = {
    small: { w: 13, h: 10, bodyW: 8, bodyH: 5, legH: 2, color: '#f4f1ea', ear: '#d9d4c8' },
    medium: { w: 16, h: 11, bodyW: 10, bodyH: 5, legH: 3, color: '#b0763c', ear: '#7a4a24' },
    big: { w: 18, h: 13, bodyW: 12, bodyH: 6, legH: 4, color: '#2b2530', ear: '#1a1520' },
    sausage: { w: 19, h: 9, bodyW: 13, bodyH: 4, legH: 2, color: '#8a4a24', ear: '#5a2a14' },
  }[kind];
  const pc = new PixelCanvas(spec.w + 2, spec.h + 2);
  const ground = spec.h;
  const bodyY = ground - spec.legH - spec.bodyH;
  const bx = 2;
  // Patas (alternan con el paso)
  const legs = [bx + 1, bx + 3, bx + spec.bodyW - 3, bx + spec.bodyW - 1];
  legs.forEach((lx, i) => {
    const shift = (i + frame) % 2 === 0 ? 1 : -1;
    pc.line(lx, bodyY + spec.bodyH - 1, lx + shift, ground, i % 2 === 0 ? shade(spec.color, -0.25) : spec.color);
  });
  pc.ellipse(bx, bodyY, spec.bodyW, spec.bodyH, spec.color);
  // Cola
  pc.line(bx, bodyY + 1, bx - 2, bodyY - 2 + frame, spec.color);
  // Cabeza
  const hx = bx + spec.bodyW - 2;
  const hy = bodyY - 3;
  pc.rect(hx, hy, 4, 4, spec.color);
  pc.rect(hx + 3, hy + 2, 2, 2, spec.color);
  pc.px(hx + 5, hy + 2, '#1f1a24');
  pc.px(hx + 2, hy + 1, '#1f1a24');
  pc.rect(hx, hy, 2, 3, spec.ear);
  pc.outline(PAL.outline);
  return pc;
}

export const DOG_KINDS: DogKind[] = ['small', 'medium', 'big', 'sausage'];

export function generateNpcTextures(textures: Phaser.Textures.TextureManager): void {
  packStrip(
    textures,
    TEX.npcWalker,
    personFrames(
      { skin: '#d9a07a', hair: '#2f1a10', top: '#3f7a4a', bottom: '#3a4a7a', shoes: '#ffffff', hat: { color: '#e8433a', style: 'cap' } },
      { armForward: true },
    ),
  );
  packStrip(
    textures,
    TEX.npcTourist,
    personFrames(
      { skin: '#f4c8b0', hair: '#e8c86a', top: '#ff8a1f', bottom: '#c9b07a', shoes: '#7a5a3a', hat: { color: '#e6d6a8', style: 'brim' } },
      { camera: true, shorts: true, pattern: '#ffe14d' },
    ),
  );
  packStrip(textures, TEX.npcLady, ladyFrames());
  DOG_KINDS.forEach((kind, i) => {
    packStrip(textures, TEX.npcDog(i), [
      { name: 'walk0', canvas: drawDog(kind, 0) },
      { name: 'walk1', canvas: drawDog(kind, 1) },
    ]);
  });
}
