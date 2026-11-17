/**
 * Síntesis de sonido con Web Audio API. No usa archivos: todos los efectos
 * son originales y se generan en el momento.
 */

export interface SynthContext {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  /** Momento base (segundos de AudioContext) para programar los sonidos. */
  now: number;
}

export interface ToneOptions {
  type: OscillatorType;
  freq: number;
  to?: number;
  start?: number;
  dur: number;
  vol: number;
  attack?: number;
  release?: number;
  detune?: number;
  vibrato?: { rate: number; depth: number; delay?: number };
  filter?: { type: BiquadFilterType; freq: number; q?: number; to?: number };
  /** Mantiene el volumen (sustain) en lugar de decaer exponencialmente. */
  hold?: boolean;
}

export function tone(s: SynthContext, o: ToneOptions): void {
  const { ctx } = s;
  const t0 = s.now + (o.start ?? 0);
  const end = t0 + o.dur;
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), end);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t0);

  const g = ctx.createGain();
  const attack = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t0 + attack);
  if (o.hold) {
    const release = o.release ?? 0.06;
    g.gain.setValueAtTime(Math.max(0.0002, o.vol), Math.max(t0 + attack, end - release));
  }
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, t0);
    if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, end);
    f.Q.value = o.filter.q ?? 0.8;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(s.out);

  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = o.vibrato.rate;
    lg.gain.setValueAtTime(0, t0);
    lg.gain.linearRampToValueAtTime(o.vibrato.depth, t0 + (o.vibrato.delay ?? 0) + 0.05);
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(end + 0.05);
  }
  osc.start(t0);
  osc.stop(end + 0.05);
}

export interface NoiseOptions {
  start?: number;
  dur: number;
  vol: number;
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
  attack?: number;
}

export function noise(s: SynthContext, o: NoiseOptions): void {
  const { ctx } = s;
  const t0 = s.now + (o.start ?? 0);
  const end = t0 + o.dur;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter;
  f.frequency.setValueAtTime(o.freq, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, end);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t0 + (o.attack ?? 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(f);
  f.connect(g);
  g.connect(s.out);
  src.start(t0, Math.random() * 0.8);
  src.stop(end + 0.05);
}

export function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Convierte "A4", "C#5" o "Bb3" a frecuencia en Hz. */
export function noteToFreq(note: string): number {
  const m = note.match(/^([A-G])([#b]?)(-?\d)$/);
  if (!m) return 440;
  let semitone = NOTE_INDEX[m[1]];
  if (m[2] === '#') semitone += 1;
  if (m[2] === 'b') semitone -= 1;
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------------------------------------------------------------------
// Instrumentos para la música
// ---------------------------------------------------------------------------

export type InstrumentName = 'lead' | 'bass' | 'chord' | 'hat' | 'snare';

export function playInstrument(s: SynthContext, inst: InstrumentName, notes: string[], start: number, dur: number, vol: number): void {
  switch (inst) {
    case 'lead':
      // "Bandoneón" de 8 bits: dos sierras desafinadas apenas, con filtro y vibrato.
      for (const n of notes) {
        const f = noteToFreq(n);
        const common = { start, dur, vol, attack: 0.02, release: 0.05, hold: true, filter: { type: 'lowpass' as BiquadFilterType, freq: 2100, q: 0.7 } };
        tone(s, { ...common, type: 'sawtooth', freq: f, detune: -7, vibrato: dur > 0.3 ? { rate: 5.5, depth: f * 0.008, delay: 0.18 } : undefined });
        tone(s, { ...common, type: 'sawtooth', freq: f, detune: 7, vol: vol * 0.8 });
        tone(s, { ...common, type: 'square', freq: f / 2, vol: vol * 0.25 });
      }
      break;
    case 'bass':
      for (const n of notes) {
        const f = noteToFreq(n);
        tone(s, { type: 'square', freq: f, start, dur: Math.min(dur, 0.5), vol, attack: 0.004, filter: { type: 'lowpass', freq: 700, q: 1.2 } });
        tone(s, { type: 'sine', freq: f, start, dur: Math.min(dur, 0.5), vol: vol * 0.8, attack: 0.004 });
      }
      break;
    case 'chord':
      for (const n of notes) {
        tone(s, { type: 'square', freq: noteToFreq(n), start, dur: Math.min(dur, 0.11), vol, attack: 0.003, filter: { type: 'lowpass', freq: 2600 } });
      }
      break;
    case 'hat':
      noise(s, { start, dur: 0.035, vol, filter: 'highpass', freq: 7000 });
      break;
    case 'snare':
      noise(s, { start, dur: 0.1, vol, filter: 'bandpass', freq: 1900, q: 0.9 });
      tone(s, { type: 'triangle', freq: 190, to: 120, start, dur: 0.07, vol: vol * 0.6 });
      break;
  }
}
