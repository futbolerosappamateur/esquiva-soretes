import Phaser from 'phaser';
import { CROSSING_TUNING } from '../../config/balance';
import { GAME_WIDTH } from '../../config/constants';
import type { Footprint } from '../../systems/Collision';
import type { CrossingSegment } from '../LevelLayout';
import { CrossingController, type CrossingEvents } from './CrossingController';
import { CrossingView } from './CrossingView';
import type { PedSignal } from './TrafficLight';

export interface CrossingHandlers {
  onEvents: (crossing: CrossingController, index: number, events: CrossingEvents) => void;
}

export interface CrossingHudInfo {
  index: number;
  signal: PedSignal;
  secondsUntilWalk: number;
  secondsOfWalkLeft: number;
  onRoad: boolean;
}

/**
 * Todos los cruces de un nivel: crea la lógica y la vista de cada esquina,
 * simula sólo los que están cerca de la cámara y sincroniza el semáforo con
 * la llegada del jugador.
 */
export class CrossingSystem {
  readonly controllers: CrossingController[] = [];
  private readonly views: CrossingView[] = [];
  private readonly warmed: boolean[] = [];

  constructor(
    scene: Phaser.Scene,
    segments: CrossingSegment[],
    nightLights: boolean,
    worldTint: number,
    private readonly handlers: CrossingHandlers,
  ) {
    for (const s of segments) {
      const ctl = new CrossingController(
        { x0: s.x0, x1: s.x1, roadX0: s.roadX0, roadX1: s.roadX1, laneXs: s.laneXs, dir: s.dir },
        { timing: CROSSING_TUNING.timing, density: s.density, seed: s.seed },
      );
      this.controllers.push(ctl);
      const view = new CrossingView(scene, ctl, nightLights);
      if (worldTint !== 0xffffff) view.setTint(worldTint);
      this.views.push(view);
      this.warmed.push(false);
    }
  }

  /** Cruce cuya zona de llegada o calzada contiene a x (o -1). */
  zoneIndexAt(x: number): number {
    return this.controllers.findIndex((c) => x > c.geo.x0 - CROSSING_TUNING.approachDistance && x < c.geo.x1 + 8);
  }

  /** Se marca como resuelto un cruce que quedó detrás de un checkpoint. */
  skipBefore(x: number): void {
    this.controllers.forEach((c) => {
      if (c.geo.x1 < x) c.activated = true;
    });
  }

  update(dt: number, player: { x: number; y: number; footprint: Footprint; canBeHit: boolean; active: boolean }, cameraLeft: number): void {
    const left = cameraLeft - GAME_WIDTH;
    const right = cameraLeft + GAME_WIDTH * 2;
    this.controllers.forEach((ctl, i) => {
      const view = this.views[i];
      const near = ctl.geo.x1 > left && ctl.geo.x0 < right;
      view.setVisible(ctl.geo.x1 > cameraLeft - 40 && ctl.geo.x0 < cameraLeft + GAME_WIDTH + 40);
      if (!near) return;
      if (!this.warmed[i]) {
        this.warmed[i] = true;
        ctl.prewarm(7);
      }
      if (!ctl.activated && player.x > ctl.geo.x0 - CROSSING_TUNING.approachDistance) ctl.activate();
      const events = ctl.update(dt, player);
      view.update(dt);
      this.handlers.onEvents(ctl, i, events);
    });
  }

  hudInfo(playerX: number): CrossingHudInfo | null {
    const i = this.zoneIndexAt(playerX);
    if (i < 0) return null;
    const ctl = this.controllers[i];
    if (ctl.completed) return null;
    return {
      index: i,
      signal: ctl.light.pedestrian,
      secondsUntilWalk: ctl.light.secondsUntilWalk,
      secondsOfWalkLeft: ctl.light.secondsOfWalkLeft,
      onRoad: ctl.playerOnRoad,
    };
  }

  viewOf(index: number): CrossingView | undefined {
    return this.views[index];
  }

  destroy(): void {
    this.views.forEach((v) => v.destroy());
  }
}
