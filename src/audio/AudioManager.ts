import { settings } from '../core/settings';
import { Sequencer, TRACKS, type TrackName } from './music';
import { SFX, type SfxName } from './sfx';
import { createNoiseBuffer, type SynthContext } from './synth';

const MUSIC_LEVEL = 0.55;

/**
 * Sistema de audio modular.
 * - El AudioContext se crea/reanuda recién con el primer gesto del usuario
 *   (respeta las políticas de reproducción automática de los navegadores).
 * - Si se pide música antes de ese gesto, queda pendiente y arranca después.
 * - Se suspende cuando la pestaña queda oculta.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sequencer: Sequencer | null = null;
  private currentTrack: TrackName | null = null;
  private desiredTrack: TrackName | null = null;
  private ducked = false;
  private initialized = false;
  private readonly lastPlayed = new Map<SfxName, number>();

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    const unlock = () => this.ensureContext();
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => undefined);
      else void this.ctx.resume().catch(() => undefined);
    });
    settings.onChange(() => this.applySettings());
  }

  get isUnlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  private ensureContext(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = createNoiseBuffer(this.ctx);
      this.applySettings();
    }
    if (this.ctx.state !== 'running' && !document.hidden) {
      void this.ctx
        .resume()
        .then(() => this.syncMusic())
        .catch(() => undefined);
    } else {
      this.syncMusic();
    }
  }

  private applySettings(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const s = settings.get();
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.volume, t, 0.02);
    const musicLevel = s.music ? MUSIC_LEVEL * (this.ducked ? 0.35 : 1) : 0;
    this.musicBus.gain.setTargetAtTime(musicLevel, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx ? 1 : 0, t, 0.02);
    this.syncMusic();
  }

  /** Reproduce un efecto. `param` permite variar el sonido (por ejemplo, la racha). */
  play(name: SfxName, param = 0): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer || this.ctx.state !== 'running') return;
    if (!settings.get().sfx) return;
    // Evita amontonar el mismo sonido en el mismo instante.
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.03) return;
    this.lastPlayed.set(name, now);
    const s: SynthContext = { ctx: this.ctx, out: this.sfxBus, noise: this.noiseBuffer, now: now + 0.005 };
    try {
      SFX[name](s, param);
    } catch {
      // Un efecto fallido nunca debe interrumpir el juego.
    }
  }

  playMusic(track: TrackName): void {
    this.desiredTrack = track;
    this.syncMusic();
  }

  stopMusic(): void {
    this.desiredTrack = null;
    this.syncMusic();
  }

  /** Baja la música (por ejemplo, durante la pausa). */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applySettings();
  }

  private syncMusic(): void {
    const wanted = settings.get().music ? this.desiredTrack : null;
    if (!this.ctx || !this.musicBus || !this.noiseBuffer || this.ctx.state !== 'running') return;
    if (wanted === this.currentTrack && (wanted === null || this.sequencer)) return;
    this.sequencer?.dispose();
    this.sequencer = null;
    this.currentTrack = wanted;
    if (wanted) {
      this.sequencer = new Sequencer(this.ctx, this.musicBus, this.noiseBuffer, TRACKS[wanted]);
      this.sequencer.start();
    }
  }
}

export const audio = new AudioManager();
