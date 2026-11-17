import { noise, noteToFreq, tone, type SynthContext } from './synth';

/** Catálogo de efectos de sonido sintetizados. */
export type SfxName =
  | 'jump'
  | 'land'
  | 'splat'
  | 'bleh'
  | 'lifeLost'
  | 'dodge'
  | 'closeCall'
  | 'combo'
  | 'splash'
  | 'bonus'
  | 'victory'
  | 'gameOver'
  | 'click'
  | 'select'
  | 'pause'
  | 'flap'
  | 'start';

type SfxFn = (s: SynthContext, param: number) => void;

function melody(s: SynthContext, notes: [string, number][], type: OscillatorType, vol: number, gap = 0.0): number {
  let t = 0;
  for (const [n, d] of notes) {
    if (n !== '.') tone(s, { type, freq: noteToFreq(n), start: t, dur: d * 0.95, vol, attack: 0.005, hold: true, release: 0.04 });
    t += d + gap;
  }
  return t;
}

function chord(s: SynthContext, notes: string[], start: number, dur: number, vol: number): void {
  for (const n of notes) {
    tone(s, { type: 'square', freq: noteToFreq(n), start, dur, vol, attack: 0.004, filter: { type: 'lowpass', freq: 2400 } });
    tone(s, { type: 'triangle', freq: noteToFreq(n), start, dur, vol: vol * 0.8, attack: 0.004 });
  }
}

export const SFX: Record<SfxName, SfxFn> = {
  jump: (s) => {
    tone(s, { type: 'square', freq: 280, to: 640, dur: 0.14, vol: 0.13, filter: { type: 'lowpass', freq: 3000 } });
    tone(s, { type: 'triangle', freq: 560, to: 1280, dur: 0.1, vol: 0.06 });
  },
  land: (s) => {
    noise(s, { dur: 0.07, vol: 0.16, filter: 'lowpass', freq: 600 });
  },
  splat: (s) => {
    // "¡SPLORCH!": ruido pastoso que baja + golpe grave.
    noise(s, { dur: 0.34, vol: 0.55, filter: 'lowpass', freq: 2000, to: 160, q: 5 });
    tone(s, { type: 'sine', freq: 230, to: 50, dur: 0.28, vol: 0.45 });
    tone(s, { type: 'square', freq: 95, to: 40, dur: 0.14, vol: 0.1, start: 0.02 });
    noise(s, { dur: 0.12, vol: 0.2, filter: 'bandpass', freq: 500, q: 8, start: 0.12 });
  },
  bleh: (s) => {
    // "¡Bleeeh!" con formante de voz y vibrato.
    tone(s, {
      type: 'sawtooth',
      freq: 270,
      to: 150,
      dur: 0.5,
      vol: 0.16,
      hold: true,
      vibrato: { rate: 10, depth: 22 },
      filter: { type: 'bandpass', freq: 950, q: 2.2 },
    });
    tone(s, { type: 'square', freq: 135, to: 75, dur: 0.5, vol: 0.05, hold: true, filter: { type: 'lowpass', freq: 800 } });
  },
  lifeLost: (s) => {
    melody(s, [['E5', 0.08], ['C5', 0.08], ['G4', 0.16]], 'square', 0.09);
  },
  dodge: (s, streak) => {
    const step = Math.min(14, Math.max(0, streak));
    const f = 700 * Math.pow(2, step / 12);
    tone(s, { type: 'triangle', freq: f, dur: 0.07, vol: 0.09 });
    tone(s, { type: 'square', freq: f * 2, dur: 0.04, vol: 0.025 });
  },
  closeCall: (s) => {
    noise(s, { dur: 0.2, vol: 0.18, filter: 'bandpass', freq: 600, to: 3600, q: 2 });
    tone(s, { type: 'sine', freq: 1200, to: 1900, dur: 0.1, vol: 0.05, start: 0.05 });
  },
  combo: (s) => {
    melody(s, [['C5', 0.05], ['E5', 0.05], ['G5', 0.05], ['C6', 0.12]], 'square', 0.08);
  },
  splash: (s) => {
    noise(s, { dur: 0.28, vol: 0.32, filter: 'bandpass', freq: 1500, to: 700, q: 1.2 });
    for (let i = 0; i < 4; i++) {
      const f = 500 + Math.random() * 900;
      tone(s, { type: 'sine', freq: f, to: f * 1.6, dur: 0.05, vol: 0.06, start: 0.05 + i * 0.045 });
    }
  },
  bonus: (s) => {
    tone(s, { type: 'square', freq: 988, dur: 0.08, vol: 0.1 });
    tone(s, { type: 'square', freq: 1319, dur: 0.3, vol: 0.1, start: 0.08 });
  },
  victory: (s) => {
    const t = melody(
      s,
      [
        ['G4', 0.1],
        ['C5', 0.1],
        ['E5', 0.1],
        ['G5', 0.2],
        ['E5', 0.1],
        ['G5', 0.35],
        ['.', 0.12],
      ],
      'square',
      0.09,
    );
    // El clásico "chan-chan" del final de un tango.
    chord(s, ['G3', 'B3', 'D4', 'F4'], t, 0.12, 0.06);
    chord(s, ['C3', 'E4', 'G4', 'C5'], t + 0.42, 0.22, 0.07);
  },
  gameOver: (s) => {
    // Trombón triste.
    const notes: [number, number][] = [
      [233.08, 0.32],
      [220.0, 0.32],
      [207.65, 0.32],
      [196.0, 1.0],
    ];
    let t = 0;
    notes.forEach(([f, d], i) => {
      tone(s, {
        type: 'sawtooth',
        freq: f,
        start: t,
        dur: d,
        vol: 0.16,
        hold: true,
        attack: 0.03,
        release: 0.12,
        filter: { type: 'lowpass', freq: 1300, q: 1.5 },
        vibrato: i === notes.length - 1 ? { rate: 6, depth: 6, delay: 0.15 } : undefined,
      });
      t += d;
    });
  },
  click: (s) => {
    tone(s, { type: 'square', freq: 880, dur: 0.04, vol: 0.07 });
  },
  select: (s) => {
    tone(s, { type: 'square', freq: 660, to: 990, dur: 0.07, vol: 0.08 });
  },
  pause: (s) => {
    tone(s, { type: 'square', freq: 523, dur: 0.06, vol: 0.07 });
    tone(s, { type: 'square', freq: 392, dur: 0.1, vol: 0.07, start: 0.07 });
  },
  flap: (s) => {
    for (let i = 0; i < 3; i++) noise(s, { start: i * 0.055, dur: 0.035, vol: 0.06, filter: 'bandpass', freq: 1100, q: 1.5 });
  },
  start: (s) => {
    melody(s, [['C5', 0.06], ['E5', 0.06], ['G5', 0.06], ['C6', 0.16]], 'square', 0.08);
  },
};
