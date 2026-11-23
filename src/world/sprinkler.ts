import { WATER_TUNING } from '../config/balance';
import { LAYOUT } from '../config/constants';

export type SprinklerPhase = 'idle' | 'telegraph' | 'spray';

export interface SprinklerPlayer {
  x: number;
  y: number;
  z: number;
}

export interface SprinklerStep {
  phase: SprinklerPhase;
  /** Cambió de fase en este paso. */
  changed: boolean;
  /** Mojó al jugador (le resta puntos y lo frena). */
  hit: boolean;
  /** Le tiró agua a alguien inmune (sólo para mostrar una frase). */
  splashedImmune: boolean;
  /** El jugador pasó de largo sin mojarse con el chorro activo cerca: cuenta como esquivado. */
  dodged: boolean;
}

export interface SprinklerZone {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Lógica pura de la vecina que riega (sin gráficos, se puede probar sola).
 * Cicla quieta → aviso → chorro. El chorro moja una franja que va desde las
 * fachadas hasta una profundidad que cambia en cada ciclo, sin llegar nunca
 * al carril del cordón. Cada vecina cuenta como "esquivada" una sola vez.
 */
export class Sprinkler {
  phase: SprinklerPhase = 'idle';
  /** Ya quedó atrás (no vuelve a contar). */
  passed = false;
  private t: number;
  private cycle = 0;
  private wet = false;
  private sprayedNear = false;
  private hitCooldown = 0;

  constructor(
    readonly x: number,
    readonly y: number,
    offset = 0,
    startX = Number.NEGATIVE_INFINITY,
  ) {
    this.t = Math.max(0, offset) % this.duration('idle');
    // Si la partida arranca más adelante (checkpoint), esta vecina ya no cuenta.
    if (x + WATER_TUNING.halfWidth < startX) this.passed = true;
  }

  private duration(phase: SprinklerPhase): number {
    return phase === 'idle' ? WATER_TUNING.idle : phase === 'telegraph' ? WATER_TUNING.telegraph : WATER_TUNING.spray;
  }

  /** Avance (0..1) de la fase actual. */
  get progress(): number {
    return Math.min(1, this.t / this.duration(this.phase));
  }

  /** Fracción de la vereda que alcanza el chorro de este ciclo. */
  get reachFraction(): number {
    const r = WATER_TUNING.reaches;
    return r[this.cycle % r.length];
  }

  /** Profundidad máxima (y) que moja este ciclo: nunca invade el carril del cordón. */
  get reachY(): number {
    const max = LAYOUT.walkMaxY - WATER_TUNING.minLane;
    return Math.round(this.y + (max - this.y) * Math.max(0, Math.min(1, this.reachFraction)));
  }

  zone(): SprinklerZone {
    const h = WATER_TUNING.halfWidth;
    return { x0: this.x - h, x1: this.x + h, y0: LAYOUT.walkMinY - 4, y1: this.reachY };
  }

  /** ¿El jugador está dentro de la franja mojada (y a poca altura)? */
  contains(p: SprinklerPlayer): boolean {
    const z = this.zone();
    return p.x >= z.x0 - 3 && p.x <= z.x1 + 3 && p.y >= z.y0 && p.y <= z.y1 + 3 && p.z < WATER_TUNING.hitZ;
  }

  update(dt: number, player: SprinklerPlayer, opts: { vulnerable: boolean; immune: boolean }): SprinklerStep {
    const step: SprinklerStep = { phase: this.phase, changed: false, hit: false, splashedImmune: false, dodged: false };
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.t += Math.max(0, dt);
    while (this.t >= this.duration(this.phase)) {
      this.t -= this.duration(this.phase);
      if (this.phase === 'idle') this.phase = 'telegraph';
      else if (this.phase === 'telegraph') this.phase = 'spray';
      else {
        this.phase = 'idle';
        this.cycle++;
      }
      step.changed = true;
    }
    step.phase = this.phase;

    if (!this.passed && this.phase !== 'idle' && Math.abs(player.x - this.x) < WATER_TUNING.nearDist) this.sprayedNear = true;
    if (!this.passed && this.phase === 'spray' && this.contains(player)) {
      if (opts.immune) {
        if (!this.wet) step.splashedImmune = true;
        this.wet = true;
      } else if (opts.vulnerable && this.hitCooldown <= 0) {
        step.hit = true;
        this.wet = true;
        this.hitCooldown = WATER_TUNING.hitCooldown;
      }
    }
    if (!this.passed && player.x > this.x + WATER_TUNING.halfWidth + 10) {
      this.passed = true;
      step.dodged = this.sprayedNear && !this.wet;
    }
    return step;
  }
}
