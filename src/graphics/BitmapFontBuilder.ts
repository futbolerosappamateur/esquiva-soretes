import Phaser from 'phaser';
import { PixelCanvas } from './PixelCanvas';
import { getGlyph, GLYPH_CELL_HEIGHT, GLYPH_SPACING, supportedCharacters } from './fontData';

export const FONTS = {
  /** Glifos blancos sin borde (se tiñen con setTint). */
  PLAIN: 'font-plain',
  /** Glifos blancos con borde oscuro de 1 px: legibles sobre cualquier fondo. */
  OUTLINE: 'font-outline',
} as const;

/** Distancia entre la parte superior de la celda y el comienzo de las mayúsculas. */
export const FONT_CAP_OFFSET = { [FONTS.PLAIN]: 2, [FONTS.OUTLINE]: 3 } as const;

interface CharData {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
  data: object;
  kerning: Record<string, number>;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** Genera las fuentes bitmap a partir de los glifos y las registra en Phaser. */
export function registerFonts(scene: Phaser.Scene): void {
  buildFont(scene, FONTS.PLAIN, false);
  buildFont(scene, FONTS.OUTLINE, true);
}

function buildFont(scene: Phaser.Scene, key: string, outlined: boolean): void {
  const pad = outlined ? 1 : 0;
  const cellH = GLYPH_CELL_HEIGHT + pad * 2;

  // Un solo dibujo por forma: las minúsculas reutilizan el glifo mayúsculo.
  const chars = supportedCharacters();
  const shapes = new Map<string, { width: number; rows: string[] }>();
  const shapeKeyOf = (ch: string): string => {
    const up = ch.toUpperCase();
    return up.length === 1 ? up : ch;
  };
  for (const ch of chars) {
    const g = getGlyph(ch);
    if (!g) continue;
    const k = shapeKeyOf(ch);
    if (!shapes.has(k)) shapes.set(k, { width: g.width, rows: g.rows });
  }

  let totalW = 0;
  shapes.forEach((s) => (totalW += s.width + pad * 2 + 1));
  const sheet = new PixelCanvas(totalW, cellH);
  const positions = new Map<string, { x: number; w: number; advance: number }>();

  let x = 0;
  shapes.forEach((s, k) => {
    const cellW = s.width + pad * 2;
    const cell = new PixelCanvas(cellW, cellH);
    for (let j = 0; j < s.rows.length; j++) {
      for (let i = 0; i < s.rows[j].length; i++) {
        if (s.rows[j][i] === '#') cell.px(pad + i, pad + j, '#ffffff');
      }
    }
    if (outlined) cell.outline('#1a0f22');
    sheet.draw(cell, x, 0);
    positions.set(k, { x, w: cellW, advance: s.width + GLYPH_SPACING });
    x += cellW + 1;
  });

  const texture = sheet.addTo(scene.textures, key);
  const tw = texture.source[0].width;
  const th = texture.source[0].height;

  const data: { font: string; size: number; lineHeight: number; retroFont: boolean; chars: Record<number, CharData> } = {
    font: key,
    size: cellH,
    lineHeight: cellH + 1,
    retroFont: false,
    chars: {},
  };

  for (const ch of chars) {
    const pos = positions.get(shapeKeyOf(ch));
    if (!pos) continue;
    data.chars[ch.charCodeAt(0)] = {
      x: pos.x,
      y: 0,
      width: pos.w,
      height: cellH,
      centerX: Math.floor(pos.w / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: pos.advance,
      data: {},
      kerning: {},
      u0: pos.x / tw,
      v0: 0,
      u1: (pos.x + pos.w) / tw,
      v1: cellH / th,
    };
  }

  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
}
