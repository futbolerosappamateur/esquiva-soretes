import Phaser from 'phaser';
import { buildSheet, PixelCanvas, type CharPalette } from '../PixelCanvas';
import { TEX } from '../keys';
import { lerp } from '../../core/math';

/**
 * Protagonista dibujado por código con un "esqueleto" de articulaciones.
 * Cada pose define caderas, rodillas, tobillos, hombros, codos y manos;
 * el dibujo se arma por capas y al final se le agrega el contorno oscuro.
 *
 * Para agregar otro personaje alcanza con definir otro CharacterLook
 * (colores de pelo, piel, ropa y zapatillas) y generar sus hojas.
 */

export interface CharacterLook {
  id: string;
  skin: string;
  skinShade: string;
  skinSick: string;
  skinSickShade: string;
  hair: string;
  hairLight: string;
  hairDark: string;
  shirtA: string;
  shirtB: string;
  shirtShade: string;
  pants: string;
  pantsBack: string;
  shoe: string;
  shoeBack: string;
  shoeAccent: string;
  sole: string;
  outline: string;
  eyeWhite: string;
  pupil: string;
  mouth: string;
  tongue: string;
  blush: string;
}

/** Look por defecto: remera a rayas celeste y blanca, jean y zapatillas blancas. */
export const DEFAULT_LOOK: CharacterLook = {
  id: 'pibe',
  skin: '#f1bf98',
  skinShade: '#d39470',
  skinSick: '#b8d27e',
  skinSickShade: '#8fae5a',
  hair: '#4a2b1b',
  hairLight: '#6e4228',
  hairDark: '#2f1a10',
  shirtA: '#7cc8f2',
  shirtB: '#f4f9ff',
  shirtShade: '#4f93c9',
  pants: '#3e5fa3',
  pantsBack: '#2c4479',
  shoe: '#ffffff',
  shoeBack: '#d6d9e6',
  shoeAccent: '#e8433a',
  sole: '#bfc3cc',
  outline: '#21142b',
  eyeWhite: '#ffffff',
  pupil: '#21142b',
  mouth: '#7a2333',
  tongue: '#ec7383',
  blush: '#ef8f88',
};

export const PLAYER_FRAME = {
  width: 48,
  height: 48,
  /** El contorno inferior de las suelas queda en y = 47: ese es el piso. */
  originX: 0.5,
  originY: 47 / 48,
};

export type Expression = 'normal' | 'happy' | 'focus' | 'shock' | 'lookDown' | 'disgust' | 'dizzy' | 'blink';
type FootStyle = 'flat' | 'toe' | 'sole';
type Pt = readonly [number, number];
interface Limb {
  a: Pt;
  b: Pt;
  c: Pt;
}
interface Pose {
  hip: Pt;
  neck: Pt;
  head: Expression;
  headOff?: Pt;
  headFlip?: boolean;
  backLeg: Limb;
  frontLeg: Limb;
  backFoot: FootStyle;
  frontFoot: FootStyle;
  backArm: Limb;
  frontArm: Limb;
}

// ---------------------------------------------------------------------------
// Cabeza (16x16, vista 3/4 mirando a la derecha)
// ---------------------------------------------------------------------------

const HEAD_BASE = [
  '.....dHHHHd.....',
  '...dHHhhHHHHd...',
  '..dHHhhHHHHHHd..',
  '.dHHhHHHHHHHHHd.',
  '.dHHHHHHHHHHHHH.',
  'dHHHHHHHHHHHHHH.',
  'dHHHHHSSSSSSSSS.',
  'dHHHSSSSSSSSSSS.',
  '.dHsSSSSSSSSSSS.',
  '.dHEsSSSSSSSSSSS',
  '.dHEsSSSSSSSSSS.',
  '..dHSSSSSSSSSSS.',
  '..dsSSSSSSSSSSs.',
  '...ssSSSSSSSSs..',
  '....ssSSSSSSs...',
  '......ssss......',
];

type Overlay = [number, number, string][];

const EXPRESSIONS: Record<Expression, Overlay> = {
  normal: [
    [8, 6, 'B'], [9, 6, 'B'], [12, 6, 'B'], [13, 6, 'B'],
    [8, 7, 'W'], [9, 7, 'W'], [8, 8, 'W'], [9, 8, 'P'], [8, 9, 'W'], [9, 9, 'P'],
    [12, 7, 'W'], [13, 7, 'W'], [12, 8, 'W'], [13, 8, 'P'], [12, 9, 'W'], [13, 9, 'P'],
    [10, 11, 'M'], [11, 12, 'M'], [12, 12, 'M'], [13, 12, 'M'], [14, 11, 'M'],
  ],
  blink: [
    [8, 6, 'B'], [9, 6, 'B'], [12, 6, 'B'], [13, 6, 'B'],
    [8, 8, 'P'], [9, 8, 'P'], [12, 8, 'P'], [13, 8, 'P'],
    [10, 11, 'M'], [11, 12, 'M'], [12, 12, 'M'], [13, 12, 'M'], [14, 11, 'M'],
  ],
  happy: [
    [7, 8, 'P'], [8, 7, 'P'], [9, 8, 'P'],
    [11, 8, 'P'], [12, 7, 'P'], [13, 8, 'P'],
    [10, 11, 'M'], [11, 11, 'M'], [12, 11, 'M'], [13, 11, 'M'], [14, 11, 'M'],
    [10, 12, 'M'], [11, 12, 'T'], [12, 12, 'T'], [13, 12, 'T'], [14, 12, 'M'],
    [11, 13, 'M'], [12, 13, 'M'], [13, 13, 'M'],
    [6, 10, 'R'], [7, 10, 'R'],
  ],
  focus: [
    [8, 6, 'B'], [9, 7, 'B'], [12, 7, 'B'], [13, 6, 'B'],
    [8, 8, 'W'], [9, 8, 'P'], [8, 9, 'W'], [9, 9, 'P'],
    [12, 8, 'W'], [13, 8, 'P'], [12, 9, 'W'], [13, 9, 'P'],
    [11, 12, 'M'], [12, 12, 'M'], [13, 12, 'M'], [14, 11, 'M'],
  ],
  shock: [
    [7, 6, 'W'], [8, 6, 'W'], [9, 6, 'W'], [7, 7, 'W'], [8, 7, 'P'], [9, 7, 'W'], [7, 8, 'W'], [8, 8, 'W'], [9, 8, 'W'],
    [11, 6, 'W'], [12, 6, 'W'], [13, 6, 'W'], [11, 7, 'W'], [12, 7, 'P'], [13, 7, 'W'], [11, 8, 'W'], [12, 8, 'W'], [13, 8, 'W'],
    [11, 10, 'M'], [12, 10, 'M'],
    [10, 11, 'M'], [11, 11, 'T'], [12, 11, 'T'], [13, 11, 'M'],
    [10, 12, 'M'], [11, 12, 'T'], [12, 12, 'T'], [13, 12, 'M'],
    [11, 13, 'M'], [12, 13, 'M'],
  ],
  lookDown: [
    [8, 7, 'B'], [9, 7, 'B'], [12, 7, 'B'], [13, 7, 'B'],
    [8, 8, 'W'], [9, 8, 'W'], [8, 9, 'P'], [9, 9, 'P'],
    [12, 8, 'W'], [13, 8, 'W'], [12, 9, 'P'], [13, 9, 'P'],
    [12, 12, 'M'], [13, 12, 'M'],
  ],
  disgust: [
    [8, 7, 'P'], [9, 8, 'P'], [8, 9, 'P'],
    [13, 7, 'P'], [12, 8, 'P'], [13, 9, 'P'],
    [10, 12, 'M'], [11, 11, 'M'], [12, 11, 'M'], [13, 11, 'M'], [14, 12, 'M'],
    [12, 12, 'T'], [13, 12, 'T'], [12, 13, 'T'],
  ],
  dizzy: [
    [7, 7, 'P'], [9, 7, 'P'], [8, 8, 'P'], [7, 9, 'P'], [9, 9, 'P'],
    [11, 7, 'P'], [13, 7, 'P'], [12, 8, 'P'], [11, 9, 'P'], [13, 9, 'P'],
    [10, 12, 'M'], [11, 11, 'M'], [12, 12, 'M'], [13, 11, 'M'], [14, 12, 'M'],
  ],
};

function headPalette(look: CharacterLook, expr: Expression): CharPalette {
  const sick = expr === 'disgust';
  return {
    H: look.hair,
    h: look.hairLight,
    d: look.hairDark,
    S: sick ? look.skinSick : look.skin,
    s: sick ? look.skinSickShade : look.skinShade,
    E: sick ? look.skinSickShade : look.skinShade,
    W: look.eyeWhite,
    P: look.pupil,
    B: look.hairDark,
    M: look.mouth,
    T: look.tongue,
    R: look.blush,
  };
}

/** Dibuja la cabeza con la expresión pedida. (x, y) es la esquina superior izquierda. */
export function drawHead(pc: PixelCanvas, x: number, y: number, look: CharacterLook, expr: Expression, flip = false): void {
  const pal = headPalette(look, expr);
  pc.map(x, y, HEAD_BASE, pal, flip);
  for (const [ox, oy, key] of EXPRESSIONS[expr]) {
    const color = pal[key];
    if (!color) continue;
    pc.px(flip ? x + 15 - ox : x + ox, y + oy, color);
  }
}

// ---------------------------------------------------------------------------
// Zapatillas
// ---------------------------------------------------------------------------

const SHOE_MAPS: Record<FootStyle, string[]> = {
  flat: ['.WWWW...', 'WWAWWWW.', 'WAWWWWWW', 'GGGGGGGG'],
  toe: ['WWWW....', 'WAWWWW..', 'GWAWWWWW', '.GGGGGGG'],
  sole: ['.GGG.', 'GgGgG', 'GGGGG', 'GgPPG', 'GPPpG', 'GPPPG', '.GGG.'],
};

function drawShoe(pc: PixelCanvas, ankle: Pt, style: FootStyle, look: CharacterLook, back: boolean, dirty: boolean): void {
  const pal: CharPalette = {
    W: back ? look.shoeBack : look.shoe,
    A: look.shoeAccent,
    G: dirty ? '#6b3d1c' : look.sole,
    g: dirty ? '#4a2810' : '#9aa0ab',
    P: '#6b3d1c',
    p: '#a86d34',
  };
  if (style === 'sole') {
    pc.map(ankle[0] - 2, ankle[1] - 3, SHOE_MAPS.sole, pal);
    return;
  }
  pc.map(ankle[0] - 2, ankle[1], SHOE_MAPS[style], pal);
  if (dirty) {
    // Manchitas marrones en la punta.
    pc.px(ankle[0] + 4, ankle[1] + 2, '#87501f');
    pc.px(ankle[0] + 5, ankle[1] + 1, '#6b3d1c');
  }
}

// ---------------------------------------------------------------------------
// Cuerpo
// ---------------------------------------------------------------------------

function drawLeg(pc: PixelCanvas, leg: Limb, color: string): void {
  pc.line(leg.a[0], leg.a[1], leg.b[0], leg.b[1], color, 4);
  pc.line(leg.b[0], leg.b[1], leg.c[0], leg.c[1], color, 3);
}

function drawArm(pc: PixelCanvas, arm: Limb, sleeve: string, skin: string): void {
  pc.line(arm.a[0], arm.a[1], arm.b[0], arm.b[1], skin, 2);
  pc.line(arm.b[0], arm.b[1], arm.c[0], arm.c[1], skin, 2);
  const sx = Math.round(lerp(arm.a[0], arm.b[0], 0.55));
  const sy = Math.round(lerp(arm.a[1], arm.b[1], 0.55));
  pc.line(arm.a[0], arm.a[1], sx, sy, sleeve, 3);
  pc.rect(arm.c[0] - 1, arm.c[1] - 1, 3, 3, skin);
}

function drawTorso(pc: PixelCanvas, neck: Pt, hip: Pt, look: CharacterLook): void {
  const top = neck[1] + 1;
  const bottom = hip[1];
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top);
    const cx = lerp(neck[0], hip[0], t);
    const half = lerp(5, 4.5, t);
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    for (let x = x0; x < x1; x++) {
      const k = x - x0;
      let c = Math.floor(k / 2) % 2 === 0 ? look.shirtA : look.shirtB;
      if (k === 0) c = look.shirtShade;
      if (y >= bottom - 1) c = look.pants;
      pc.px(x, y, c);
    }
  }
  // Cuello
  pc.rect(neck[0] - 1, neck[1] - 1, 3, 2, look.skinShade);
}

interface DirtState {
  front: boolean;
  back: boolean;
}

function renderPose(pose: Pose, look: CharacterLook, dirt: DirtState): PixelCanvas {
  const pc = new PixelCanvas(PLAYER_FRAME.width, PLAYER_FRAME.height);
  const sick = pose.head === 'disgust';
  const skin = sick ? look.skinSick : look.skin;
  const skinBack = sick ? look.skinSickShade : look.skinShade;

  drawArm(pc, pose.backArm, look.shirtShade, skinBack);
  drawLeg(pc, pose.backLeg, look.pantsBack);
  drawShoe(pc, pose.backLeg.c, pose.backFoot, look, true, dirt.back);
  drawTorso(pc, pose.neck, pose.hip, look);
  drawLeg(pc, pose.frontLeg, look.pants);
  // Al mirar la suela, el pie levantado siempre se ve con el "regalito".
  drawShoe(pc, pose.frontLeg.c, pose.frontFoot, look, false, dirt.front || pose.frontFoot === 'sole');

  const off = pose.headOff ?? [0, 0];
  drawHead(pc, pose.neck[0] - 7 + off[0], pose.neck[1] - 15 + off[1], look, pose.head, pose.headFlip);
  drawArm(pc, pose.frontArm, look.shirtA, skin);

  pc.outline(look.outline);
  return pc;
}

// ---------------------------------------------------------------------------
// Poses (cuadro de 48x48, piso en y = 46, centro en x = 24)
// ---------------------------------------------------------------------------

const P = (x: number, y: number): Pt => [x, y];
const L = (a: Pt, b: Pt, c: Pt): Limb => ({ a, b, c });

const IDLE: Pose = {
  hip: P(24, 32),
  neck: P(24, 21),
  head: 'normal',
  backLeg: L(P(22, 32), P(22, 38), P(21, 43)),
  frontLeg: L(P(26, 32), P(26, 38), P(26, 43)),
  backFoot: 'flat',
  frontFoot: 'flat',
  backArm: L(P(20, 23), P(19, 28), P(19, 32)),
  frontArm: L(P(28, 23), P(29, 28), P(29, 32)),
};

export const PLAYER_POSES: Record<string, Pose> = {
  idle0: IDLE,
  idle1: {
    ...IDLE,
    neck: P(24, 22),
    backArm: L(P(20, 24), P(19, 29), P(19, 33)),
    frontArm: L(P(28, 24), P(29, 29), P(29, 33)),
  },
  blink: { ...IDLE, head: 'blink' },

  walk0: {
    hip: P(24, 32), neck: P(25, 21), head: 'normal',
    frontLeg: L(P(26, 32), P(28, 37), P(30, 43)), frontFoot: 'flat',
    backLeg: L(P(22, 32), P(20, 38), P(17, 43)), backFoot: 'toe',
    frontArm: L(P(28, 23), P(27, 28), P(25, 31)),
    backArm: L(P(21, 23), P(23, 28), P(26, 30)),
  },
  walk1: {
    hip: P(24, 31), neck: P(25, 20), head: 'normal',
    frontLeg: L(P(26, 31), P(25, 37), P(24, 43)), frontFoot: 'flat',
    backLeg: L(P(22, 31), P(24, 36), P(21, 40)), backFoot: 'flat',
    frontArm: L(P(28, 22), P(28, 27), P(28, 31)),
    backArm: L(P(21, 22), P(21, 27), P(22, 31)),
  },
  walk2: {
    hip: P(24, 32), neck: P(25, 21), head: 'normal',
    backLeg: L(P(22, 32), P(25, 37), P(28, 43)), backFoot: 'flat',
    frontLeg: L(P(26, 32), P(23, 38), P(19, 43)), frontFoot: 'toe',
    frontArm: L(P(28, 23), P(30, 27), P(32, 29)),
    backArm: L(P(21, 23), P(19, 28), P(18, 31)),
  },
  walk3: {
    hip: P(24, 31), neck: P(25, 20), head: 'normal',
    backLeg: L(P(22, 31), P(22, 37), P(23, 43)), backFoot: 'flat',
    frontLeg: L(P(26, 31), P(28, 36), P(25, 40)), frontFoot: 'flat',
    frontArm: L(P(28, 22), P(29, 27), P(29, 31)),
    backArm: L(P(21, 22), P(20, 27), P(20, 31)),
  },

  run0: {
    hip: P(24, 31), neck: P(27, 20), head: 'focus', headOff: P(1, 0),
    frontLeg: L(P(26, 31), P(30, 35), P(33, 40)), frontFoot: 'flat',
    backLeg: L(P(22, 31), P(19, 37), P(14, 39)), backFoot: 'toe',
    frontArm: L(P(29, 22), P(26, 26), P(23, 25)),
    backArm: L(P(23, 22), P(26, 26), P(29, 23)),
  },
  run1: {
    hip: P(24, 32), neck: P(27, 21), head: 'focus', headOff: P(1, 0),
    frontLeg: L(P(26, 32), P(28, 37), P(27, 43)), frontFoot: 'flat',
    backLeg: L(P(22, 32), P(20, 36), P(16, 37)), backFoot: 'flat',
    frontArm: L(P(29, 23), P(28, 28), P(27, 31)),
    backArm: L(P(23, 23), P(23, 28), P(25, 30)),
  },
  run2: {
    hip: P(24, 31), neck: P(27, 20), head: 'focus', headOff: P(1, 0),
    backLeg: L(P(22, 31), P(27, 35), P(31, 40)), backFoot: 'flat',
    frontLeg: L(P(26, 31), P(22, 37), P(17, 39)), frontFoot: 'toe',
    frontArm: L(P(29, 22), P(32, 26), P(35, 23)),
    backArm: L(P(23, 22), P(20, 26), P(17, 25)),
  },
  run3: {
    hip: P(24, 32), neck: P(27, 21), head: 'focus', headOff: P(1, 0),
    backLeg: L(P(22, 32), P(24, 37), P(24, 43)), backFoot: 'flat',
    frontLeg: L(P(26, 32), P(25, 36), P(20, 37)), frontFoot: 'flat',
    frontArm: L(P(29, 23), P(30, 28), P(31, 30)),
    backArm: L(P(23, 23), P(21, 28), P(20, 30)),
  },

  jumpPrep: {
    hip: P(24, 35), neck: P(25, 24), head: 'focus',
    backLeg: L(P(22, 35), P(25, 39), P(21, 43)), backFoot: 'flat',
    frontLeg: L(P(26, 35), P(29, 39), P(26, 43)), frontFoot: 'flat',
    frontArm: L(P(28, 26), P(26, 30), P(23, 32)),
    backArm: L(P(21, 26), P(19, 30), P(17, 31)),
  },
  jumpUp: {
    hip: P(24, 30), neck: P(24, 19), head: 'happy',
    frontLeg: L(P(26, 30), P(30, 33), P(28, 38)), frontFoot: 'flat',
    backLeg: L(P(22, 30), P(24, 35), P(20, 38)), backFoot: 'toe',
    frontArm: L(P(28, 21), P(31, 16), P(32, 12)),
    backArm: L(P(21, 21), P(19, 16), P(19, 12)),
  },
  jumpDown: {
    hip: P(24, 31), neck: P(24, 20), head: 'normal',
    frontLeg: L(P(26, 31), P(28, 36), P(28, 42)), frontFoot: 'flat',
    backLeg: L(P(22, 31), P(21, 37), P(19, 41)), backFoot: 'toe',
    frontArm: L(P(28, 22), P(32, 22), P(35, 20)),
    backArm: L(P(21, 22), P(17, 22), P(14, 20)),
  },

  stepShock: {
    hip: P(24, 32), neck: P(24, 21), head: 'shock', headOff: P(0, -1),
    frontLeg: L(P(26, 32), P(27, 38), P(28, 43)), frontFoot: 'flat',
    backLeg: L(P(22, 32), P(21, 38), P(20, 43)), backFoot: 'flat',
    frontArm: L(P(28, 23), P(31, 25), P(33, 22)),
    backArm: L(P(21, 23), P(18, 25), P(16, 22)),
  },
  stepLift: {
    hip: P(24, 32), neck: P(23, 21), head: 'lookDown', headOff: P(-1, 1),
    backLeg: L(P(22, 32), P(23, 38), P(23, 43)), backFoot: 'flat',
    frontLeg: L(P(26, 32), P(25, 38), P(19, 35)), frontFoot: 'sole',
    frontArm: L(P(27, 23), P(24, 28), P(21, 31)),
    backArm: L(P(21, 23), P(18, 22), P(15, 19)),
  },
  stepLook: {
    hip: P(24, 32), neck: P(23, 21), head: 'lookDown', headOff: P(-2, 1), headFlip: true,
    backLeg: L(P(22, 32), P(23, 38), P(23, 43)), backFoot: 'flat',
    frontLeg: L(P(26, 32), P(25, 38), P(19, 35)), frontFoot: 'sole',
    frontArm: L(P(27, 23), P(24, 28), P(20, 32)),
    backArm: L(P(21, 23), P(18, 21), P(16, 17)),
  },
  stepDisgust: {
    hip: P(24, 32), neck: P(26, 21), head: 'disgust', headOff: P(1, 0),
    backLeg: L(P(22, 32), P(23, 38), P(23, 43)), backFoot: 'flat',
    frontLeg: L(P(26, 32), P(24, 38), P(17, 37)), frontFoot: 'sole',
    frontArm: L(P(29, 23), P(32, 21), P(32, 17)),
    backArm: L(P(23, 23), P(19, 25), P(16, 22)),
  },
  dizzy: {
    hip: P(24, 32), neck: P(23, 21), head: 'dizzy', headOff: P(-1, 0),
    frontLeg: L(P(26, 32), P(28, 38), P(27, 43)), frontFoot: 'flat',
    backLeg: L(P(22, 32), P(20, 38), P(21, 43)), backFoot: 'flat',
    frontArm: L(P(27, 23), P(28, 28), P(28, 33)),
    backArm: L(P(21, 23), P(20, 28), P(20, 33)),
  },
  win0: {
    ...IDLE,
    head: 'happy',
    frontArm: L(P(28, 22), P(31, 17), P(33, 12)),
    backArm: L(P(21, 22), P(18, 17), P(16, 12)),
  },
  win1: {
    hip: P(24, 31), neck: P(24, 20), head: 'happy',
    frontLeg: L(P(26, 31), P(29, 35), P(27, 40)), frontFoot: 'flat',
    backLeg: L(P(22, 31), P(22, 37), P(22, 43)), backFoot: 'flat',
    frontArm: L(P(28, 21), P(30, 15), P(31, 10)),
    backArm: L(P(21, 21), P(18, 15), P(17, 10)),
  },
};

export const PLAYER_FRAME_NAMES = Object.keys(PLAYER_POSES);

/**
 * Genera las tres hojas del protagonista: zapatillas limpias, una sucia y las dos sucias.
 */
export function generatePlayerTextures(textures: Phaser.Textures.TextureManager, look: CharacterLook = DEFAULT_LOOK): void {
  const dirtLevels: DirtState[] = [
    { front: false, back: false },
    { front: true, back: false },
    { front: true, back: true },
  ];
  dirtLevels.forEach((dirt, level) => {
    const frames = PLAYER_FRAME_NAMES.map((name) => ({ name, canvas: renderPose(PLAYER_POSES[name], look, dirt) }));
    buildSheet(textures, TEX.player(level), frames, 8);
  });

  // Cabecita para la barra de progreso.
  const head = new PixelCanvas(18, 18);
  drawHead(head, 1, 1, look, 'normal');
  head.outline(look.outline);
  head.addTo(textures, TEX.playerHead);
}
