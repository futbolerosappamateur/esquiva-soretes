import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../config/constants';
import { Npc } from '../entities/Npc';
import { Pigeon } from '../entities/Pigeon';
import { TEX } from '../graphics/keys';
import { ensureCornerSign } from '../graphics/textures/propTextures';
import { CROSS_STREET_WIDTH } from './LevelGenerator';
import { PROP_DEFS, type LevelLayout, type PropPlacement } from './LevelLayout';

interface Cullable {
  obj: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
}

/**
 * Construye y actualiza la parte visual de una cuadra:
 * capas de parallax, fachadas, vereda, calle y decoración.
 * No tiene lógica de juego: sólo dibuja lo que describe el LevelLayout.
 */
export class WorldView {
  private readonly clouds: Phaser.GameObjects.TileSprite;
  private readonly skyline: Phaser.GameObjects.TileSprite;
  private readonly groundLayers: Phaser.GameObjects.TileSprite[] = [];
  private readonly cullables: Cullable[] = [];
  private readonly pigeons: Pigeon[] = [];
  private readonly npcs: Npc[] = [];
  private cloudDrift = 0;
  /** Se llama cuando una paloma se espanta (para el sonido). */
  onPigeonScared?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: LevelLayout,
    crossStreetName: string | null,
  ) {
    scene.add.image(0, 0, TEX.sky).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);
    this.clouds = scene.add.tileSprite(0, 4, GAME_WIDTH, 64, TEX.clouds).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.clouds);
    this.skyline = scene.add
      .tileSprite(0, LAYOUT.facadeBaseY + 6 - 128, GAME_WIDTH, 128, TEX.skyline)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.skyline);

    const ground = (y: number, h: number, key: string, depth: number) => {
      const ts = scene.add.tileSprite(0, y, GAME_WIDTH, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      this.groundLayers.push(ts);
      return ts;
    };
    ground(LAYOUT.sidewalkTop, LAYOUT.sidewalkBottom - LAYOUT.sidewalkTop, TEX.sidewalk, DEPTH.ground);
    ground(LAYOUT.sidewalkTop, 8, TEX.wallShadow, DEPTH.groundOverlay);
    ground(LAYOUT.curbTop, LAYOUT.curbHeight, TEX.curb, DEPTH.ground);
    ground(LAYOUT.streetTop, GAME_HEIGHT - LAYOUT.streetTop, TEX.street, DEPTH.ground);
    ground(LAYOUT.streetTop, 6, TEX.wallShadow, DEPTH.groundOverlay);

    for (const f of layout.facades) {
      const img = scene.add.image(f.x, LAYOUT.facadeBaseY, TEX.facade(f.id)).setOrigin(0, 1).setDepth(DEPTH.facades);
      this.track(img, f.x, f.x + f.width);
    }

    // Esquina: calle transversal con senda peatonal.
    const cross = scene.add
      .image(layout.crossStreetX, LAYOUT.facadeBaseY - 28, TEX.crossStreet)
      .setOrigin(0, 0)
      .setDepth(DEPTH.groundOverlay + 1);
    this.track(cross, layout.crossStreetX, layout.crossStreetX + CROSS_STREET_WIDTH);
    if (crossStreetName) {
      const key = ensureCornerSign(scene.textures, crossStreetName);
      const sx = layout.crossStreetX - 8;
      const sign = scene.add.image(sx, LAYOUT.propFrontY + 1, key).setOrigin(0.5, 1).setDepth(LAYOUT.propFrontY + 1);
      this.track(sign, sx - 50, sx + 50);
    }
    const kioskX = layout.crossStreetX + CROSS_STREET_WIDTH + 70;
    const kiosk = scene.add.image(kioskX, LAYOUT.propFrontY, TEX.newsKiosk).setOrigin(0.5, 1).setDepth(LAYOUT.propFrontY);
    this.track(kiosk, kioskX - 24, kioskX + 24);

    for (const p of layout.props) this.addProp(p);

    for (const d of layout.decals) {
      const img = scene.add.image(d.x, d.y, d.texture, d.frame).setDepth(d.depth ?? DEPTH.groundDecal - 1);
      if (d.flip) img.setFlipX(true);
      if (d.tint !== undefined) img.setTint(d.tint);
      this.track(img, d.x - img.width / 2, d.x + img.width / 2);
    }

    for (const c of layout.cars) {
      const key = c.container ? TEX.container : TEX.car(c.variant);
      const img = scene.add.image(c.x, LAYOUT.carBaseY + 4, key).setOrigin(0.5, 1).setDepth(LAYOUT.carBaseY).setFlipX(c.flip);
      this.track(img, c.x - img.width / 2, c.x + img.width / 2);
    }

    for (const p of layout.pigeons) this.pigeons.push(new Pigeon(scene, p.x, p.y));
    for (const n of layout.npcs) this.npcs.push(new Npc(scene, n));

    // Ordenar por x permite cortar el recorrido del recorte temprano.
    this.cullables.sort((a, b) => a.x0 - b.x0);
  }

  private addProp(p: PropPlacement): void {
    const def = PROP_DEFS[p.kind];
    const img = this.scene.add.image(p.x, p.y, def.texture(p.variant), def.frame).setOrigin(0.5, def.originY).setDepth(p.y);
    this.track(img, p.x - img.width / 2, p.x + img.width / 2);
  }

  private track(obj: Phaser.GameObjects.Image, x0: number, x1: number): void {
    this.cullables.push({ obj, x0, x1 });
  }

  update(dt: number, scrollX: number, threatX: number, threatY: number): void {
    this.cloudDrift += dt * 4;
    this.clouds.tilePositionX = Math.round(scrollX * 0.08 + this.cloudDrift);
    this.skyline.tilePositionX = Math.round(scrollX * 0.3);
    const sx = Math.round(scrollX);
    for (const layer of this.groundLayers) layer.tilePositionX = sx;

    const left = scrollX - 40;
    const right = scrollX + GAME_WIDTH + 40;
    for (const c of this.cullables) c.obj.setVisible(c.x1 > left && c.x0 < right);

    for (const p of this.pigeons) {
      if (!p.alive) continue;
      p.setVisible(p.posX > left && p.posX < right);
      if (p.update(dt, threatX, threatY)) this.onPigeonScared?.();
    }
    for (const n of this.npcs) {
      n.update(dt, this.layout.worldWidth);
      n.setVisible(n.posX > left - 60 && n.posX < right + 60);
    }
  }

  destroy(): void {
    this.pigeons.forEach((p) => p.destroy());
    this.npcs.forEach((n) => n.destroy());
  }
}
