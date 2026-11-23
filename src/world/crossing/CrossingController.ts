import { CROSSING_TUNING } from '../../config/balance';
import { LAYOUT } from '../../config/constants';
import { clamp } from '../../core/math';
import { RNG } from '../../core/rng';
import { VEHICLE_TYPES, type VehicleType } from '../../data/vehicles';
import type { Footprint } from '../../systems/Collision';
import { TrafficLight, type LightPhase, type LightTiming } from './TrafficLight';
import { TrafficSim, type Vehicle } from './TrafficSim';

/** Geometría de una esquina con cruce (coordenadas de mundo). */
export interface CrossingGeometry {
  /** Comienzo y final de toda la esquina (ochava + calzada + ochava). */
  x0: number;
  x1: number;
  /** Bordes de la calzada (entre los dos cordones). */
  roadX0: number;
  roadX1: number;
  laneXs: number[];
  dir: 1 | -1;
}

export interface CrossingSettings {
  timing: LightTiming;
  /** Multiplicador de tránsito (nivel × ambientación). */
  density: number;
  seed: number;
  vehicleTypes?: VehicleType[];
}

export interface CrossingPlayer {
  x: number;
  y: number;
  footprint: Footprint;
  canBeHit: boolean;
  /** El jugador tiene el control (no está en medio de una animación). */
  active: boolean;
}

export interface CrossingEvents {
  hit: Vehicle | null;
  /** Primer paso sobre la calzada en este intento. */
  enteredRoad: boolean;
  /** Se metió en la calle con el semáforo peatonal en rojo. */
  enteredOnRed: boolean;
  /** Llegó a la vereda de enfrente (una sola vez por cruce). */
  crossed: { green: boolean; clean: boolean } | null;
  honk: Vehicle | null;
  phaseChanged: LightPhase | null;
}

/** Franja de la senda peatonal: toda la zona caminable más un margen. */
export const CROSSWALK_Y0 = LAYOUT.walkMinY - 4;
export const CROSSWALK_Y1 = LAYOUT.walkMaxY + 4;
/** Los vehículos aparecen/desaparecen fuera de cámara (arriba entre los edificios, abajo de la pantalla). */
export const TRAFFIC_FAR_Y = 52;
export const TRAFFIC_NEAR_Y = 340;

/**
 * Lógica de un cruce peatonal: semáforo, tránsito, choques y premios.
 * No dibuja nada (la vista está en CrossingView) y se puede probar sin Phaser.
 */
export class CrossingController {
  readonly light: TrafficLight;
  readonly traffic: TrafficSim;
  /** El jugador ya se acercó: el semáforo quedó sincronizado con su llegada. */
  activated = false;
  /** Distancia de la bocina de aviso (el policía la oye antes). */
  honkDistance = CROSSING_TUNING.honkDistance;
  private onRoad = false;
  private walkedOnRed = false;
  private hitThisCrossing = false;
  private crossedAwarded = false;

  constructor(
    readonly geo: CrossingGeometry,
    settings: CrossingSettings,
  ) {
    this.light = new TrafficLight(settings.timing, 'vehGreen', 0);
    const rng = new RNG(settings.seed);
    const t = CROSSING_TUNING;
    this.traffic = new TrafficSim(
      {
        laneXs: geo.laneXs,
        dir: geo.dir,
        crosswalkY0: CROSSWALK_Y0,
        crosswalkY1: CROSSWALK_Y1,
        stopMargin: t.stopMargin,
        spawnY: geo.dir === 1 ? TRAFFIC_FAR_Y : TRAFFIC_NEAR_Y,
        despawnY: geo.dir === 1 ? TRAFFIC_NEAR_Y : TRAFFIC_FAR_Y,
      },
      {
        accel: t.accel,
        decel: t.decel,
        minGap: t.minGap,
        headway: t.headway,
        spawnInterval: t.spawnInterval,
        maxPerLane: t.maxPerLane,
        density: settings.density,
        types: settings.vehicleTypes ?? VEHICLE_TYPES,
      },
      rng,
    );
  }

  get completed(): boolean {
    return this.crossedAwarded;
  }

  get playerOnRoad(): boolean {
    return this.onRoad;
  }

  /** Simula unos segundos para que, al llegar, ya haya autos circulando. */
  prewarm(seconds: number, step = 1 / 30): void {
    for (let t = 0; t < seconds; t += step) this.traffic.update(step, 'green');
  }

  /**
   * El jugador está llegando: se sincroniza el semáforo para que vea pasar
   * algunos autos y enseguida le toque el verde (espera corta, ritmo arcade).
   */
  activate(greenForCarsLeft = 2.4): void {
    if (this.activated) return;
    this.activated = true;
    this.light.set('vehGreen', Math.max(0, this.light.duration('vehGreen') - greenForCarsLeft));
  }

  /** Silbatazo del policía: sólo sirve si todavía no cruzó esta esquina. */
  forceWalk(seconds: number): boolean {
    if (this.crossedAwarded) return false;
    this.activated = true;
    return this.light.forceWalk(seconds);
  }

  isOnRoad(x: number, fp: Footprint): boolean {
    return x + fp.w / 2 > this.geo.roadX0 + 1 && x - fp.w / 2 < this.geo.roadX1 - 1;
  }

  /** Lugar seguro donde reaparecer: la ochava de este lado, antes del cordón. */
  safeSpot(y: number): { x: number; y: number } {
    return { x: this.geo.roadX0 - 12, y: clamp(y, LAYOUT.walkMinY + 6, LAYOUT.walkMaxY - 6) };
  }

  /** Después de reaparecer se puede volver a intentar el cruce en verde. */
  onRespawn(): void {
    this.onRoad = false;
    this.walkedOnRed = false;
  }

  update(dt: number, player: CrossingPlayer): CrossingEvents {
    const events: CrossingEvents = { hit: null, enteredRoad: false, enteredOnRed: false, crossed: null, honk: null, phaseChanged: null };
    events.phaseChanged = this.light.update(dt, () => !this.traffic.occupiesCrosswalk());
    this.traffic.update(dt, this.light.vehicle);

    const fp = player.footprint;
    const nowOnRoad = this.isOnRoad(player.x, fp);
    if (nowOnRoad && !this.onRoad) {
      events.enteredRoad = true;
      if (!this.light.pedestriansMayCross) events.enteredOnRed = true;
    }
    this.onRoad = nowOnRoad;
    if (nowOnRoad && !this.light.pedestriansMayCross) this.walkedOnRed = true;

    if (nowOnRoad && player.active) {
      if (player.canBeHit) {
        const v = this.traffic.findHit(player.x, player.y, fp);
        if (v) {
          events.hit = v;
          this.hitThisCrossing = true;
        }
      }
      if (!events.hit) events.honk = this.findHonk(player.x, player.y);
    }

    if (!this.crossedAwarded && player.active && player.x - fp.w / 2 > this.geo.roadX1 + 2) {
      this.crossedAwarded = true;
      events.crossed = { green: !this.walkedOnRed, clean: !this.hitThisCrossing };
    }
    return events;
  }

  /** Un auto que viene hacia el jugador por su carril toca bocina (aviso de peligro). */
  private findHonk(px: number, py: number): Vehicle | null {
    const lane = this.traffic.laneAt(px);
    if (lane < 0) return null;
    const ps = this.geo.dir * py;
    for (const v of this.traffic.vehicles) {
      if (v.lane !== lane || v.honkCooldown > 0) continue;
      const ahead = ps - v.s;
      if (ahead > 0 && ahead < this.honkDistance && v.speed > 20) {
        v.honkCooldown = 1.4;
        return v;
      }
    }
    return null;
  }
}
