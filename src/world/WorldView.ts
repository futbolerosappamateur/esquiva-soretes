import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../config/constants';
import { ENVIRONMENTS, type EnvironmentDef } from '../data/environments';
import { Npc } from '../entities/Npc';
import { Pigeon } from '../entities/Pigeon';
import { multiplyColor } from '../graphics/color';
import { FX_FRAMES, TEX } from '../graphics/keys';
import { ensureCornerSign } from '../graphics/textures/propTextures';
import { CROSS_STREET_WIDTH } from './LevelGenerator';
import { PROP_DEFS, type LevelLayout, type PropPlacement } from './LevelLayout';

interface Cullable {
  obj: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
}

interface LampLight {
  head: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image;
  x: number;
  flicker: boolean;
  phase: number;
  base: number;
}

interface FallingLeaf {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  sway: number;
  phase: number;
}

export interface WorldViewOptions {
  env?: EnvironmentDef;
}

/**
 * Construye y actualiza la parte visual de un nivel: capas de parallax,
 * fachadas, vereda, calle, esquinas, decoración y ambientación (día, noche,
 * otoño...). No tiene lógica de juego: sólo dibuja lo que describe el LevelLayout.
 */
export class WorldView {
  readonly env: EnvironmentDef;
  private readonly clouds: Phaser.GameObjects.TileSprite;
  private readonly skyline: Phaser.GameObjects.TileSprite;
  private readonly groundLayers: Phaser.GameObjects.TileSprite[] = [];
  private readonly cullables: Cullable[] = [];
  private readonly pigeons: Pigeon[] = [];
  private readonly npcs: Npc[] = [];
  private readonly lamps: LampLight[] = [];
  private readonly leaves: FallingLeaf[] = [];
  private cloudDrift = 0;
  private clock = 0;
  /** Se llama cuando una paloma se espanta (para el sonido). */
  onPigeonScared?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    layout: LevelLayout,
    opts: WorldViewOptions = {},
  ) {
    const env = (this.env = opts.env ?? ENVIRONMENTS.day);
    const worldTint = env.worldTint;
    const skyKey = env.sky === 'night' ? TEX.skyNight : env.sky === 'dusk' ? TEX.skyDusk : env.sky === 'overcast' ? TEX.skyOvercast : TEX.sky;
    scene.add.image(0, 0, scene.textures.exists(skyKey) ? skyKey : TEX.sky).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);
    this.clouds = scene.add.tileSprite(0, 4, GAME_WIDTH, 64, TEX.clouds).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.clouds);
    this.clouds.setAlpha(env.cloudAlpha);
    if (env.sky === 'night') this.clouds.setTint(0x50557a);
    else if (env.sky === 'overcast') this.clouds.setTint(0xb8bec8);
    const skylineKey = env.nightFacades && scene.textures.exists(TEX.skylineNight) ? TEX.skylineNight : TEX.skyline;
    this.skyline = scene.add
      .tileSprite(0, LAYOUT.facadeBaseY + 6 - 128, GAME_WIDTH, 128, skylineKey)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.skyline);
    if (env.sky === 'dusk') this.skyline.setTint(0xe8d2c8);

    const ground = (y: number, h: number, key: string, depth: number) => {
      const ts = scene.add.tileSprite(0, y, GAME_WIDTH, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth).setTint(worldTint);
      this.groundLayers.push(ts);
      return ts;
    };
    ground(LAYOUT.sidewalkTop, LAYOUT.sidewalkBottom - LAYOUT.sidewalkTop, TEX.sidewalk, DEPTH.ground);
    ground(LAYOUT.sidewalkTop, 8, TEX.wallShadow, DEPTH.groundOverlay);
    ground(LAYOUT.curbTop, LAYOUT.curbHeight, TEX.curb, DEPTH.ground);
    ground(LAYOUT.streetTop, GAME_HEIGHT - LAYOUT.streetTop, TEX.street, DEPTH.ground);
    ground(LAYOUT.streetTop, 6, TEX.wallShadow, DEPTH.groundOverlay);

    for (const f of layout.facades) {
      const nightKey = TEX.facadeNight(f.id);
      const useNight = env.nightFacades && scene.textures.exists(nightKey);
      const img = scene.add.image(f.x, LAYOUT.facadeBaseY, useNight ? nightKey : TEX.facade(f.id)).setOrigin(0, 1).setDepth(DEPTH.facades);
      if (!useNight) img.setTint(worldTint);
      this.track(img, f.x, f.x + f.width);
    }

    // Esquina final: calle transversal decorativa (sin tránsito) y la cuadra siguiente.
    const cross = scene.add
      .image(layout.crossStreetX, LAYOUT.facadeBaseY - 28, TEX.crossStreet)
      .setOrigin(0, 0)
      .setDepth(DEPTH.groundOverlay + 1)
      .setTint(worldTint);
    this.track(cross, layout.crossStreetX, layout.crossStreetX + CROSS_STREET_WIDTH);
    if (layout.finalStreet) this.addCornerSign(layout.crossStreetX - 8, layout.finalStreet);
    for (const c of layout.crossings) this.addCornerSign(c.x0 - 8, c.street);
    const kioskX = layout.crossStreetX + CROSS_STREET_WIDTH + 70;
    const kiosk = scene.add.image(kioskX, LAYOUT.propFrontY, TEX.newsKiosk).setOrigin(0.5, 1).setDepth(LAYOUT.propFrontY).setTint(worldTint);
    this.track(kiosk, kioskX - 24, kioskX + 24);

    for (const p of layout.props) this.addProp(p);

    for (const d of layout.decals) {
      const img = scene.add.image(d.x, d.y, d.texture, d.frame).setDepth(d.depth ?? DEPTH.groundDecal - 1);
      if (d.flip) img.setFlipX(true);
      const tint = d.tint !== undefined ? multiplyColor(d.tint, worldTint) : worldTint;
      if (tint !== 0xffffff) img.setTint(tint);
      this.track(img, d.x - img.width / 2, d.x + img.width / 2);
    }

    for (const c of layout.cars) {
      const key = c.container ? TEX.container : TEX.car(c.variant);
      const img = scene.add.image(c.x, LAYOUT.carBaseY + 4, key).setOrigin(0.5, 1).setDepth(LAYOUT.carBaseY).setFlipX(c.flip).setTint(worldTint);
      this.track(img, c.x - img.width / 2, c.x + img.width / 2);
    }

    for (const p of layout.pigeons) this.pigeons.push(new Pigeon(scene, p.x, p.y));
    for (const n of layout.npcs) this.npcs.push(new Npc(scene, n));
    if (env.actorTint !== 0xffffff) {
      this.pigeons.forEach((p) => p.setTint(env.actorTint));
      this.npcs.forEach((n) => n.setTint(multiplyColor(env.actorTint, 0xc8ccdc)));
    }

    if (env.fallingLeaves) this.createFallingLeaves();

    // Ordenar por x permite cortar el recorrido del recorte temprano.
    this.cullables.sort((a, b) => a.x0 - b.x0);
  }

  private addCornerSign(x: number, street: string): void {
    const key = ensureCornerSign(this.scene.textures, street);
    const sign = this.scene.add.image(x, LAYOUT.propFrontY + 1, key).setOrigin(0.5, 1).setDepth(LAYOUT.propFrontY + 1);
    if (this.env.worldTint !== 0xffffff) sign.setTint(multiplyColor(this.env.worldTint, 0xdde0f0));
    this.track(sign, x - 50, x + 50);
  }

  private treeTexture(variant: number): string {
    const foliage = this.env.foliage;
    const key = foliage === 'autumn' ? TEX.treeAutumn(variant) : foliage === 'bare' ? TEX.treeBare(variant) : TEX.tree(variant);
    return this.scene.textures.exists(key) ? key : TEX.tree(variant);
  }

  private addProp(p: PropPlacement): void {
    const def = PROP_DEFS[p.kind];
    const texture = p.kind === 'tree' ? this.treeTexture(p.variant) : def.texture(p.variant);
    const img = this.scene.add.image(p.x, p.y, texture, def.frame).setOrigin(0.5, def.originY).setDepth(p.y);
    // Los props se tiñen menos que el fondo: son obstáculos y se tienen que ver bien.
    if (this.env.worldTint !== 0xffffff) img.setTint(multiplyColor(this.env.worldTint, 0xffffff, p.kind === 'tree' ? 0.8 : 0.55));
    this.track(img, p.x - img.width / 2, p.x + img.width / 2);
    if (p.kind === 'lamp' && this.env.lampsLit) this.addLampLight(p);
  }

  /** Farol encendido: halo en la farola y charco de luz en la vereda. */
  private addLampLight(p: PropPlacement): void {
    const head = this.scene.add.image(p.x, p.y - 68, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd98a).setScale(1.6).setDepth(p.y + 0.4);
    const pool = this.scene.add.image(p.x, p.y - 22, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffcf7a).setScale(3.4, 1.5).setAlpha(0.5).setDepth(DEPTH.groundDecal);
    const flicker = ((p.x * 7919) % 100) / 100 < this.env.flickerRatio;
    this.lamps.push({ head, pool, x: p.x, flicker, phase: (p.x % 97) / 15, base: 0.9 });
    this.track(head, p.x - 30, p.x + 30);
    this.track(pool, p.x - 60, p.x + 60);
  }

  private createFallingLeaves(): void {
    const tints = [0xd9822b, 0xe3a13a, 0xb35a24, 0xd9b14a];
    for (let i = 0; i < 14; i++) {
      const sprite = this.scene.add
        .image(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, TEX.fx, FX_FRAMES.leaf)
        .setScrollFactor(0)
        .setDepth(DEPTH.effects - 5)
        .setTint(tints[i % tints.length])
        .setAlpha(0.9);
      this.leaves.push({ sprite, vx: -6 - Math.random() * 10, vy: 9 + Math.random() * 10, sway: 6 + Math.random() * 8, phase: Math.random() * 6 });
    }
  }

  private track(obj: Phaser.GameObjects.Image, x0: number, x1: number): void {
    this.cullables.push({ obj, x0, x1 });
  }

  update(dt: number, scrollX: number, threatX: number, threatY: number): void {
    this.clock += dt;
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
      n.update(dt);
      n.setVisible(n.posX > left - 60 && n.posX < right + 60);
    }

    // Faroles: los que titilan lo hacen despacio y sin apagarse del todo (nada de destellos).
    for (const l of this.lamps) {
      if (!l.flicker || !l.head.visible) continue;
      const wobble = Math.sin(this.clock * 1.7 + l.phase) * 0.5 + Math.sin(this.clock * 3.1 + l.phase * 2) * 0.5;
      const a = l.base * (0.78 + 0.22 * (wobble * 0.5 + 0.5));
      l.head.setAlpha(a);
      l.pool.setAlpha(a * 0.55);
    }

    for (const leaf of this.leaves) {
      leaf.phase += dt * 2;
      const s = leaf.sprite;
      s.x += (leaf.vx + Math.sin(leaf.phase) * leaf.sway) * dt;
      s.y += leaf.vy * dt;
      s.setAngle(Math.sin(leaf.phase) * 30);
      if (s.y > GAME_HEIGHT + 6) {
        s.y = -6;
        s.x = Math.random() * (GAME_WIDTH + 60);
      }
      if (s.x < -10) s.x = GAME_WIDTH + 10;
    }
  }

  destroy(): void {
    this.pigeons.forEach((p) => p.destroy());
    this.npcs.forEach((n) => n.destroy());
  }
}
