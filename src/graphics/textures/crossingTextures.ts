import Phaser from 'phaser';
import { CROSSING_TUNING } from '../../config/balance';
import { LAYOUT } from '../../config/constants';
import { PAL } from '../../config/palette';
import { RNG } from '../../core/rng';
import { VEHICLE_TYPES, vehicleTextureKey, type VehicleType } from '../../data/vehicles';
import { mix, shade } from '../color';
import { TEX } from '../keys';
import { packStrip, PixelCanvas } from '../PixelCanvas';

/**
 * Gráficos de los cruces peatonales: calzada transversal con senda peatonal,
 * semáforos (vehicular y peatonal) y vehículos vistos de frente / de atrás
 * (circulan en el eje de profundidad, perpendicular al recorrido).
 */

/** La calzada transversal se dibuja desde esta altura de pantalla hacia abajo. */
export const CROSSING_TOP_Y = 56;
export const CROSSING_HEIGHT = 270 - CROSSING_TOP_Y;

function drawCrossingRoad(): PixelCanvas {
  const W = CROSSING_TUNING.width;
  const H = CROSSING_HEIGHT;
  const L = CROSSING_TUNING.roadInset;
  const R = W - CROSSING_TUNING.roadInset;
  const pc = new PixelCanvas(W, H);
  const rng = new RNG(17);
  const ly = (worldY: number) => worldY - CROSSING_TOP_Y;
  const curbBottom = ly(LAYOUT.curbTop + LAYOUT.curbHeight);

  // Veredas de la calle transversal (a los costados) hasta el cordón principal.
  for (const [x0, x1] of [
    [0, L - 3],
    [R + 3, W],
  ]) {
    pc.rect(x0, 0, x1 - x0, ly(LAYOUT.curbTop), PAL.tile);
    for (let y = 0; y < ly(LAYOUT.curbTop); y += LAYOUT.tileH) pc.hline(x0, y, x1 - x0, PAL.grout);
    for (let x = x0 + 7; x < x1; x += LAYOUT.tileW) pc.vline(x, 0, ly(LAYOUT.curbTop), PAL.grout);
    // Entre los edificios hay más sombra (la vereda se aleja hacia el fondo).
    pc.dither(x0, 0, x1 - x0, ly(LAYOUT.facadeBaseY), 'rgba(40, 30, 60, 0.35)');
    // El cordón principal dobla en la esquina.
    pc.rect(x0, ly(LAYOUT.curbTop), x1 - x0, LAYOUT.curbHeight, PAL.curbFace);
    pc.hline(x0, ly(LAYOUT.curbTop), x1 - x0, PAL.curbTop);
  }

  // Calzada de adoquines.
  for (let y = 0; y < H; y += 6) {
    let x = L + ((y / 6) % 2 === 0 ? 0 : 5);
    while (x < R) {
      const w = Math.min(rng.int(8, 12), R - x);
      const far = y < ly(LAYOUT.facadeBaseY) ? 0.25 * (1 - y / ly(LAYOUT.facadeBaseY)) : 0;
      const c = shade(rng.pick([PAL.cobble, PAL.cobbleLight, mix(PAL.cobble, PAL.cobbleDark, 0.4)]), -far);
      pc.rect(x, y, w, 6, PAL.cobbleGap);
      if (w > 2) {
        pc.rect(x + 1, y, w - 2, 5, c);
        pc.hline(x + 1, y, w - 3, shade(c, 0.15));
      }
      x += w;
    }
  }

  // Cordones de la transversal.
  pc.rect(L - 3, 0, 3, curbBottom, PAL.curbFace);
  pc.vline(L - 3, 0, curbBottom, PAL.curbTop);
  pc.rect(R, 0, 3, curbBottom, PAL.curbFace);
  pc.vline(R + 2, 0, curbBottom, PAL.curbShadow);

  // Senda peatonal: franjas que acompañan el sentido de los autos, a lo ancho de toda la vereda.
  const cw0 = ly(LAYOUT.walkMinY + 2);
  const cw1 = ly(LAYOUT.walkMaxY - 2);
  for (let x = L + 4; x < R - 4; x += 9) {
    pc.rect(x, cw0, 5, cw1 - cw0, '#f2efe6');
    pc.vline(x + 4, cw0, cw1 - cw0, '#cfcac0');
  }
  // Rampas para cruzar.
  pc.rect(L - 3, cw0 + 8, 3, cw1 - cw0 - 16, PAL.curbTop);
  pc.rect(R, cw0 + 8, 3, cw1 - cw0 - 16, PAL.curbTop);

  // Línea divisoria de carriles (punteada), salvo sobre la senda.
  const cx = Math.round((L + R) / 2) - 1;
  for (let y = 2; y < H; y += 16) {
    if (y + 8 > cw0 - 6 && y < cw1 + 6) continue;
    pc.rect(cx, y, 2, 8, 'rgba(242, 239, 230, 0.85)');
  }
  return pc;
}

/** Semáforo vehicular: caja con tres luces. */
function vehicleSignal(lit: 'red' | 'yellow' | 'green' | 'off'): PixelCanvas {
  const pc = new PixelCanvas(9, 21);
  pc.rect(1, 0, 7, 21, '#1f1a24');
  pc.rect(2, 1, 5, 19, '#2e2838');
  const lamp = (y: number, on: boolean, color: string, dim: string) => {
    pc.disc(4.5, y, 2, on ? color : dim);
    if (on) pc.px(3, y - 1, '#ffffff');
  };
  lamp(4, lit === 'red', '#ff4a3a', '#5a2222');
  lamp(10, lit === 'yellow', '#ffcc2a', '#5a4a1a');
  lamp(16, lit === 'green', '#4cff7a', '#1d4a2a');
  pc.outline(PAL.outline);
  return pc;
}

/** Semáforo peatonal: mano roja (esperá) u hombrecito caminando (cruzá). */
function pedestrianSignal(state: 'stop' | 'walk' | 'off', scale = 1): PixelCanvas {
  const s = scale;
  const pc = new PixelCanvas(12 * s, 14 * s);
  pc.rect(0, 0, 12 * s, 14 * s, '#1f1a24');
  pc.rect(1 * s, 1 * s, 10 * s, 12 * s, '#120c18');
  const P = (x: number, y: number, c: string) => pc.rect((2 + x) * s, (2 + y) * s, s, s, c);
  if (state === 'stop') {
    const hand = ['.X.X.X.', '.X.X.X.', 'XXXXXX.', 'XXXXXXX', 'XXXXXX.', '.XXXX..', '.XXXX..', '.XXXX..'];
    hand.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && P(x + 1, y + 1, '#ff5a3a')));
  } else if (state === 'walk') {
    const man = ['...XX..', '...XX..', '..XXX..', '.X.XXX.', '...XX.X', '..X.X..', '.X...X.', 'X.....X'];
    man.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && P(x + 1, y + 1, '#e8fff0')));
  }
  if (state === 'off') pc.rect(3 * s, 4 * s, 6 * s, 6 * s, '#2a2230');
  pc.outline(PAL.outline);
  return pc;
}

function signalPole(height: number): PixelCanvas {
  const pc = new PixelCanvas(4, height);
  pc.rect(1, 0, 2, height, '#3d4a52');
  pc.vline(1, 0, height, '#5f707a');
  pc.rect(0, height - 3, 4, 3, '#2b3338');
  return pc;
}

/** Halo de luz (se usa con mezcla aditiva para faroles y semáforos). */
function glow(size: number): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (d >= 1) continue;
      // Escalones de opacidad (pixel art) en lugar de un degradé continuo.
      const a = d < 0.35 ? 0.55 : d < 0.6 ? 0.32 : d < 0.82 ? 0.16 : 0.07;
      pc.px(x, y, `rgba(255, 255, 255, ${a})`);
    }
  }
  return pc;
}

/**
 * Vehículo visto desde arriba en perspectiva: arriba el techo, abajo la cara
 * que mira a la cámara (frente si viene hacia nosotros, cola si se aleja).
 */
function drawVehicle(type: VehicleType, facing: 'front' | 'rear'): PixelCanvas {
  const W = type.width;
  const L = type.length;
  const H = type.height;
  const pc = new PixelCanvas(W + 2, L + H);
  const body = type.body;
  const dark = shade(body, -0.32);
  const light = shade(body, 0.22);
  const glass = '#7fb6d4';
  const glassDark = '#4f7f9c';
  const ox = 1;
  // Ruedas que asoman a los costados.
  const wheel = '#1f1a24';
  for (const wy of [Math.round(L * 0.18), Math.round(L * 0.72)]) {
    pc.rect(ox - 1, wy, 2, 7, wheel);
    pc.rect(ox + W - 1, wy, 2, 7, wheel);
  }
  // Planta (vista superior).
  pc.rect(ox + 1, 0, W - 2, L, body);
  pc.rect(ox, 2, W, L - 4, body);
  pc.vline(ox, 2, L - 4, light);
  pc.vline(ox + W - 1, 2, L - 4, dark);

  if (type.kind === 'bus') {
    // Techo del colectivo con rejillas y franja de color.
    pc.rect(ox + 2, 2, W - 4, L - 4, type.roof ?? '#f4f4f0');
    pc.rect(ox + 2, 2, W - 4, 3, shade(type.roof ?? '#f4f4f0', -0.15));
    for (let y = 10; y < L - 10; y += 14) pc.rect(ox + 8, y, W - 16, 6, '#c9ccd2');
    pc.rect(ox, Math.round(L * 0.5), W, 3, '#e8433a');
  } else {
    // Capó, parabrisas, techo, luneta y baúl. El frente queda abajo si viene hacia la cámara.
    const frontAtBottom = facing === 'front';
    const hoodLen = Math.round(L * 0.24);
    const cabin0 = frontAtBottom ? Math.round(L * 0.24) : Math.round(L * 0.3);
    const cabin1 = frontAtBottom ? Math.round(L * 0.7) : Math.round(L * 0.76);
    const roof = type.roof ?? shade(body, 0.08);
    pc.rect(ox + 3, cabin0, W - 6, cabin1 - cabin0, roof);
    const wsY = frontAtBottom ? cabin1 - 6 : cabin0;
    const rwY = frontAtBottom ? cabin0 : cabin1 - 5;
    pc.rect(ox + 3, wsY, W - 6, 6, glass);
    pc.hline(ox + 4, wsY + 1, W - 9, '#cfe9f5');
    pc.rect(ox + 4, rwY, W - 8, 5, glassDark);
    pc.hline(ox + 3, frontAtBottom ? L - hoodLen : hoodLen, W - 6, dark);
    if (type.kind === 'taxi') {
      // Cartelito de techo.
      pc.rect(ox + Math.round(W / 2) - 4, Math.round((cabin0 + cabin1) / 2) - 2, 8, 4, '#ffffff');
      pc.hline(ox + Math.round(W / 2) - 3, Math.round((cabin0 + cabin1) / 2), 6, '#1f1a24');
    }
  }

  // Cara visible (frente o cola).
  const fy = L;
  pc.rect(ox, fy - 1, W, H + 1, dark);
  pc.rect(ox + 1, fy, W - 2, H - 3, shade(body, -0.12));
  if (type.kind === 'bus') {
    pc.rect(ox + 3, fy + 1, W - 6, Math.round(H * 0.45), facing === 'front' ? glass : glassDark);
    pc.rect(ox + 6, fy + 1, W - 12, 3, '#ffb000');
    if (facing === 'front') pc.text('29', ox + Math.round(W / 2) - 4, fy + 1, '#1f1a24');
  } else {
    pc.rect(ox + 3, fy + 1, W - 6, 4, facing === 'front' ? shade(glass, -0.1) : glassDark);
  }
  const lampY = fy + H - 7;
  if (facing === 'front') {
    pc.rect(ox + 1, lampY, 5, 3, '#fff6c8');
    pc.rect(ox + W - 6, lampY, 5, 3, '#fff6c8');
    pc.rect(ox + 8, lampY, W - 16, 3, '#2b2530');
    for (let x = ox + 9; x < ox + W - 9; x += 2) pc.px(x, lampY + 1, '#5a5562');
  } else {
    pc.rect(ox + 1, lampY, 5, 3, '#e8433a');
    pc.rect(ox + W - 6, lampY, 5, 3, '#e8433a');
  }
  // Patente y paragolpes.
  pc.rect(ox + Math.round(W / 2) - 4, lampY + 1, 8, 3, '#f4f4f0');
  pc.rect(ox, fy + H - 3, W, 3, '#b4b4bc');
  pc.hline(ox, fy + H - 1, W, '#7a7a84');
  pc.outline(PAL.outline);
  return pc;
}

export const SIGNAL_FRAMES = {
  vehRed: 'veh-red',
  vehYellow: 'veh-yellow',
  vehGreen: 'veh-green',
  vehOff: 'veh-off',
  pedStop: 'ped-stop',
  pedWalk: 'ped-walk',
  pedOff: 'ped-off',
  pole: 'pole',
} as const;

export function generateCrossingTextures(textures: Phaser.Textures.TextureManager): void {
  drawCrossingRoad().addTo(textures, TEX.crossingRoad);
  packStrip(textures, TEX.signals, [
    { name: SIGNAL_FRAMES.vehRed, canvas: vehicleSignal('red') },
    { name: SIGNAL_FRAMES.vehYellow, canvas: vehicleSignal('yellow') },
    { name: SIGNAL_FRAMES.vehGreen, canvas: vehicleSignal('green') },
    { name: SIGNAL_FRAMES.vehOff, canvas: vehicleSignal('off') },
    { name: SIGNAL_FRAMES.pedStop, canvas: pedestrianSignal('stop') },
    { name: SIGNAL_FRAMES.pedWalk, canvas: pedestrianSignal('walk') },
    { name: SIGNAL_FRAMES.pedOff, canvas: pedestrianSignal('off') },
    { name: SIGNAL_FRAMES.pole, canvas: signalPole(52) },
  ]);
  packStrip(textures, TEX.hudSignal, [
    { name: SIGNAL_FRAMES.pedStop, canvas: pedestrianSignal('stop', 2) },
    { name: SIGNAL_FRAMES.pedWalk, canvas: pedestrianSignal('walk', 2) },
    { name: SIGNAL_FRAMES.pedOff, canvas: pedestrianSignal('off', 2) },
  ]);
  glow(32).addTo(textures, TEX.glow);
  for (const type of VEHICLE_TYPES) {
    drawVehicle(type, 'front').addTo(textures, vehicleTextureKey(type.id, 'front'));
    drawVehicle(type, 'rear').addTo(textures, vehicleTextureKey(type.id, 'rear'));
  }
}
