import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import type { SfxName } from '../audio/sfx';
import { SFX } from '../audio/sfx';
import { PASSIVE_TUNING } from '../config/balance';
import { DEPTH, LAYOUT } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import type { Ability, AbilityFx, AbilityHost, AbilityWorld, ActivationResult } from '../abilities/Ability';
import { combineMods, createAbility } from '../abilities/abilities';
import { PassiveController } from '../abilities/passives';
import { ABILITIES } from '../data/abilities';
import type { CharacterDef } from '../data/characters';
import type { Obstacle } from '../entities/obstacles/Obstacle';
import type { ObstacleManager } from '../entities/obstacles/ObstacleManager';
import type { Player } from '../entities/Player';
import type { BlockedFn, MotorBounds } from '../entities/PlayerMotor';
import { FX_FRAMES, ICON_FRAMES, TEX } from '../graphics/keys';
import type { InputController } from '../input/InputController';
import type { CrossingSystem } from '../world/crossing/CrossingSystem';
import type { WorldView } from '../world/WorldView';
import type { EffectsSystem } from './EffectsSystem';
import type { MissionSystem } from './PickupSystems';

export interface AbilityRuntimeDeps {
  scene: Phaser.Scene;
  character: CharacterDef;
  player: Player;
  controls: InputController;
  obstacles: ObstacleManager;
  world: WorldView;
  mission: MissionSystem;
  effects: EffectsSystem;
  crossings: CrossingSystem;
  isBlockedBySolid: BlockedFn;
  bounds: () => MotorBounds;
  canAct: () => boolean;
  say: (text: string, color: number) => void;
  onLeavesCleared: (spots: { x: number; y: number }[]) => void;
  seed: number;
}

export interface AbilityHud {
  name: string;
  icon: string;
  charge: number;
  active: boolean;
  ready: boolean;
}

interface Puddle {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  until: number;
}

/**
 * Conecta la habilidad y la pasiva del personaje con el juego: implementa
 * AbilityHost usando los sistemas reales (obstáculos, hojas, basura, cruces,
 * charcos, marcas y efectos visuales). La lógica de cada poder vive en
 * src/abilities; acá sólo está el "cableado".
 */
export class AbilityRuntime implements AbilityHost {
  readonly ability: Ability | null;
  readonly passive: PassiveController;
  readonly world: AbilityWorld;
  readonly fx: AbilityFx;
  private readonly markers = new Map<Obstacle, { img: Phaser.GameObjects.Image; until: number }>();
  private readonly puddles: Puddle[] = [];
  private clock = 0;
  private lines: { color: number; timer: number } | null = null;
  private water: { dir: 1 | -1; timer: number } | null = null;
  private readonly temp: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly d: AbilityRuntimeDeps) {
    this.ability = createAbility(d.character.ability);
    this.passive = new PassiveController(d.character, d.seed);
    d.mission.pickupRadius = this.passive.effects.pickupRadius;
    d.crossings.controllers.forEach((c) => (c.honkDistance = this.passive.effects.honkDistance));
    this.world = this.buildWorld();
    this.fx = this.buildFx();
  }

  // --- AbilityHost --------------------------------------------------------

  get motor() {
    return this.d.player.motor;
  }

  get input() {
    return this.d.controls;
  }

  readonly isBlocked: BlockedFn = (x, y) => this.d.isBlockedBySolid(x, y) || this.vehicleAt(x, y);

  bounds(): MotorBounds {
    return this.d.bounds();
  }

  get canAct(): boolean {
    return this.d.canAct();
  }

  private vehicleAt(x: number, y: number): boolean {
    const fp = this.d.player.footprint;
    return this.d.crossings.controllers.some((c) => x > c.geo.x0 - 20 && x < c.geo.x1 + 20 && c.traffic.findHit(x, y, fp) !== null);
  }

  // --- Uso desde la escena ------------------------------------------------

  tryActivate(): ActivationResult | null {
    if (!this.ability) return null;
    const res = this.ability.tryActivate(this);
    if (res === 'ok') {
      this.d.player.showSpecial(this.ability.id === 'broom' ? 0.6 : 0.35);
    } else if (res === 'cooldown') {
      audio.play('click');
    } else if (res === 'unavailable' && ABILITIES[this.ability.id].usage === 'air') {
      this.d.say('¡SALTÁ PRIMERO!', UI_COLORS.gray);
    }
    return res;
  }

  /** Salto pedido en el aire: lo usa el salto doble. */
  handleAirJump(): boolean {
    return this.ability?.onAirJump(this) ?? false;
  }

  get poopShield(): boolean {
    return this.ability?.poopShield() ?? false;
  }

  get blocksPickups(): boolean {
    return this.ability?.blocksPickups() ?? false;
  }

  hud(): AbilityHud | null {
    const a = this.ability;
    if (!a) return null;
    const info = ABILITIES[a.id];
    return { name: info.name, icon: info.icon, charge: a.charge, active: a.active, ready: a.ready };
  }

  /** Lo llama la escena en cada cuadro de juego activo (no en pausa). */
  update(dt: number): void {
    this.clock += dt;
    const m = this.motor;
    this.ability?.update(dt, this);
    const moving = Math.abs(m.vx) + Math.abs(m.vy) > 20;
    if (this.passive.update(dt, moving)) {
      this.d.say('¡SE ENREDARON LAS CORREAS!', UI_COLORS.orange);
      audio.play('tangle');
    }
    m.mods = combineMods(this.ability?.mods() ?? {}, this.passive.mods());
    this.d.mission.blocked = this.blocksPickups;

    // Pasiva del paseador: los perros "huelen" los soretes escondidos cercanos.
    const detect = this.passive.effects.detectHidden;
    if (detect > 0) {
      for (const o of this.d.obstacles.list) {
        if (o.def.id !== 'camo' || o.state !== 'active' || this.markers.has(o)) continue;
        if (o.x > m.x - 10 && o.x < m.x + detect && Math.abs(o.y - m.y) < detect) this.mark(o, 2.5);
      }
    }
    this.updateMarkers();
    this.updatePuddles();
    this.updateLines(dt);
    this.updateWater(dt);
  }

  /** Corta el poder activo (al pisar un sorete o chocar). */
  interrupt(): void {
    this.ability?.interrupt(this);
  }

  /** Limpia todo (muerte, reinicio, cambio de escena). */
  reset(): void {
    this.ability?.reset(null);
    this.passive.reset();
    this.motor.mods = combineMods();
    this.lines = null;
    this.water = null;
    this.markers.forEach((m) => m.img.destroy());
    this.markers.clear();
  }

  destroy(): void {
    this.reset();
    this.puddles.forEach((p) => p.img.destroy());
    this.puddles.length = 0;
    this.temp.forEach((o) => o.destroy());
    this.temp.length = 0;
  }

  // --- Mundo --------------------------------------------------------------

  private buildWorld(): AbilityWorld {
    return {
      revealHidden: (x0, x1, y0, y1) => {
        let n = 0;
        for (const o of this.d.obstacles.list) {
          if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
          if (o.reveal()) {
            n++;
            this.d.effects.leafBurst(o.x, o.y);
            this.mark(o, 3);
          }
        }
        return n;
      },
      clearLeaves: (x0, x1, y0, y1) => {
        const spots = this.d.world.clearLeavesIn(x0, x1, y0, y1);
        spots.forEach((s) => this.d.effects.leafBurst(s.x, s.y));
        if (spots.length) this.d.onLeavesCleared(spots);
        return spots.length;
      },
      collectTrash: (x0, x1, y0, y1) => this.d.mission.collectIn(x0, x1, y0, y1),
      markHazards: (x0, x1, seconds) => {
        let n = 0;
        for (const o of this.d.obstacles.list) {
          if (o.def.effect !== 'life' || o.state !== 'active' || o.x < x0 || o.x > x1) continue;
          this.mark(o, seconds);
          n++;
        }
        return n;
      },
      addPuddle: (x, y) => {
        const py = Phaser.Math.Clamp(y, LAYOUT.walkMinY + 2, LAYOUT.walkMaxY - 2);
        const img = this.d.scene.add.image(x, py, TEX.icons, ICON_FRAMES.puddle).setDepth(DEPTH.groundDecal + 2).setAlpha(0.85);
        this.puddles.push({ x, y: py, img, until: this.clock + 9 });
      },
      crossingAhead: () => {
        const i = this.d.crossings.zoneIndexAt(this.motor.x);
        if (i < 0) return null;
        const c = this.d.crossings.controllers[i];
        return c.completed ? null : c;
      },
    };
  }

  private mark(o: Obstacle, seconds: number): void {
    const prev = this.markers.get(o);
    if (prev) {
      prev.until = Math.max(prev.until, this.clock + seconds);
      return;
    }
    const img = this.d.scene.add.image(o.x, o.y - 20, TEX.icons, ICON_FRAMES.paw).setDepth(DEPTH.floatingText - 2);
    this.markers.set(o, { img, until: this.clock + seconds });
  }

  private updateMarkers(): void {
    const bob = Math.round(Math.sin(this.clock * 6) * 2);
    for (const [o, m] of this.markers) {
      if (m.until <= this.clock || o.state !== 'active') {
        m.img.destroy();
        this.markers.delete(o);
        continue;
      }
      m.img.setY(o.y - (o.def.id === 'giant' ? 34 : 20) + bob);
    }
  }

  private updatePuddles(): void {
    const m = this.motor;
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      if (p.until <= this.clock) {
        p.img.destroy();
        this.puddles.splice(i, 1);
        continue;
      }
      if (p.until - this.clock < 1.5) p.img.setAlpha(0.85 * ((p.until - this.clock) / 1.5));
      if (m.onGround && Math.abs(p.x - m.x) < 11 && Math.abs(p.y - m.y) < 5) m.slip(PASSIVE_TUNING.puddleSlipTime, PASSIVE_TUNING.puddleSlipDecel);
    }
  }

  // --- Efectos ------------------------------------------------------------

  private buildFx(): AbilityFx {
    const scene = this.d.scene;
    const player = this.d.player;
    return {
      sfx: (name) => {
        if (name in SFX) audio.play(name as SfxName);
      },
      say: (text, color = UI_COLORS.white) => this.d.say(text, color),
      dashTrail: (fx, fy, tx, ty) => {
        const s = player.sprite;
        for (let k = 0; k < 4; k++) {
          const t = k / 4;
          const ghost = scene.add
            .image(fx + (tx - fx) * t, fy + (ty - fy) * t - player.z, s.texture.key, s.frame.name)
            .setOrigin(s.originX, s.originY)
            .setFlipX(s.flipX)
            .setDepth(fy + (ty - fy) * t)
            .setTint(0x9fdcff)
            .setAlpha(0.15 + t * 0.4);
          scene.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
        }
        this.d.effects.dustPuff(fx, fy, 3);
      },
      airPuff: () => {
        this.d.effects.dustPuff(player.x, player.y - player.z + 2, 4);
        const ring = scene.add.ellipse(player.x, player.y - player.z, 18, 6).setStrokeStyle(1, 0xffffff, 0.9).setDepth(player.y);
        scene.tweens.add({ targets: ring, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
      },
      speedLines: (on, color) => {
        this.lines = on ? { color, timer: 0 } : null;
      },
      sweep: (dir) => {
        const m = this.motor;
        for (let k = 0; k < 4; k++) this.d.effects.dustPuff(m.x + dir * (14 + k * 14), m.y + (k % 2 ? 6 : -6), 2);
        const arc = scene.add.arc(m.x + dir * 20, m.y - 8, 26, dir > 0 ? -60 : 120, dir > 0 ? 60 : 240, false).setStrokeStyle(2, 0xfff4d6, 0.9).setDepth(m.y + 1);
        scene.tweens.add({ targets: arc, alpha: 0, duration: 300, onComplete: () => arc.destroy() });
      },
      water: (dir, on) => {
        this.water = on ? { dir, timer: 0 } : null;
      },
      whistle: () => {
        this.d.effects.popup(player.x, player.y - 56, '¡PRRRIIIP!', UI_COLORS.white);
        for (let k = 0; k < 3; k++) {
          const ring = scene.add.circle(player.x + 6, player.y - 34, 6).setStrokeStyle(1, 0xffffff, 0.8).setDepth(DEPTH.effects);
          scene.tweens.add({ targets: ring, scale: 4, alpha: 0, delay: k * 120, duration: 420, onComplete: () => ring.destroy() });
        }
      },
      sniff: () => {
        this.d.effects.popup(player.x - 16, player.y - 30, '¡GUAU!', UI_COLORS.orange);
      },
    };
  }

  private updateLines(dt: number): void {
    if (!this.lines) return;
    this.lines.timer -= dt;
    if (this.lines.timer > 0) return;
    this.lines.timer = 0.045;
    const p = this.d.player;
    const back = -p.facing;
    const y = p.y - p.z - 6 - Math.random() * 26;
    const line = this.d.scene.add.rectangle(p.x + back * (6 + Math.random() * 8), y, 10 + Math.random() * 8, 1, this.lines.color, 0.9).setDepth(p.y - 0.2);
    this.d.scene.tweens.add({ targets: line, x: line.x + back * 26, alpha: 0, duration: 220, onComplete: () => line.destroy() });
  }

  private updateWater(dt: number): void {
    if (!this.water) return;
    this.water.timer -= dt;
    if (this.water.timer > 0) return;
    this.water.timer = 0.03;
    const p = this.d.player;
    const dir = this.water.dir;
    const drop = this.d.scene.add
      .image(p.x + dir * 12, p.y - p.z - 22, TEX.fx, FX_FRAMES.drop)
      .setTint(0x8fd6ff)
      .setDepth(p.y + 1);
    this.d.scene.tweens.add({
      targets: drop,
      x: drop.x + dir * (60 + Math.random() * 40),
      y: p.y + (Math.random() * 2 - 1) * 10,
      alpha: 0.2,
      duration: 360,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy(),
    });
  }
}
