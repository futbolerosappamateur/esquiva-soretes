/**
 * Fuente pixelada original de 5x7 (ancho variable) con soporte para castellano:
 * acentos, Ñ, Ü, ¡ y ¿. Se usa tanto para la fuente bitmap de Phaser como para
 * escribir carteles dentro de las texturas (kiosco, verdulería, etc.).
 *
 * Cada glifo ocupa una celda de 10 filas:
 *   filas 0-1: acentos · filas 2-8: cuerpo (alto de mayúscula) · fila 9: descendente.
 */

export const GLYPH_CELL_HEIGHT = 10;
export const GLYPH_BODY_TOP = 2;
export const GLYPH_SPACING = 1;
const SPACE_WIDTH = 3;

const BASE_GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],

  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '¡': ['#', '.', '#', '#', '#', '#', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '¿': ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  ';': ['.', '#', '.', '.', '.', '#', '#'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '°': ['.#.', '#.#', '.#.', '...', '...', '...', '...'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '.....'],
  '↓': ['.....', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
};

/** Acentos (2 filas) que se apoyan sobre una letra base. */
const ACCENT_MARKS = {
  acute: (w: number): string[] => {
    const a = '.'.repeat(w).split('');
    const b = '.'.repeat(w).split('');
    const mid = Math.floor(w / 2);
    a[Math.min(w - 1, mid + 1)] = '#';
    b[mid] = '#';
    return [a.join(''), b.join('')];
  },
  tilde: (w: number): string[] => (w >= 5 ? ['.##.#', '#..#.'] : ['.#.', '#.#']),
  dieresis: (w: number): string[] => ['.'.repeat(w), w >= 5 ? '.#.#.' : '#.#'],
};

const COMPOSED: Record<string, { base: string; mark: keyof typeof ACCENT_MARKS }> = {
  Á: { base: 'A', mark: 'acute' },
  É: { base: 'E', mark: 'acute' },
  Í: { base: 'I', mark: 'acute' },
  Ó: { base: 'O', mark: 'acute' },
  Ú: { base: 'U', mark: 'acute' },
  Ñ: { base: 'N', mark: 'tilde' },
  Ü: { base: 'U', mark: 'dieresis' },
};

export interface Glyph {
  char: string;
  width: number;
  /** Siempre GLYPH_CELL_HEIGHT filas. */
  rows: string[];
}

const cache = new Map<string, Glyph | null>();

function buildCell(body: string[], accent?: string[]): string[] {
  const width = body[0].length;
  const empty = '.'.repeat(width);
  const top = accent ?? [empty, empty];
  const main = body.slice(0, 7);
  const desc = body[7] ?? empty;
  return [...top, ...main, desc];
}

/** Devuelve el glifo para un carácter (las minúsculas usan el glifo mayúsculo). */
export function getGlyph(char: string): Glyph | null {
  if (cache.has(char)) return cache.get(char) ?? null;
  let glyph: Glyph | null = null;
  if (char === ' ') {
    const empty = '.'.repeat(SPACE_WIDTH);
    glyph = { char, width: SPACE_WIDTH, rows: new Array(GLYPH_CELL_HEIGHT).fill(empty) };
  } else {
    const upper = char.toUpperCase();
    const key = upper.length === 1 ? upper : char;
    if (BASE_GLYPHS[key]) {
      const body = BASE_GLYPHS[key];
      glyph = { char, width: body[0].length, rows: buildCell(body) };
    } else if (COMPOSED[key]) {
      const { base, mark } = COMPOSED[key];
      const body = BASE_GLYPHS[base];
      const width = body[0].length;
      glyph = { char, width, rows: buildCell(body, ACCENT_MARKS[mark](width)) };
    }
  }
  cache.set(char, glyph);
  return glyph;
}

/** Todos los caracteres que la fuente sabe dibujar (incluye minúsculas mapeadas). */
export function supportedCharacters(): string[] {
  const upper = [...Object.keys(BASE_GLYPHS), ...Object.keys(COMPOSED), ' '];
  const lower = 'abcdefghijklmnopqrstuvwxyzáéíóúñü'.split('');
  return [...new Set([...upper, ...lower])];
}

/** Ancho en píxeles de un texto de una línea (sin escala). */
export function measureText(text: string, spacing = GLYPH_SPACING): number {
  let w = 0;
  let count = 0;
  for (const ch of text) {
    const g = getGlyph(ch);
    if (!g) continue;
    w += g.width;
    count++;
  }
  return count > 0 ? w + (count - 1) * spacing : 0;
}
