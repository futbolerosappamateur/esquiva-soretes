import { CROSSING_TUNING, PASSIVE_TUNING } from '../config/balance';
import { RNG } from '../core/rng';
import type { CharacterDef } from '../data/characters';
import type { MotorMods } from '../entities/PlayerMotor';

/** Efectos pasivos que consultan otros sistemas (misión, cruces, chorros de agua, detección). */
export interface PassiveEffects {
  /** Multiplica el radio para juntar basura. */
  pickupRadius: number;
  /** Los chorros de las vecinas que riegan no le hacen nada. */
  waterImmune: boolean;
  /** Distancia a la que los autos tocan bocina. */
  honkDistance: number;
  /** Distancia a la que se marcan solos los soretes escondidos (0 = no). */
  detectHidden: number;
}

/**
 * Ventajas pasivas y desventajas de cada personaje. Las estadísticas
 * (velocidad, salto, control) ya vienen en CharacterDef.stats; acá están los
 * efectos que no son números de movimiento, como las correas que se enredan.
 * Usa una semilla para que el contrarreloj sea reproducible.
 */
export class PassiveController {
  readonly effects: PassiveEffects;
  private tangleIn = 0;
  private tangleLeft = 0;
  private readonly rng: RNG;

  constructor(
    private readonly def: CharacterDef,
    seed: number,
  ) {
    this.rng = new RNG(seed ^ 0x5bd1e995);
    this.effects = {
      pickupRadius: def.id === 'player_portero' ? PASSIVE_TUNING.porteroPickup : 1,
      waterImmune: def.id === 'player_hose',
      honkDistance: CROSSING_TUNING.honkDistance * (def.id === 'player_police' ? PASSIVE_TUNING.policeHonk : 1),
      detectHidden: def.id === 'player_dogwalker' ? PASSIVE_TUNING.dogDetect : 0,
    };
    this.scheduleTangle();
  }

  private get hasTangles(): boolean {
    return (this.def.dogs ?? 0) > 0;
  }

  private scheduleTangle(): void {
    const [a, b] = PASSIVE_TUNING.tangleEvery;
    this.tangleIn = this.rng.range(a, b);
  }

  /** Devuelve true en el cuadro en que se enredan las correas. */
  update(dt: number, moving: boolean): boolean {
    if (!this.hasTangles) return false;
    if (this.tangleLeft > 0) {
      this.tangleLeft = Math.max(0, this.tangleLeft - dt);
      return false;
    }
    if (!moving) return false;
    this.tangleIn -= dt;
    if (this.tangleIn > 0) return false;
    this.tangleLeft = PASSIVE_TUNING.tangleTime;
    this.scheduleTangle();
    return true;
  }

  get tangled(): boolean {
    return this.tangleLeft > 0;
  }

  mods(): Partial<MotorMods> {
    return this.tangleLeft > 0 ? { speed: PASSIVE_TUNING.tangleSpeed } : {};
  }

  reset(): void {
    this.tangleLeft = 0;
    this.scheduleTangle();
  }
}
