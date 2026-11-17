import type { AbilityId } from '../data/abilities';
import type { BlockedFn, MotorBounds, MotorMods, PlayerMotor } from '../entities/PlayerMotor';

/**
 * Sistema general de habilidades especiales.
 *
 * Una habilidad pasa por tres fases: lista → activa → en recarga → lista.
 * No conoce Phaser: actúa sobre el juego a través de AbilityHost (que la
 * escena implementa y las pruebas simulan). Las duraciones y recargas
 * avanzan con el tiempo de juego activo (update sólo corre sin pausa).
 */
export type AbilityPhase = 'ready' | 'active' | 'cooldown';
export type ActivationResult = 'ok' | 'active' | 'cooldown' | 'busy' | 'unavailable';

/** Lo que las habilidades pueden hacer sobre el mundo. */
export interface AbilityWorld {
  /** Destapa soretes escondidos bajo hojas dentro del rectángulo. Devuelve cuántos. */
  revealHidden(x0: number, x1: number, y0: number, y1: number): number;
  /** Corre montones de hojas dentro del rectángulo. Devuelve cuántos. */
  clearLeaves(x0: number, x1: number, y0: number, y1: number): number;
  /** Junta basura de la misión dentro del rectángulo. Devuelve cuántas piezas. */
  collectTrash(x0: number, x1: number, y0: number, y1: number): number;
  /** Marca los soretes entre x0 y x1 durante `seconds`. Devuelve cuántos. */
  markHazards(x0: number, x1: number, seconds: number): number;
  addPuddle(x: number, y: number): void;
  /** Cruce en cuya esquina está el jugador (o null si no hay ninguno cerca). */
  crossingAhead(): { forceWalk(seconds: number): boolean } | null;
}

/** Efectos visuales y sonoros (en las pruebas no hacen nada). */
export interface AbilityFx {
  sfx(name: string): void;
  say(text: string, color?: number): void;
  dashTrail(fromX: number, fromY: number, toX: number, toY: number): void;
  airPuff(): void;
  speedLines(on: boolean, color: number): void;
  sweep(dir: 1 | -1): void;
  water(dir: 1 | -1, on: boolean): void;
  whistle(): void;
  sniff(count: number): void;
}

export interface AbilityHost {
  readonly motor: PlayerMotor;
  readonly input: { readonly moveX: number; readonly moveY: number };
  /** Sólidos y vehículos: el esquive no los atraviesa. */
  readonly isBlocked: BlockedFn;
  bounds(): MotorBounds;
  /** El jugador tiene el control (no está tropezando ni festejando). */
  readonly canAct: boolean;
  readonly world: AbilityWorld;
  readonly fx: AbilityFx;
}

export abstract class Ability {
  phase: AbilityPhase = 'ready';
  activeLeft = 0;
  cooldownLeft = 0;

  constructor(
    readonly id: AbilityId,
    readonly cooldown: number,
    readonly duration: number,
  ) {}

  get ready(): boolean {
    return this.phase === 'ready';
  }

  get active(): boolean {
    return this.phase === 'active';
  }

  /** Progreso de la recarga: 1 = lista, 0 = recién usada. */
  get charge(): number {
    if (this.phase === 'ready') return 1;
    if (this.phase === 'active') return 0;
    return this.cooldown > 0 ? 1 - this.cooldownLeft / this.cooldown : 1;
  }

  tryActivate(host: AbilityHost): ActivationResult {
    if (this.phase === 'active') return 'active';
    if (this.phase === 'cooldown') return 'cooldown';
    if (!host.canAct) return 'busy';
    if (!this.onActivate(host)) return 'unavailable';
    if (this.duration > 0) {
      this.phase = 'active';
      this.activeLeft = this.duration;
    } else {
      this.startCooldown();
    }
    return 'ok';
  }

  update(dt: number, host: AbilityHost): void {
    if (this.phase === 'active') {
      this.activeLeft -= dt;
      this.onActiveUpdate(dt, host);
      if (this.activeLeft <= 0) {
        this.activeLeft = 0;
        this.onEnd(host);
        this.startCooldown();
      }
    } else if (this.phase === 'cooldown') {
      this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
      this.onCooldownUpdate(dt);
      if (this.cooldownLeft <= 0) this.phase = 'ready';
    }
  }

  protected startCooldown(): void {
    this.phase = 'cooldown';
    this.cooldownLeft = this.cooldown;
  }

  /** Corta el efecto (por ejemplo al pisar un sorete o chocar) y entra en recarga. */
  interrupt(host: AbilityHost | null): void {
    if (this.phase !== 'active') return;
    this.onEnd(host);
    this.startCooldown();
  }

  /** Limpia todos los efectos y deja la habilidad lista (morir, reiniciar, cambiar de escena). */
  reset(host: AbilityHost | null): void {
    if (this.phase === 'active') this.onEnd(host);
    this.phase = 'ready';
    this.activeLeft = 0;
    this.cooldownLeft = 0;
    this.onReset();
  }

  /** Modificadores de movimiento mientras dura (o mientras se recarga, si corresponde). */
  mods(): Partial<MotorMods> {
    return {};
  }

  /** Protección contra soretes (el esquive). */
  poopShield(): boolean {
    return false;
  }

  /** No puede juntar monedas ni objetos (sprint). */
  blocksPickups(): boolean {
    return false;
  }

  /** Salto pedido en el aire: devuelve true si la habilidad lo aprovecha (salto doble). */
  onAirJump(_host: AbilityHost): boolean {
    return false;
  }

  /** Devuelve false si no se puede usar ahora (no consume la recarga). */
  protected abstract onActivate(host: AbilityHost): boolean;
  protected onActiveUpdate(_dt: number, _host: AbilityHost): void {}
  protected onEnd(_host: AbilityHost | null): void {}
  protected onCooldownUpdate(_dt: number): void {}
  protected onReset(): void {}
}
