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

export function generateNpcActorTextures(textures: Phaser.Textures.TextureManager): void {
  buildSheet(textures, TEX.npc('portero'), sweeperFrames(getLook('portero')), 5);
  buildSheet(textures, TEX.npc('portero-alt'), sweeperFrames(getLook('portero-alt')), 5);
}
