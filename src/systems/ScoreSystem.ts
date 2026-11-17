import { PIXELS_PER_METER, SCORING } from '../config/balance';
import type { ScoreSnapshot } from '../core/RunState';

export interface DodgeResult {
  points: number;
  multiplier: number;
  multiplierUp: boolean;
}

/**
 * Puntuación de una cuadra:
 *  - metros recorridos (cuenta la distancia máxima alcanzada, no se puede "farmear"),
 *  - soretes esquivados con multiplicador por racha,
 *  - bonus y penalizaciones.
 */
export class ScoreSystem {
  score: number;
  streak = 0;
  bestStreak = 0;
  multiplier = 1;
  dodged = 0;
  closeCalls = 0;
  hits = 0;
  looseTiles = 0;
  distancePoints = 0;
  dodgePoints = 0;
  bonusPoints = 0;
  penaltyPoints = 0;
  private metersAwarded = 0;
  private comboTimer = 0;

  /** Comodín: los cruces congelan la ventana del combo (esperar el semáforo no corta la racha). */
  comboFrozen = false;

  constructor(initial: number | ScoreSnapshot = 0) {
    if (typeof initial === 'number') {
      this.score = initial;
      return;
    }
    this.score = initial.score;
    this.bestStreak = initial.bestStreak;
    this.dodged = initial.dodged;
    this.closeCalls = initial.closeCalls;
    this.hits = initial.hits;
    this.looseTiles = initial.looseTiles;
    this.distancePoints = initial.distancePoints;
    this.dodgePoints = initial.dodgePoints;
    this.bonusPoints = initial.bonusPoints;
    this.penaltyPoints = initial.penaltyPoints;
    this.metersAwarded = initial.metersAwarded;
  }

  /** Copia del estado para un checkpoint (la racha en curso no se guarda). */
  toSnapshot(): ScoreSnapshot {
    return {
      score: this.score,
      bestStreak: this.bestStreak,
      dodged: this.dodged,
      closeCalls: this.closeCalls,
      hits: this.hits,
      looseTiles: this.looseTiles,
      distancePoints: this.distancePoints,
      dodgePoints: this.dodgePoints,
      bonusPoints: this.bonusPoints,
      penaltyPoints: this.penaltyPoints,
      metersAwarded: this.metersAwarded,
    };
  }

  get meters(): number {
    return this.metersAwarded;
  }

  /** Fracción restante de la ventana del combo (0..1). */
  get comboProgress(): number {
    return this.streak > 0 ? Math.max(0, this.comboTimer / SCORING.comboWindow) : 0;
  }

  /** Suma puntos por los metros nuevos. Devuelve los puntos ganados. */
  updateDistance(distancePx: number): number {
    const meters = Math.floor(Math.max(0, distancePx) / PIXELS_PER_METER);
    if (meters <= this.metersAwarded) return 0;
    const gain = (meters - this.metersAwarded) * SCORING.pointsPerMeter;
    this.metersAwarded = meters;
    this.score += gain;
    this.distancePoints += gain;
    return gain;
  }

  registerDodge(closeCall: boolean): DodgeResult {
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.dodged++;
    if (closeCall) this.closeCalls++;
    this.comboTimer = SCORING.comboWindow;
    const previous = this.multiplier;
    this.multiplier = multiplierFor(this.streak);
    const points = (SCORING.dodgePoints + (closeCall ? SCORING.closeCallBonus : 0)) * this.multiplier;
    this.score += points;
    this.dodgePoints += points;
    return { points, multiplier: this.multiplier, multiplierUp: this.multiplier > previous };
  }

  registerHit(): void {
    this.hits++;
    this.resetCombo();
  }

  /** Resta puntos sin bajar de cero. Devuelve lo que efectivamente se restó. */
  registerPenalty(points: number): number {
    this.looseTiles++;
    const lost = Math.min(this.score, points);
    this.score -= lost;
    this.penaltyPoints += lost;
    return lost;
  }

  addBonus(points: number): void {
    this.score += points;
    this.bonusPoints += points;
  }

  /** Devuelve true si el combo se cortó por tiempo en este cuadro. */
  update(dt: number): boolean {
    if (this.streak === 0 || this.comboFrozen) return false;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.resetCombo();
      return true;
    }
    return false;
  }

  private resetCombo(): void {
    this.streak = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
  }
}

export function multiplierFor(streak: number): number {
  let m = 1;
  for (const level of SCORING.comboLevels) if (streak >= level.streak) m = level.multiplier;
  return m;
}
