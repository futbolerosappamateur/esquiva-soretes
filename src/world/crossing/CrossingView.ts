import Phaser from 'phaser';
import { DEPTH, LAYOUT } from '../../config/constants';
import { vehicleTextureKey } from '../../data/vehicles';
import { TEX } from '../../graphics/keys';
import { CROSSING_TOP_Y, SIGNAL_FRAMES } from '../../graphics/textures/crossingTextures';
import { CROSSWALK_Y0, CROSSWALK_Y1, type CrossingController } from './CrossingController';
import type { Vehicle } from './TrafficSim';

/** Parte de un vehículo que asoma por el fondo (entre los edificios) se recorta acá. */
const FAR_CLIP_Y = CROSSING_TOP_Y + 2;

/**
 * Dibuja un cruce: calzada, línea de frenado, semáforos y vehículos.
 * Sólo lee el estado de CrossingController (no tiene lógica de juego).
 */
export class CrossingView {
  private readonly road: Phaser.GameObjects.Image;
  private readonly stopLine: Phaser.GameObjects.Rectangle;
  private readonly vehSignal: Phaser.GameObjects.Image;
  private readonly pedSignal: Phaser.GameObjects.Image;
  private readonly pedSignalNear: Phaser.GameObjects.Image;
  private readonly poles: Phaser.GameObjects.Image[] = [];
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private visible = true;
  private flashClock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ctl: CrossingController,
    nightLights: boolean,
  ) {
    const g = ctl.geo;
    this.road = scene.add.image(g.x0, CROSSING_TOP_Y, TEX.crossingRoad).setOrigin(0, 0).setDepth(DEPTH.groundOverlay + 1);
    // Línea de frenado del lado por donde llegan los autos.
    const stopY = g.dir === 1 ? CROSSWALK_Y0 - 5 : CROSSWALK_Y1 + 3;
    this.stopLine = scene.add.rectangle(g.roadX0 + 2, stopY, g.roadX1 - g.roadX0 - 4, 2, 0xf2efe6, 0.9).setOrigin(0, 0).setDepth(DEPTH.groundOverlay + 2);

    // Semáforo vehicular en la ochava de este lado; el peatonal, enfrente (mirando al jugador).
    const baseY = LAYOUT.walkMinY - 6;
    const pole = (x: number) => {
      const p = scene.add.image(x, baseY, TEX.signals, SIGNAL_FRAMES.pole).setOrigin(0.5, 1).setDepth(baseY);
      this.poles.push(p);
      return p;
    };
    pole(g.roadX0 - 8);
    pole(g.roadX1 + 8);
    this.vehSignal = scene.add.image(g.roadX0 - 8, baseY - 50, TEX.signals, SIGNAL_FRAMES.vehGreen).setOrigin(0.5, 1).setDepth(baseY + 0.1);
    this.pedSignal = scene.add.image(g.roadX1 + 8, baseY - 50, TEX.signals, SIGNAL_FRAMES.pedStop).setOrigin(0.5, 1).setDepth(baseY + 0.1);
    this.pedSignalNear = scene.add.image(g.roadX0 - 8, baseY - 28, TEX.signals, SIGNAL_FRAMES.pedStop).setOrigin(0.5, 1).setDepth(baseY + 0.1);
    if (nightLights) {
      for (const target of [this.vehSignal, this.pedSignal, this.pedSignalNear]) {
        const glow = scene.add.image(target.x, target.y - target.height / 2, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setDepth(baseY + 0.2).setScale(0.9).setAlpha(0.7);
        this.glows.push(glow);
      }
    }
  }

  get x0(): number {
    return this.ctl.geo.x0;
  }

  get x1(): number {
    return this.ctl.geo.x1;
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    [this.road, this.stopLine, this.vehSignal, this.pedSignal, this.pedSignalNear, ...this.poles, ...this.glows].forEach((o) => o.setVisible(v));
    this.sprites.forEach((s) => s.setVisible(v));
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.flashClock += dt;
    const light = this.ctl.light;
    const veh = light.vehicle;
    this.vehSignal.setFrame(veh === 'green' ? SIGNAL_FRAMES.vehGreen : veh === 'yellow' ? SIGNAL_FRAMES.vehYellow : SIGNAL_FRAMES.vehRed);
    // El titileo es lento y suave (2 veces por segundo, sin destellos fuertes).
    const ped = light.pedestrian;
    const flashOn = Math.floor(this.flashClock * 2.5) % 2 === 0;
    const pedFrame = ped === 'walk' ? SIGNAL_FRAMES.pedWalk : ped === 'flash' ? (flashOn ? SIGNAL_FRAMES.pedWalk : SIGNAL_FRAMES.pedOff) : SIGNAL_FRAMES.pedStop;
    this.pedSignal.setFrame(pedFrame);
    this.pedSignalNear.setFrame(pedFrame);
    if (this.glows.length) {
      const tint = (frame: string) => (frame === SIGNAL_FRAMES.pedWalk || frame === SIGNAL_FRAMES.vehGreen ? 0x6dff9a : frame === SIGNAL_FRAMES.vehYellow ? 0xffcc44 : frame === SIGNAL_FRAMES.pedOff ? 0x222222 : 0xff5a3a);
      this.glows[0].setTint(tint(this.vehSignal.frame.name));
      this.glows[1].setTint(tint(pedFrame));
      this.glows[2].setTint(tint(pedFrame));
    }
    this.syncVehicles();
  }

  private syncVehicles(): void {
    const traffic = this.ctl.traffic;
    const alive = new Set<number>();
    for (const v of traffic.vehicles) {
      alive.add(v.id);
      let sprite = this.sprites.get(v.id);
      if (!sprite) {
        sprite = this.createSprite(v);
        this.sprites.set(v.id, sprite);
      }
      const r = traffic.bodyRect(v);
      const x = traffic.geo.laneXs[v.lane];
      sprite.setPosition(Math.round(x), Math.round(r.y1));
      sprite.setDepth(r.y1);
      // Recorte de la parte que todavía está "detrás" de los edificios del fondo.
      const top = r.y1 - sprite.height;
      const cut = Math.max(0, Math.min(sprite.height, Math.ceil(FAR_CLIP_Y - top)));
      if (cut > 0) sprite.setCrop(0, cut, sprite.width, sprite.height - cut);
      else if (sprite.isCropped) sprite.setCrop();
    }
    for (const [id, sprite] of this.sprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  private createSprite(v: Vehicle): Phaser.GameObjects.Image {
    const facing = this.ctl.geo.dir === 1 ? 'front' : 'rear';
    return this.scene.add.image(0, 0, vehicleTextureKey(v.type.id, facing)).setOrigin(0.5, 1).setVisible(this.visible);
  }

  /** Vehículo dibujado para un id (para efectos: bocina, frenada). */
  spriteOf(id: number): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(id);
  }

  setTint(tint: number): void {
    this.road.setTint(tint);
    this.stopLine.setFillStyle(0xf2efe6, 0.6);
    this.poles.forEach((p) => p.setTint(tint));
  }

  destroy(): void {
    [this.road, this.stopLine, this.vehSignal, this.pedSignal, this.pedSignalNear, ...this.poles, ...this.glows].forEach((o) => o.destroy());
    this.sprites.forEach((s) => s.destroy());
    this.sprites.clear();
  }
}
