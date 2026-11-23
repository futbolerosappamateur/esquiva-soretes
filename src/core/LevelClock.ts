/**
 * Cronómetro del nivel. Mide tiempo real transcurrido con un reloj monotónico
 * (performance.now), no cuadros: una caída de FPS no lo hace más lento ni más
 * rápido. Sólo cuenta mientras está en marcha: se pausa con el menú de pausa,
 * al cambiar de pestaña (el juego se pausa solo) y se detiene al terminar.
 */
export class LevelClock {
  private accumulated = 0;
  private startedAt: number | null = null;
  private stopped = false;

  constructor(private readonly now: () => number = () => performance.now()) {}

  get running(): boolean {
    return this.startedAt !== null;
  }

  get finished(): boolean {
    return this.stopped;
  }

  get elapsedMs(): number {
    return this.accumulated + (this.startedAt !== null ? Math.max(0, this.now() - this.startedAt) : 0);
  }

  /** Arranca (o retoma). No hace nada si ya terminó. */
  start(): void {
    if (this.stopped || this.startedAt !== null) return;
    this.startedAt = this.now();
  }

  pause(): void {
    if (this.startedAt === null) return;
    this.accumulated += Math.max(0, this.now() - this.startedAt);
    this.startedAt = null;
  }

  resume(): void {
    this.start();
  }

  /** Detiene definitivamente y devuelve el tiempo final. */
  stop(): number {
    this.pause();
    this.stopped = true;
    return this.accumulated;
  }

  /** Retoma desde un tiempo guardado (reintento desde checkpoint). */
  restore(ms: number): void {
    this.accumulated = Math.max(0, ms);
  }
}

/** 155400 → "02:35.4" (minutos:segundos.décimas). */
export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '--:--.-';
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  const d = tenths % 10;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${d}`;
}

/** Diferencia con signo en segundos: -4200 → "-4.2", 1300 → "+1.3". */
export function formatDelta(ms: number): string {
  const s = Math.round(Math.abs(ms) / 100) / 10;
  return `${ms < 0 ? '-' : '+'}${s.toFixed(1)}`;
}
