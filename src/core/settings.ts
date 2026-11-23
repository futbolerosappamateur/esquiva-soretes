import { loadJSON, saveJSON } from './storage';

export interface Settings {
  /** Efectos de sonido activados. */
  sfx: boolean;
  /** Música activada. */
  music: boolean;
  /** Volumen general entre 0 y 1. */
  volume: number;
  /** Ya se mostró el aviso de saltar con X cuando el teclado no toma el espacio en diagonal. */
  diagonalJumpTip: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  music: true,
  volume: 0.7,
  diagonalJumpTip: false,
};

type Listener = (settings: Readonly<Settings>) => void;

/** Preferencias del jugador, persistidas automáticamente en LocalStorage. */
class SettingsStore {
  private data: Settings;
  private listeners = new Set<Listener>();

  constructor() {
    this.data = loadJSON('settings', DEFAULT_SETTINGS);
    this.data.volume = clampVolume(this.data.volume);
  }

  get(): Readonly<Settings> {
    return this.data;
  }

  set(patch: Partial<Settings>): void {
    this.data = { ...this.data, ...patch };
    this.data.volume = clampVolume(this.data.volume);
    saveJSON('settings', this.data);
    this.listeners.forEach((l) => l(this.data));
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_SETTINGS.volume;
  return Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;
}

export const settings = new SettingsStore();
