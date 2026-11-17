import { playInstrument, type InstrumentName, type SynthContext } from './synth';

/**
 * Música original en formato de patrones (un token por semicorchea):
 *   "A4"        nota · "D4+F4+A4" acorde · "-" sostiene la nota anterior
 *   "."         silencio · "x" golpe (percusión)
 */

export type TrackName = 'menu' | 'game';

interface Channel {
  inst: InstrumentName;
  vol: number;
  steps: string[];
}

export interface Track {
  bpm: number;
  stepsPerBeat: number;
  length: number;
  channels: Channel[];
}

function bars(...rows: string[]): string[] {
  return rows.join(' ').trim().split(/\s+/);
}

function repeat(pattern: string, times: number): string[] {
  return bars(...new Array(times).fill(pattern));
}

/** "Milonga del Sorete": ritmo 3-3-2 en re menor, para la partida. */
const MILONGA_BASS = {
  Dm: 'D2 - - A2 - - D3 -',
  A7: 'A1 - - E2 - - A2 -',
  Gm: 'G1 - - D2 - - G2 -',
  F: 'F2 - - C3 - - F3 -',
  C7: 'C2 - - G2 - - C3 -',
  Bb: 'Bb1 - - F2 - - Bb2 -',
};
const MILONGA_CHORD = {
  Dm: '. . D4+F4+A4 . . D4+F4+A4 . .',
  A7: '. . C#4+E4+G4 . . C#4+E4+G4 . .',
  Gm: '. . D4+G4+Bb4 . . D4+G4+Bb4 . .',
  F: '. . F4+A4+C5 . . F4+A4+C5 . .',
  C7: '. . E4+G4+Bb4 . . E4+G4+Bb4 . .',
  Bb: '. . D4+F4+Bb4 . . D4+F4+Bb4 . .',
};
const MILONGA_FORM: (keyof typeof MILONGA_BASS)[] = [
  'Dm', 'Dm', 'A7', 'A7', 'A7', 'A7', 'Dm', 'Dm',
  'Gm', 'Gm', 'Dm', 'Dm', 'A7', 'A7', 'Dm', 'Dm',
  'F', 'C7', 'F', 'F', 'Bb', 'F', 'C7', 'A7',
];

const GAME_TRACK: Track = {
  bpm: 118,
  stepsPerBeat: 4,
  length: 8 * MILONGA_FORM.length,
  channels: [
    {
      inst: 'lead',
      vol: 0.05,
      steps: bars(
        'A4 - - D5 - - C#5 -', 'D5 - A4 - F4 - D4 -', 'E4 - - G4 - - Bb4 -', 'A4 - - - . . . .',
        'C#5 - - E5 - - G5 -', 'F5 - E5 - D5 - C#5 -', 'D5 - - A4 - - F4 -', 'D4 - - - . . A4 -',
        'Bb4 - - D5 - - G5 -', 'F5 - - E5 - - D5 -', 'F5 - - D5 - - A4 -', 'F4 - A4 - D5 - . .',
        'E5 - - C#5 - - A4 -', 'G4 - F4 - E4 - C#4 -', 'D4 - F4 - A4 - D5 -', 'D5 - - - . . . .',
        'A4 - C5 - F5 - - -', 'E5 - D5 - C5 - Bb4 -', 'A4 - - C5 - - F5 -', 'E5 - F5 - G5 - - -',
        'F5 - D5 - Bb4 - D5 -', 'C5 - A4 - F4 - A4 -', 'G4 - Bb4 - E5 - G5 -', 'A4 - - - E5 - C#5 -',
      ),
    },
    { inst: 'bass', vol: 0.12, steps: bars(...MILONGA_FORM.map((c) => MILONGA_BASS[c])) },
    { inst: 'chord', vol: 0.025, steps: bars(...MILONGA_FORM.map((c) => MILONGA_CHORD[c])) },
    { inst: 'hat', vol: 0.025, steps: repeat('x . x . x . x .', MILONGA_FORM.length) },
    { inst: 'snare', vol: 0.04, steps: repeat('. . . x . . x .', MILONGA_FORM.length) },
  ],
};

/** "Tanguito de la Vereda": tango marcato en la menor, para el menú. */
const TANGO_FORM = ['Am', 'Am', 'Dm', 'Dm', 'E7', 'E7', 'Am', 'E7'] as const;
const TANGO_BASS: Record<(typeof TANGO_FORM)[number], string> = {
  Am: 'A2 - . . E2 - . . A2 - . . E2 - C3 -',
  Dm: 'D2 - . . A2 - . . D2 - . . A2 - F2 -',
  E7: 'E2 - . . B2 - . . E2 - . . G#2 - B2 -',
};
const TANGO_CHORD: Record<(typeof TANGO_FORM)[number], string> = {
  Am: 'A3+C4+E4 . . . A3+C4+E4 . . . A3+C4+E4 . . . A3+C4+E4 . . .',
  Dm: 'A3+D4+F4 . . . A3+D4+F4 . . . A3+D4+F4 . . . A3+D4+F4 . . .',
  E7: 'G#3+B3+D4 . . . G#3+B3+D4 . . . G#3+B3+D4 . . . G#3+B3+D4 . . .',
};

const MENU_TRACK: Track = {
  bpm: 96,
  stepsPerBeat: 4,
  length: 16 * TANGO_FORM.length,
  channels: [
    {
      inst: 'lead',
      vol: 0.05,
      steps: bars(
        'E5 - - - - - D5 - C5 - B4 - A4 - - -',
        'C5 - - - B4 - A4 - G#4 - - - A4 - - -',
        'F5 - - - - - E5 - D5 - C5 - A4 - - -',
        'D5 - - - C5 - B4 - A4 - - - . . . .',
        'B4 - - - - - C5 - D5 - E5 - G#4 - - -',
        'B4 - - - A4 - G#4 - E4 - - - . . . .',
        'A4 - B4 - C5 - D5 - E5 - - - A5 - - -',
        'G#5 - - - E5 - - - B4 - - - . . E4 -',
      ),
    },
    { inst: 'bass', vol: 0.12, steps: bars(...TANGO_FORM.map((c) => TANGO_BASS[c])) },
    { inst: 'chord', vol: 0.022, steps: bars(...TANGO_FORM.map((c) => TANGO_CHORD[c])) },
    { inst: 'hat', vol: 0.018, steps: repeat('. . x . . . x . . . x . . . x .', TANGO_FORM.length) },
  ],
};

export const TRACKS: Record<TrackName, Track> = {
  menu: MENU_TRACK,
  game: GAME_TRACK,
};

/**
 * Secuenciador con programación anticipada: cada 25 ms agenda las notas de
 * los próximos ~120 ms usando el reloj del AudioContext (timing preciso).
 */
export class Sequencer {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private readonly bus: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly noiseBuffer: AudioBuffer,
    private readonly track: Track,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(destination);
  }

  start(): void {
    this.stop();
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Detiene y desvanece rápido las notas ya programadas. */
  dispose(): void {
    this.stop();
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.08);
    window.setTimeout(() => this.bus.disconnect(), 200);
  }

  private tick(): void {
    const secPerStep = 60 / this.track.bpm / this.track.stepsPerBeat;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.03;
    while (this.nextTime < now + 0.12) {
      this.scheduleStep(this.step, this.nextTime, secPerStep);
      this.nextTime += secPerStep;
      this.step = (this.step + 1) % this.track.length;
    }
  }

  private scheduleStep(step: number, time: number, secPerStep: number): void {
    const s: SynthContext = { ctx: this.ctx, out: this.bus, noise: this.noiseBuffer, now: 0 };
    for (const ch of this.track.channels) {
      const token = ch.steps[step % ch.steps.length];
      if (!token || token === '-' || token === '.') continue;
      let holds = 0;
      while (ch.steps[(step + 1 + holds) % ch.steps.length] === '-' && holds < 32) holds++;
      const dur = (1 + holds) * secPerStep * 0.94;
      const notes = token === 'x' ? [] : token.split('+');
      playInstrument(s, ch.inst, notes, time, dur, ch.vol);
    }
  }
}
