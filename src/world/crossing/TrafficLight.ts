/**
 * Semáforo de una esquina (vehicular + peatonal sincronizados).
 *
 * Ciclo: verde autos → amarillo → todo rojo → verde peatones → peatones
 * titilando → todo rojo → (vuelve a empezar). Los "todo rojo" dan tiempo a
 * que los autos que ya estaban cruzando despejen la senda peatonal.
 */
export type LightPhase = 'vehGreen' | 'vehYellow' | 'allRed1' | 'pedGreen' | 'pedFlash' | 'allRed2';
export type LightTiming = Record<LightPhase, number>;
export type PedSignal = 'walk' | 'flash' | 'dontWalk';
export type VehSignal = 'green' | 'yellow' | 'red';

export const PHASE_ORDER: LightPhase[] = ['vehGreen', 'vehYellow', 'allRed1', 'pedGreen', 'pedFlash', 'allRed2'];

export class TrafficLight {
  phase: LightPhase;
  elapsed: number;
  /** Segundos que se estiró un "todo rojo" porque la senda no estaba despejada. */
  holdTime = 0;

  constructor(
    readonly timing: LightTiming,
    start: LightPhase = 'vehGreen',
    startElapsed = 0,
  ) {
    this.phase = start;
    this.elapsed = startElapsed;
  }

  duration(phase: LightPhase = this.phase): number {
    return this.timing[phase];
  }

  get cycleLength(): number {
    return PHASE_ORDER.reduce((acc, p) => acc + this.timing[p], 0);
  }

  /**
   * Avanza el reloj. `crosswalkClear` indica si no hay vehículos sobre la senda:
   * el verde peatonal nunca empieza con un auto encima de las rayas.
   * Devuelve la fase nueva si cambió en este paso.
   */
  update(dt: number, crosswalkClear: () => boolean = () => true): LightPhase | null {
    this.elapsed += dt;
    let changed: LightPhase | null = null;
    for (let guard = 0; guard < 8 && this.elapsed >= this.duration(); guard++) {
      if (this.phase === 'allRed1' && !crosswalkClear()) {
        this.holdTime += this.elapsed - this.duration();
        this.elapsed = this.duration();
        break;
      }
      this.elapsed -= this.duration();
      this.phase = PHASE_ORDER[(PHASE_ORDER.indexOf(this.phase) + 1) % PHASE_ORDER.length];
      changed = this.phase;
    }
    return changed;
  }

  /** Fuerza una fase (por ejemplo, para sincronizar con la llegada del jugador). */
  set(phase: LightPhase, elapsed = 0): void {
    this.phase = phase;
    this.elapsed = Math.max(0, Math.min(elapsed, this.duration(phase)));
  }

  get pedestrian(): PedSignal {
    if (this.phase === 'pedGreen') return 'walk';
    if (this.phase === 'pedFlash') return 'flash';
    return 'dontWalk';
  }

  get vehicle(): VehSignal {
    if (this.phase === 'vehGreen') return 'green';
    if (this.phase === 'vehYellow') return 'yellow';
    return 'red';
  }

  get pedestriansMayCross(): boolean {
    return this.phase === 'pedGreen' || this.phase === 'pedFlash';
  }

  get timeLeftInPhase(): number {
    return Math.max(0, this.duration() - this.elapsed);
  }

  /** Segundos hasta que los peatones puedan cruzar (0 si ya pueden). */
  get secondsUntilWalk(): number {
    if (this.pedestriansMayCross) return 0;
    let t = this.timeLeftInPhase;
    let i = PHASE_ORDER.indexOf(this.phase);
    for (let guard = 0; guard < PHASE_ORDER.length; guard++) {
      i = (i + 1) % PHASE_ORDER.length;
      if (PHASE_ORDER[i] === 'pedGreen') return t;
      t += this.timing[PHASE_ORDER[i]];
    }
    return t;
  }

  /** Segundos de cruce permitido que quedan (verde + titilante), 0 si está en rojo. */
  get secondsOfWalkLeft(): number {
    if (this.phase === 'pedGreen') return this.timeLeftInPhase + this.timing.pedFlash;
    if (this.phase === 'pedFlash') return this.timeLeftInPhase;
    return 0;
  }
}
