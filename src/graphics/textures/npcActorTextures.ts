import Phaser from 'phaser';
import { getLook } from '../characterLooks';
import { TEX } from '../keys';
import { buildSheet, PixelCanvas } from '../PixelCanvas';
import { IDLE, L, P, renderPose, type CharacterLook, type Pose } from './playerTextures';

/**
 * NPC con comportamientos (por ahora, el portero barriendo la vereda).
 * Usan el mismo esqueleto que el protagonista: un mismo diseño sirve como
 * NPC y como personaje jugable.
 */

type Broom = { from: [number, number]; to: [number, number] } | null;

const SWEEP_POSES: { name: string; pose: Pose; broom: Broom }[] = [
  {
    name: 'sweep0',
    pose: { ...IDLE, head: 'focus', neck: P(25, 21), frontArm: L(P(28, 23), P(30, 27), P(32, 30)), backArm: L(P(21, 23), P(24, 27), P(29, 29)) },
    broom: { from: [31, 27], to: [39, 45] },
  },
  {
    name: 'sweep1',
    pose: { ...IDLE, head: 'focus', neck: P(25, 22), frontArm: L(P(28, 24), P(29, 28), P(30, 31)), backArm: L(P(21, 24), P(24, 28), P(28, 30)) },
    broom: { from: [29, 28], to: [33, 45] },
  },
  {
    name: 'sweep2',
    pose: { ...IDLE, head: 'normal', neck: P(24, 21), frontArm: L(P(28, 23), P(28, 28), P(28, 31)), backArm: L(P(21, 23), P(23, 28), P(26, 30)) },
    broom: { from: [27, 28], to: [26, 45] },
  },
  {
    name: 'wave',
    pose: { ...IDLE, head: 'happy', frontArm: L(P(28, 22), P(31, 17), P(33, 12)), backArm: L(P(21, 23), P(19, 28), P(18, 31)) },
    broom: { from: [18, 30], to: [14, 45] },
  },
  { name: 'idle', pose: { ...IDLE }, broom: { from: [29, 30], to: [33, 45] } },
];

function drawBroom(pc: PixelCanvas, broom: Broom): void {
  if (!broom) return;
  const [x0, y0] = broom.from;
  const [x1, y1] = broom.to;
  pc.line(x0, y0, x1, y1, '#21142b', 3);
  pc.line(x0, y0, x1, y1, '#c99a5a', 1);
  // Cerdas de la escoba.
  pc.rect(x1 - 4, y1 - 2, 9, 4, '#21142b');
  pc.rect(x1 - 3, y1 - 1, 7, 2, '#e3c26a');
  pc.hline(x1 - 3, y1 + 1, 7, '#b8923a');
}

function sweeperFrames(look: CharacterLook): { name: string; canvas: PixelCanvas }[] {
  return SWEEP_POSES.map(({ name, pose, broom }) => {
    const pc = renderPose(pose, look);
    drawBroom(pc, broom);
    return { name, canvas: pc };
  });
}

const WAVE_POSE: Pose = { ...IDLE, head: 'happy', frontArm: L(P(28, 22), P(31, 17), P(33, 12)), backArm: L(P(21, 23), P(19, 28), P(18, 31)) };

/** Manguera: del pico (en la mano) hasta el piso, con un rollo al costado. */
function drawHose(pc: PixelCanvas, nozzle: [number, number] | null, hand: [number, number]): void {
  const green = '#3f7a4a';
  pc.line(hand[0], hand[1], 15, 45, '#21142b', 3).line(hand[0], hand[1], 15, 45, green, 1);
  pc.rect(9, 42, 9, 4, '#21142b');
  pc.rect(10, 43, 7, 2, green);
  if (nozzle) {
    pc.rect(nozzle[0], nozzle[1], 4, 4, '#21142b');
    pc.rect(nozzle[0] + 1, nozzle[1] + 1, 2, 2, '#c4c8d2');
  }
}

/** La vecina que riega: quieta, regando (dos cuadros) y saludando. */
function wateringFrames(look: CharacterLook): { name: string; canvas: PixelCanvas }[] {
  const water = (dy: number): Pose => ({ ...IDLE, head: 'focus', frontArm: L(P(28, 23), P(32, 25 + dy), P(36, 25 + dy)), backArm: L(P(21, 23), P(25, 26), P(30, 26 + dy)) });
  const frames: { name: string; pose: Pose; nozzle: [number, number] | null; hand: [number, number] }[] = [
    { name: 'idle', pose: { ...IDLE }, nozzle: [27, 31], hand: [29, 32] },
    { name: 'water0', pose: water(0), nozzle: [36, 23], hand: [31, 27] },
    { name: 'water1', pose: water(1), nozzle: [36, 24], hand: [31, 28] },
    { name: 'wave', pose: WAVE_POSE, nozzle: null, hand: [19, 31] },
  ];
  return frames.map(({ name, pose, nozzle, hand }) => {
    const pc = renderPose(pose, look);
    drawHose(pc, nozzle, hand);
    return { name, canvas: pc };
  });
}

/** Personas que sólo esperan y saludan (la dueña del perro perdido). */
function waverFrames(look: CharacterLook): { name: string; canvas: PixelCanvas }[] {
  return [
    { name: 'idle', canvas: renderPose({ ...IDLE }, look) },
    { name: 'wave', canvas: renderPose(WAVE_POSE, look) },
  ];
}

/** Looks de NPC que tienen saludo (las animaciones se registran con esta lista). */
export const WAVING_NPC_LOOKS = ['portero', 'portero-alt', 'duena', 'senora'];

export function generateNpcActorTextures(textures: Phaser.Textures.TextureManager): void {
  buildSheet(textures, TEX.npc('portero'), sweeperFrames(getLook('portero')), 5);
  buildSheet(textures, TEX.npc('portero-alt'), sweeperFrames(getLook('portero-alt')), 5);
  buildSheet(textures, TEX.npc('senora'), wateringFrames(getLook('senora')), 4);
  buildSheet(textures, TEX.npc('duena'), waverFrames(getLook('duena')), 2);
}
