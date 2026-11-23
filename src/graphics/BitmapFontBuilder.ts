import Phaser from 'phaser';
import fontUrl from '../assets/fonts/geologica-semibold.ttf';
import { TEXTS, TEXTS2 } from '../config/texts';
import { GLYPH_CELL_HEIGHT, measureText, supportedCharacters } from './fontData';
import { onRenderScaleChange, renderScale } from './renderScale';

/**
 * Letras del juego: Geologica SemiBold (licencia OFL, ver assets/fonts),
 * dibujada a la resolución de la pantalla para que se vea nítida en grande.
 *
 * Por fuera funciona igual que la fuente pixelada de antes: las mismas medidas
 * en unidades del juego (celda de 10 de alto, mayúsculas de 7, todo en
 * mayúsculas) y casi el mismo ancho, así ninguna pantalla se desarma. Por
 * dentro, cada letra se dibuja con tantos píxeles como ocupa en la pantalla:
 * con 4 píxeles por unidad, una mayúscula mide 28 píxeles.
 *
 * Un texto con escala 2 o 3 (títulos) usa su propia versión de la fuente,
 * dibujada a ese tamaño, en vez de agrandar la chica. Si cambia la resolución
 * (se agranda la ventana), las letras se vuelven a dibujar y los textos
 * existentes se actualizan solos.
 *
 * La fuente pixelada (fontData.ts) se sigue usando para los carteles que
 * forman parte de los dibujos del mundo (kioscos, verdulerías, etc.).
 */
export const FONTS = {
  /** Letras blancas sin borde (se tiñen con setTint). */
  PLAIN: 'font-plain',
  /** Letras blancas con borde oscuro: legibles sobre cualquier fondo. */
  OUTLINE: 'font-outline',
} as const;

export type FontBase = (typeof FONTS)[keyof typeof FONTS];

/** Distancia entre la parte superior de la celda y el comienzo de las mayúsculas. */
export const FONT_CAP_OFFSET = { [FONTS.PLAIN]: 2, [FONTS.OUTLINE]: 3 } as const;

/** Tamaño con el que se crean los textos (alto de la celda, en unidades del juego). */
export const FONT_SIZE: Record<FontBase, number> = {
  [FONTS.PLAIN]: GLYPH_CELL_HEIGHT,
  [FONTS.OUTLINE]: GLYPH_CELL_HEIGHT + 2,
};

const FAMILY = 'Esquiva Geologica';
const WEIGHT = 600;
const OUTLINE_COLOR = '#1a0f22';
/** Alto de las mayúsculas (unidades del juego), como la fuente pixelada. */
const CAP = 7;
/** Fila de la celda donde se apoyan las letras (debajo quedan las colitas). */
const BASELINE = 9;
/**
 * Aire extra entre letras (unidades). Con lo que ya separa la letra, el borde
 * oscuro de una llega justo al borde de la siguiente sin pisar su relleno.
 */
const TRACKING = 0.25;
/** Margen arriba y abajo de cada letra en la textura (unidades): acentos altos y colitas. */
const MARGIN = 1.5;
/** Tope de detalle por unidad (los títulos enormes no necesitan más y gastarían memoria). */
const MAX_RESOLUTION = 12;
/** Signos que se suben al renglón (en la letra cuelgan por debajo, como una minúscula). */
const RAISED = new Set(['¿', '¡']);
/** Ancho máximo de cada textura de letras. */
const ATLAS_WIDTH = 2048;
/**
 * Ancho de los textos respecto de la fuente pixelada, en promedio: las
 * pantallas están armadas para ese ancho y así queda margen (Geologica es
 * ancha: se comprime un poco en horizontal).
 */
const WIDTH_TARGET = 0.95;

/** Todos los textos del juego (de 12 letras o más), para calibrar el ancho. */
function gameTexts(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v.toUpperCase());
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk([TEXTS, TEXTS2]);
  return out.filter((s) => s.length >= 12);
}

let fontLoad: Promise<boolean> | null = null;

/** Carga la letra (una sola vez; si falla, se usa una del sistema). */
export function loadGameFont(): Promise<boolean> {
  if (!fontLoad) {
    fontLoad = (async () => {
      try {
        if (typeof FontFace === 'undefined' || !document.fonts) return false;
        const face = new FontFace(FAMILY, `url(${fontUrl})`, { weight: String(WEIGHT) });
        await face.load();
        document.fonts.add(face);
        return true;
      } catch (err) {
        console.warn('No se pudo cargar la letra del juego: se usa una del sistema.', err);
        return false;
      }
    })();
  }
  return fontLoad;
}

const fontAt = (px: number) => `${WEIGHT} ${px}px "${FAMILY}", "Segoe UI", Roboto, Arial, sans-serif`;

/** La letra del juego como fuente CSS de canvas (para dibujar textos dentro de texturas, como el logo). */
export function gameFont(px: number): string {
  return fontAt(px);
}

/** Una sola forma por letra: las minúsculas usan la mayúscula (como siempre). */
function shapeOf(ch: string): string {
  const up = ch.toUpperCase();
  return up.length === 1 ? up : ch;
}

interface Metrics {
  /** Alto de la mayúscula / tamaño de la letra. */
  capRatio: number;
  /** Compresión horizontal para no pasarse del ancho de la fuente pixelada (1 = sin comprimir). */
  hx: number;
  /** Avance de cada forma en unidades del juego (con el aire entre letras). */
  advance: Map<string, number>;
}

let metrics: Metrics | null = null;

function measure(): Metrics {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('Sin canvas 2D para las letras');
  ctx.font = fontAt(100);
  const capRatio = ctx.measureText('H').actualBoundingBoxAscent / 100 || 0.7;
  const unit = CAP / (capRatio * 100);
  const natural = (ch: string) => ctx.measureText(shapeOf(ch)).width * unit;
  // Que los textos del juego queden, en promedio, al WIDTH_TARGET del ancho que tenían con la fuente pixelada.
  let naturalW = 0;
  let count = 0;
  let pixelW = 0;
  for (const s of gameTexts()) {
    for (const ch of s) {
      naturalW += natural(ch);
      count++;
    }
    pixelW += measureText(s) + 1;
  }
  const hx = naturalW > 0 ? Math.min(1, Math.max(0.75, (WIDTH_TARGET * pixelW - count * TRACKING) / naturalW)) : 0.85;
  const advance = new Map<string, number>();
  for (const ch of supportedCharacters()) {
    const s = shapeOf(ch);
    if (!advance.has(s)) advance.set(s, natural(s) * hx + TRACKING);
  }
  return { capRatio, hx, advance };
}

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

interface FontData {
  font: string;
  size: number;
  lineHeight: number;
  retroFont: boolean;
  chars: Record<number, CharData>;
}

interface Variant {
  key: string;
  base: FontBase;
  /** Escala de los textos que la usan (1 = normal, 2 = títulos...). */
  textScale: number;
  data: FontData;
}

const variants = new Map<string, Variant>();
let game: Phaser.Game | null = null;

/** Dibuja (o vuelve a dibujar) las letras de una variante a la resolución actual. */
function draw(g: Phaser.Game, v: Variant): void {
  if (!metrics) metrics = measure();
  const m = metrics;
  const res = Math.min(MAX_RESOLUTION, renderScale() * v.textScale);
  const outlined = v.base === FONTS.OUTLINE;
  const pad = outlined ? 1 : 0;
  const cellH = GLYPH_CELL_HEIGHT + pad * 2;
  const stroke = outlined ? res : 0;
  const texH = Math.ceil((cellH + MARGIN * 2) * res);
  const baseline = Math.round((MARGIN + pad + BASELINE) * res);

  const scratch = document.createElement('canvas').getContext('2d');
  if (!scratch) return;
  scratch.font = fontAt((CAP * res) / m.capRatio);

  // Medidas de cada forma y ubicación en la textura (filas de hasta ATLAS_WIDTH).
  const shapes = [...m.advance.keys()];
  const cells = new Map<string, { x: number; y: number; w: number; ox: number; lift: number }>();
  let x = 0;
  let y = 0;
  let width = 0;
  for (const s of shapes) {
    const tm = scratch.measureText(s);
    const left = s.trim() ? tm.actualBoundingBoxLeft * m.hx : 0;
    const right = s.trim() ? tm.actualBoundingBoxRight * m.hx : 0;
    const ox = Math.ceil(1 + stroke + Math.max(0, left));
    const w = Math.max(2, Math.ceil(ox + right + stroke + 1));
    if (x + w > ATLAS_WIDTH) {
      x = 0;
      y += texH + 2;
    }
    // ¡ y ¿ se apoyan en el renglón, como en un texto en mayúsculas (en la letra cuelgan por debajo).
    const lift = RAISED.has(s) ? Math.max(0, Math.round(tm.actualBoundingBoxDescent)) : 0;
    cells.set(s, { x, y, w, ox, lift });
    x += w + 2;
    width = Math.max(width, x);
  }
  const height = y + texH;

  const textures = g.textures;
  let tex = textures.exists(v.key) ? (textures.get(v.key) as Phaser.Textures.CanvasTexture) : null;
  if (tex && !(tex instanceof Phaser.Textures.CanvasTexture)) {
    textures.remove(v.key);
    tex = null;
  }
  if (tex) tex.setSize(width, height);
  else tex = textures.createCanvas(v.key, width, height);
  if (!tex) return;
  const ctx = tex.context;
  ctx.clearRect(0, 0, width, height);
  ctx.font = scratch.font;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke * 2;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.fillStyle = '#ffffff';
  cells.forEach((c, s) => {
    if (!s.trim()) return;
    ctx.save();
    ctx.translate(c.x + c.ox, c.y + baseline - c.lift);
    ctx.scale(m.hx, 1);
    if (outlined) ctx.strokeText(s, 0, 0);
    ctx.fillText(s, 0, 0);
    ctx.restore();
  });
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);

  // Datos de la fuente bitmap (en píxeles de la textura; Phaser los escala por tamaño / data.size).
  const data = v.data;
  data.size = cellH * res;
  data.lineHeight = (cellH + 1) * res;
  for (const ch of supportedCharacters()) {
    const s = shapeOf(ch);
    const c = cells.get(s);
    const adv = m.advance.get(s);
    if (!c || adv === undefined) continue;
    const entry: CharData = {
      x: c.x,
      y: c.y,
      width: c.w,
      height: texH,
      centerX: Math.floor(c.w / 2),
      centerY: Math.floor(texH / 2),
      // El origen de la letra queda `pad` unidades a la derecha de la pluma (como en la fuente pixelada con borde).
      xOffset: pad * res - c.ox,
      yOffset: -MARGIN * res,
      xAdvance: adv * res,
      data: {},
      kerning: {},
      u0: c.x / width,
      v0: c.y / height,
      u1: (c.x + c.w) / width,
      v1: (c.y + texH) / height,
    };
    const code = ch.charCodeAt(0);
    if (data.chars[code]) Object.assign(data.chars[code], entry);
    else data.chars[code] = entry;
  }
  if (!g.cache.bitmapFont.exists(v.key)) g.cache.bitmapFont.add(v.key, { data, texture: v.key, frame: null });
}

/** Vuelve a dibujar todas las letras (cambió la resolución) y actualiza los textos que ya existen. */
function redrawAll(g: Phaser.Game): void {
  variants.forEach((v) => draw(g, v));
  const keys = new Set(variants.keys());
  const visit = (obj: unknown) => {
    if (obj instanceof Phaser.GameObjects.BitmapText) {
      if (keys.has(obj.font)) obj.setFont(obj.font);
    } else {
      const list = (obj as { list?: unknown }).list;
      if (Array.isArray(list)) list.forEach(visit);
    }
  };
  for (const scene of g.scene.scenes) scene.children?.list.forEach(visit);
}

function ensureVariant(g: Phaser.Game, base: FontBase, textScale: number): string {
  const key = textScale === 1 ? base : `${base}@${textScale}`;
  if (!variants.has(key)) {
    const v: Variant = { key, base, textScale, data: { font: key, size: 1, lineHeight: 1, retroFont: false, chars: {} } };
    variants.set(key, v);
    draw(g, v);
  }
  return key;
}

/** Genera las letras y las registra en Phaser (una vez, con la letra ya cargada: ver BootScene). */
export function registerFonts(scene: Phaser.Scene): void {
  if (!game) {
    game = scene.game;
    const g = game;
    onRenderScaleChange(() => redrawAll(g));
  }
  ensureVariant(game, FONTS.PLAIN, 1);
  ensureVariant(game, FONTS.OUTLINE, 1);
}

/**
 * Clave de la fuente para un texto de cierta escala (1, 1,5, 2, 3...): la
 * versión dibujada a ese tamaño, que se crea la primera vez que se pide.
 */
export function fontKey(scene: Phaser.Scene, base: FontBase, textScale = 1): string {
  if (!game) registerFonts(scene);
  const ts = Math.max(1, Math.round(textScale * 2) / 2);
  return ensureVariant(scene.game, base, ts);
}
