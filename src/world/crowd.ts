import { CROWD_TUNING } from '../config/balance';
import { footprintsOverlap, type Footprint } from '../systems/Collision';
import type { CrowdPlacement } from './LevelLayout';

/** Algo que la gente esquiva al caminar: un sorete, una baldosa floja, un árbol u otra persona. */
export interface CrowdBlocker {
  x: number;
  y: number;
  fp: Footprint;
}

export interface CrowdPlayer {
  x: number;
  y: number;
  footprint: Footprint;
}

export interface PedestrianStep {
  /** Chocó al pibe en este paso (resta puntos y lo frena). */
  bumped: boolean;
}

/** Cuánto tiempo (s) se queda atenta una persona distraída después de un choque. */
const ALERT_TIME = 2.5;
/** Paso (px) entre las profundidades que prueba para correrse. */
const LANE_STEP = 4;
/** Si no encuentra por dónde pasar durante este tiempo (s), pega la vuelta. */
const STUCK_TURN = 1.6;

/**
 * Lógica pura de una persona que camina por la vereda (sin gráficos, se puede
 * probar sola). Camina derecho por su tramo y da la vuelta en las esquinas.
 * Mira un poco hacia adelante: si viene un sorete, un árbol u otra persona en
 * su camino, se corre de costado (y espera si todavía no puede pasar). Si va
 * atenta, al pibe también lo esquiva; si va con el celular, no lo ve, choca y
 * recién después se corre.
 */
export class Pedestrian {
  x: number;
  y: number;
  dir: 1 | -1;
  /** Profundidad hacia la que se está corriendo. */
  targetY: number;
  readonly footprint: Footprint = CROWD_TUNING.footprint;
  private pause = 0;
  private cooldown = 0;
  private alert = 0;
  private stuck = 0;

  constructor(readonly placement: CrowdPlacement) {
    this.x = placement.x;
    this.y = placement.y;
    this.targetY = placement.y;
    this.dir = placement.dir;
  }

  /** Está caminando (no frenada por un choque ni esperando para pasar). */
  get walking(): boolean {
    return this.pause <= 0 && this.stuck <= 0;
  }

  /** Ve al pibe (para esquivarlo): las atentas siempre; las distraídas, sólo después de chocar. */
  get seesPlayer(): boolean {
    return !this.placement.distracted || this.alert > 0;
  }

  update(dt: number, blockers: readonly CrowdBlocker[], player: CrowdPlayer | null, vulnerable: boolean): PedestrianStep {
    const t = CROWD_TUNING;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.alert = Math.max(0, this.alert - dt);
    let bumped = false;
    if (player && vulnerable && this.cooldown <= 0 && footprintsOverlap(this.x, this.y, this.footprint, player.x, player.y, player.footprint)) {
      bumped = true;
      this.cooldown = t.bumpCooldown;
      this.pause = t.bumpPause;
      this.alert = ALERT_TIME;
    }
    if (this.pause > 0) {
      this.pause -= dt;
      return { bumped };
    }

    // Al pibe lo esquiva y lo respeta sólo si lo ve; si no, se lo lleva puesto (y ahí se frena).
    const others: readonly CrowdBlocker[] = player && this.seesPlayer ? [...blockers, { x: player.x, y: player.y, fp: player.footprint }] : blockers;
    if (this.laneBlocked(this.targetY, others)) this.replan(others);
    // Se corre de costado hacia la profundidad elegida, sin pasar por arriba de nada.
    const dy = this.targetY - this.y;
    if (dy !== 0) {
      const side = t.sideSpeed * dt;
      const nextY = this.y + (Math.abs(dy) <= side ? dy : Math.sign(dy) * side);
      if (this.hitsNew(this.x, nextY, others)) this.replan(others);
      else this.y = nextY;
    }

    // Avanza sólo si no se lleva puesto nada (si arrancó arriba de algo, se puede bajar).
    const nextX = this.x + this.dir * this.placement.speed * dt;
    if (this.hitsNew(nextX, this.y, others)) {
      this.stuck += dt;
      if (this.stuck > STUCK_TURN) this.turn();
    } else {
      this.stuck = 0;
      this.x = nextX;
    }
    if (this.x < this.placement.minX && this.dir < 0) this.turn();
    else if (this.x > this.placement.maxX && this.dir > 0) this.turn();
    return { bumped };
  }

  private turn(): void {
    this.dir = this.dir > 0 ? -1 : 1;
    this.stuck = 0;
    this.targetY = this.y;
  }

  /** Hay algo adelante (dentro de lo que mira) en esa profundidad. */
  laneBlocked(y: number, blockers: readonly CrowdBlocker[]): boolean {
    const t = CROWD_TUNING;
    for (const b of blockers) {
      const ahead = (b.x - this.x) * this.dir;
      const reach = (b.fp.w + this.footprint.w) / 2;
      if (ahead < -reach || ahead > t.lookAhead + reach) continue;
      if (Math.abs(b.y - y) * 2 < b.fp.h + this.footprint.h + t.avoidMargin * 2) return true;
    }
    return false;
  }

  private replan(blockers: readonly CrowdBlocker[]): void {
    const lane = this.freeLane(blockers);
    if (lane !== null) this.targetY = lane;
  }

  /**
   * La profundidad libre más cercana a la que puede correrse sin atravesar
   * nada de lo que tiene al lado (o null si no hay ninguna). Ante la duda,
   * mantiene la derecha: así dos personas que vienen de frente se corren para
   * lados distintos.
   */
  private freeLane(blockers: readonly CrowdBlocker[]): number | null {
    const t = CROWD_TUNING;
    let best: number | null = null;
    let bestK = Infinity;
    // Caminando hacia la derecha de la pantalla, su derecha es hacia la cámara (+y).
    for (const sign of [this.dir, -this.dir]) {
      for (let k = 1; k * LANE_STEP <= t.yMax - t.yMin; k++) {
        const y = this.y + sign * k * LANE_STEP;
        if (y < t.yMin || y > t.yMax || this.hitsNew(this.x, y, blockers)) break;
        if (!this.laneBlocked(y, blockers)) {
          if (k < bestK) {
            best = y;
            bestK = k;
          }
          break;
        }
      }
    }
    return best;
  }

  /** Si en (x, y) chocaría con algo que ahora no está tocando (bajarse de arriba de algo sí se puede). */
  private hitsNew(x: number, y: number, blockers: readonly CrowdBlocker[]): boolean {
    for (const b of blockers) {
      if (Math.abs(b.x - x) > 30) continue;
      if (!footprintsOverlap(x, y, this.footprint, b.x, b.y, b.fp)) continue;
      if (!footprintsOverlap(this.x, this.y, this.footprint, b.x, b.y, b.fp)) return true;
    }
    return false;
  }
}
