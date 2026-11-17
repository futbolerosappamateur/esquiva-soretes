import Phaser from 'phaser';
import { SCORING } from '../../config/balance';
import type { EffectsSystem } from '../../systems/EffectsSystem';
import { footprintsOverlap } from '../../systems/Collision';
import type { ObstaclePlacement } from '../../world/LevelLayout';
import type { Player } from '../Player';
import { Obstacle } from './Obstacle';

export interface ObstacleEvents {
  /** Pisó algo que ensucia una zapatilla. */
  onHazard: (o: Obstacle) => void;
  /** Pisó algo molesto que resta puntos (baldosa floja). */
  onNuisance: (o: Obstacle) => void;
  /** Superó un sorete sin pisarlo. `closeCall` = pasó por un pelo. */
  onDodge: (o: Obstacle, closeCall: boolean) => void;
}

/**
 * Administra los obstáculos de la cuadra y resuelve las colisiones
 * usando únicamente la huella de los pies del jugador.
 */
export class ObstacleManager {
  readonly list: Obstacle[];
  private cursor = 0;

  constructor(scene: Phaser.Scene, placements: ObstaclePlacement[], effects: EffectsSystem) {
    this.list = [...placements].sort((a, b) => a.x - b.x).map((p) => new Obstacle(scene, p, effects));
  }

  update(player: Player, events: ObstacleEvents): void {
    if (player.state !== 'normal') return;
    const px = player.x;
    const py = player.y;
    const pfp = player.footprint;

    while (this.cursor < this.list.length && this.list[this.cursor].right < px - 120) this.cursor++;

    for (let i = this.cursor; i < this.list.length; i++) {
      const o = this.list[i];
      if (o.x - 20 > px + 40) break;
      if (o.state !== 'active') continue;

      const fp = o.footprint;
      const lowEnough = player.z <= o.def.clearHeight;
      if (lowEnough && footprintsOverlap(px, py, pfp, o.x, o.y, fp)) {
        if (o.def.effect === 'penalty') {
          events.onNuisance(o);
          continue;
        }
        // Si lo pisó siendo invulnerable, no se lo cobra hasta que salga y lo vuelva a pisar.
        if (player.canBeHit && !o.safeContact) {
          events.onHazard(o);
          return;
        }
        o.touchedWhileSafe = true;
        o.safeContact = true;
      } else {
        o.safeContact = false;
      }

      // Distancia mínima mientras las huellas se superponen en x (para el "¡POR UN PELO!").
      if (player.z <= o.def.clearHeight + 4 && Math.abs(px - o.x) < (pfp.w + fp.w) / 2 + 1) {
        const gap = Math.abs(py - o.y) - (pfp.h + fp.h) / 2;
        if (gap < o.closestGap) o.closestGap = gap;
      }

      // Se cuenta UNA sola vez, cuando los pies dejaron atrás todo el sorete.
      if (px - pfp.w / 2 > o.x + fp.w / 2) {
        o.state = 'passed';
        if (o.def.dodgeable && !o.touchedWhileSafe) {
          events.onDodge(o, o.closestGap >= 0 && o.closestGap <= SCORING.closeCallGap);
        }
      }
    }
  }

  /**
   * Al retomar desde un checkpoint, lo que quedó atrás se da por superado
   * sin sumar puntos (ya se contaron en la partida anterior).
   */
  skipBefore(x: number): void {
    for (const o of this.list) if (o.right < x) o.state = 'passed';
  }

  /** Oculta lo que está fuera de cámara (mejor rendimiento en celulares). */
  cull(left: number, right: number): void {
    for (const o of this.list) o.setVisible(o.right > left - 48 && o.left < right + 48);
  }

  destroy(): void {
    this.list.forEach((o) => o.destroy());
  }
}
