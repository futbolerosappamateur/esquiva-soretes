import type { RNG } from '../../core/rng';
import type { VehicleType } from '../../data/vehicles';
import type { Footprint } from '../../systems/Collision';
import type { VehSignal } from './TrafficLight';

/**
 * Tránsito de una calle transversal, sin gráficos.
 *
 * Los vehículos se mueven en el eje de PROFUNDIDAD (y), perpendicular al
 * recorrido del jugador. Internamente se usa una coordenada `s` que crece en
 * el sentido de circulación (s = dir · y): así el mismo código sirve para
 * autos que bajan hacia la cámara o que suben hacia el fondo.
 */
export interface TrafficGeometry {
  laneXs: number[];
  /** +1: vienen del fondo hacia la cámara · -1: van hacia el fondo. */
  dir: 1 | -1;
  /** Franja protegida de la senda peatonal (y mundo). */
  crosswalkY0: number;
  crosswalkY1: number;
  stopMargin: number;
  /** Dónde aparecen y desaparecen (y mundo). */
  spawnY: number;
  despawnY: number;
}

export interface TrafficParams {
  accel: number;
  decel: number;
  minGap: number;
  headway: number;
  spawnInterval: [number, number];
  maxPerLane: number;
  /** Multiplicador de la cantidad de vehículos (1 = normal). */
  density: number;
  types: VehicleType[];
}

export interface Vehicle {
  id: number;
  type: VehicleType;
  lane: number;
  /** Posición del frente, medida en el sentido de circulación. */
  s: number;
  speed: number;
  cruise: number;
  /** Decidió seguir con el amarillo porque ya no llegaba a frenar. */
  committed: boolean;
  /** Ya evaluó el amarillo actual. */
  decided: boolean;
  honkCooldown: number;
}

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export class TrafficSim {
  readonly vehicles: Vehicle[] = [];
  private readonly spawnTimers: number[];
  private nextId = 1;

  constructor(
    readonly geo: TrafficGeometry,
    private readonly params: TrafficParams,
    private readonly rng: RNG,
  ) {
    this.spawnTimers = geo.laneXs.map(() => rng.range(0, params.spawnInterval[1]));
  }

  /** Posición de frenado del frente (antes de la senda). */
  get stopS(): number {
    const g = this.geo;
    return g.dir === 1 ? g.crosswalkY0 - g.stopMargin : -(g.crosswalkY1 + g.stopMargin);
  }

  /** Senda peatonal en coordenadas s. */
  get crosswalkS(): [number, number] {
    const g = this.geo;
    return g.dir === 1 ? [g.crosswalkY0, g.crosswalkY1] : [-g.crosswalkY1, -g.crosswalkY0];
  }

  private get spawnS(): number {
    return this.geo.dir * this.geo.spawnY;
  }

  private get despawnS(): number {
    return this.geo.dir * this.geo.despawnY;
  }

  /** Huella del vehículo en el piso (coordenadas de mundo). */
  bodyRect(v: Vehicle): Rect {
    const x = this.geo.laneXs[v.lane];
    const half = v.type.width / 2;
    const frontY = this.geo.dir * v.s;
    const rearY = frontY - this.geo.dir * v.type.length;
    return { x0: x - half, x1: x + half, y0: Math.min(frontY, rearY), y1: Math.max(frontY, rearY) };
  }

  /** ¿Hay algún vehículo encima de la senda peatonal? */
  occupiesCrosswalk(): boolean {
    const [c0, c1] = this.crosswalkS;
    return this.vehicles.some((v) => v.s > c0 && v.s - v.type.length < c1);
  }

  /** Vehículo que toca la huella del jugador (o null). */
  findHit(px: number, py: number, fp: Footprint): Vehicle | null {
    const hw = fp.w / 2;
    const hh = fp.h / 2;
    for (const v of this.vehicles) {
      const r = this.bodyRect(v);
      if (px + hw > r.x0 && px - hw < r.x1 && py + hh > r.y0 && py - hh < r.y1) return v;
    }
    return null;
  }

  /** Carril (índice) que ocupa una x, o -1. */
  laneAt(x: number): number {
    const types = this.params.types;
    const maxHalf = Math.max(...types.map((t) => t.width)) / 2 + 4;
    let best = -1;
    let bestD = Infinity;
    this.geo.laneXs.forEach((lx, i) => {
      const d = Math.abs(lx - x);
      if (d < maxHalf && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  update(dt: number, signal: VehSignal): void {
    const p = this.params;
    const stopS = this.stopS;
    if (signal === 'green') {
      for (const v of this.vehicles) {
        v.decided = false;
        v.committed = false;
      }
    }

    for (let lane = 0; lane < this.geo.laneXs.length; lane++) {
      const inLane = this.vehicles.filter((v) => v.lane === lane).sort((a, b) => b.s - a.s);
      let leader: Vehicle | null = null;
      for (const v of inLane) {
        v.honkCooldown = Math.max(0, v.honkCooldown - dt);
        let desired = v.cruise;
        if (leader) {
          const gap = leader.s - leader.type.length - v.s;
          desired = Math.min(desired, Math.max(0, (gap - p.minGap) / p.headway));
        }

        const dist = stopS - v.s;
        let mustStop = false;
        if (dist >= -0.5) {
          if (signal === 'yellow' && !v.decided) {
            v.decided = true;
            const brake = (v.speed * v.speed) / (2 * p.decel);
            v.committed = brake > dist + 1;
          }
          if (signal === 'red') mustStop = !v.committed;
          else if (signal === 'yellow') mustStop = !v.committed;
        }
        if (mustStop) desired = Math.min(desired, Math.sqrt(2 * p.decel * Math.max(0, dist - 0.5)));

        if (desired > v.speed) v.speed = Math.min(desired, v.speed + p.accel * dt);
        else v.speed = Math.max(desired, v.speed - p.decel * 2.5 * dt);
        v.s += v.speed * dt;

        // Restricciones duras: nunca pisar la senda en rojo ni atravesar al de adelante.
        if (mustStop && v.s > stopS) {
          v.s = stopS;
          v.speed = 0;
        }
        if (leader) {
          const limit = leader.s - leader.type.length - p.minGap * 0.5;
          if (v.s > limit) {
            v.s = limit;
            v.speed = Math.min(v.speed, leader.speed);
          }
        }
        leader = v;
      }
    }

    // Los que ya salieron de la calle se van.
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.s - v.type.length > this.despawnS) this.vehicles.splice(i, 1);
    }

    // Entrada de vehículos nuevos por cada carril.
    this.spawnTimers.forEach((_, lane) => {
      this.spawnTimers[lane] -= dt;
      if (this.spawnTimers[lane] > 0) return;
      const [a, b] = p.spawnInterval;
      this.spawnTimers[lane] = this.rng.range(a, b) / Math.max(0.2, p.density);
      this.trySpawn(lane);
    });
  }

  private trySpawn(lane: number): void {
    const p = this.params;
    const inLane = this.vehicles.filter((v) => v.lane === lane);
    if (inLane.length >= p.maxPerLane) return;
    const type = this.rng.weighted(p.types.map((t) => ({ item: t, weight: t.weight })));
    const last = inLane.reduce<Vehicle | null>((acc, v) => (acc === null || v.s < acc.s ? v : acc), null);
    const s = this.spawnS;
    if (last && last.s - last.type.length - s < p.minGap + 6) return;
    const cruise = this.rng.range(type.speed[0], type.speed[1]);
    this.vehicles.push({
      id: this.nextId++,
      type,
      lane,
      s,
      speed: last ? Math.min(cruise, last.speed + 20) : cruise,
      cruise,
      committed: false,
      decided: false,
      honkCooldown: 0,
    });
  }

  clear(): void {
    this.vehicles.length = 0;
  }
}
