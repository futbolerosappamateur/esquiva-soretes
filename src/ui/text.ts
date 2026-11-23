import Phaser from 'phaser';
import { FONT_SIZE, FONTS, fontKey } from '../graphics/BitmapFontBuilder';

export interface TextOptions {
  /** Tamaño: 1 normal, 2 o 3 para títulos (cada escala usa letras dibujadas a ese tamaño). */
  scale?: number;
  color?: number;
  /** Con borde oscuro (por defecto) o sin borde. */
  outline?: boolean;
  origin?: number | [number, number];
  align?: 'left' | 'center' | 'right';
  depth?: number;
  /** Ancho máximo en píxeles de pantalla (hace salto de línea por palabras). */
  maxWidth?: number;
  scrollFactor?: number;
}

/** Crea un texto con la letra del juego (ver graphics/BitmapFontBuilder.ts). */
export function addText(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOptions = {}): Phaser.GameObjects.BitmapText {
  const base = opts.outline === false ? FONTS.PLAIN : FONTS.OUTLINE;
  const scale = opts.scale ?? 1;
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), fontKey(scene, base, scale), text, FONT_SIZE[base]);
  t.setScale(scale);
  if (opts.maxWidth) t.setMaxWidth(Math.floor(opts.maxWidth / scale));
  if (opts.align === 'center') t.setCenterAlign();
  else if (opts.align === 'right') t.setRightAlign();
  const origin = opts.origin ?? 0;
  if (typeof origin === 'number') t.setOrigin(origin);
  else t.setOrigin(origin[0], origin[1]);
  if (opts.color !== undefined) t.setTint(opts.color);
  if (opts.depth !== undefined) t.setDepth(opts.depth);
  if (opts.scrollFactor !== undefined) t.setScrollFactor(opts.scrollFactor);
  return t;
}
