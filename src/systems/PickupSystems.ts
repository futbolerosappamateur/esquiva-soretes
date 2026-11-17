import Phaser from 'phaser';
import { DEPTH, LAYOUT } from '../config/constants';
import { MISSIONS, type MissionDef } from '../data/missions';
import { ANIM } from '../graphics/animations';
import { ICON_FRAMES, TEX } from '../graphics/keys';
import type { CoinPlacement, MissionPlacement } from '../world/LevelLayout';

interface PlayerPos {
  x: number;
  y: number;
  z: number;
}

/**
 * Monedas sueltas en la vereda. Siempre están en lugares alcanzables sin
 * pisar nada (el generador las ubica sobre el camino garantizado).
 */
export class CoinSystem {
  private readonly coins: { x: number; y: number; sprite: Phaser.GameObjects.Sprite; taken: boolean }[] = [];

  constructor(scene: Phaser.Scene, placements: CoinPlacement[], skipBeforeX: number, tint: number) {
    for (const p of placements) {
      const sprite = scene.add.sprite(p.x, p.y - 6, TEX.coin, 'c0').setDepth(p.y + 0.1);
      sprite.play({ key: ANIM.coin, startFrame: (p.x / 16) % 4 | 0 });
      if (tint !== 0xffffff) sprite.setTint(tint);
      const taken = p.x < skipBeforeX;
      sprite.setVisible(!taken);
      this.coins.push({ x: p.x, y: p.y, sprite, taken });
    }
  }

  /** Devuelve cuántas monedas se juntaron en este cuadro (y sus posiciones). */
  update(player: PlayerPos, left: number, right: number): { x: number; y: number }[] {
    const got: { x: number; y: number }[] = [];
    for (const c of this.coins) {
      if (c.taken) continue;
      const onScreen = c.x > left - 20 && c.x < right + 20;
      c.sprite.setVisible(onScreen);
      if (!onScreen) continue;
      if (Math.abs(c.x - player.x) < 9 && Math.abs(c.y - player.y) < 7 && player.z < 26) {
        c.taken = true;
        c.sprite.destroy();
        got.push({ x: c.x, y: c.y });
      }
    }
    return got;
  }

  get remaining(): number {
    return this.coins.filter((c) => !c.taken).length;
  }

  destroy(): void {
    this.coins.forEach((c) => c.sprite.destroy());
  }
}

export type MissionStatus = 'available' | 'active' | 'done' | 'missed';

export interface MissionEvents {
  onPickup?: (collected: number, required: number) => void;
  onDelivered?: (def: MissionDef) => void;
}

/**
 * Misión "juntá la basura y llevala al tacho". La ofrece el portero; los
 * residuos están siempre en lugares alcanzables y el tacho es un cesto junto
 * al cordón antes de la esquina.
 */
export class MissionSystem {
  readonly def: MissionDef | null;
  status: MissionStatus = 'available';
  collected = 0;
  private readonly items: { x: number; y: number; sprite: Phaser.GameObjects.Image; taken: boolean }[] = [];
  private readonly targetArrow?: Phaser.GameObjects.Image;
  private readonly itemArrows: Phaser.GameObjects.Image[] = [];
  private clock = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly placement: MissionPlacement | null,
    alreadyDone: boolean,
    private readonly events: MissionEvents,
  ) {
    this.def = placement ? MISSIONS[placement.id] ?? null : null;
    if (!placement || !this.def) {
      this.status = 'done';
      return;
    }
    if (alreadyDone) this.status = 'done';
    for (const it of placement.items) {
      const sprite = scene.add.image(it.x, it.y, TEX.litter, it.frame).setOrigin(0.5, 0.8).setDepth(DEPTH.groundDecal + 1);
      sprite.setVisible(!alreadyDone);
      this.items.push({ x: it.x, y: it.y, sprite, taken: alreadyDone });
      const arrow = scene.add.image(it.x, it.y - 14, TEX.icons, ICON_FRAMES.arrowDown).setDepth(DEPTH.floatingText - 1).setVisible(false);
      this.itemArrows.push(arrow);
    }
    this.targetArrow = scene.add
      .image(placement.target.x, placement.target.y - 34, TEX.icons, ICON_FRAMES.arrowDown)
      .setDepth(DEPTH.floatingText - 1)
      .setVisible(false);
  }

  get required(): number {
    return this.def?.itemsRequired ?? 0;
  }

  get blockIndex(): number {
    return this.placement?.blockIndex ?? -1;
  }

  /** El portero ofreció la misión. */
  accept(): void {
    if (this.status === 'available') this.status = 'active';
  }

  update(dt: number, player: PlayerPos): void {
    if (!this.placement || !this.def) return;
    this.clock += dt;
    const bob = Math.round(Math.sin(this.clock * 5) * 2);
    const showItemArrows = this.status === 'active';
    this.items.forEach((it, i) => {
      const arrow = this.itemArrows[i];
      arrow.setVisible(showItemArrows && !it.taken);
      arrow.setY(it.y - 16 + bob);
      if (it.taken || this.status === 'done' || this.status === 'missed') return;
      // Se puede juntar aunque todavía no hayas hablado con el portero.
      if (Math.abs(it.x - player.x) < 10 && Math.abs(it.y - player.y) < 8 && player.z < 20) {
        it.taken = true;
        it.sprite.setVisible(false);
        this.collected++;
        if (this.status === 'available') this.status = 'active';
        this.events.onPickup?.(this.collected, this.required);
      }
    });
    const ready = this.status === 'active' && this.collected >= this.required;
    this.targetArrow?.setVisible(ready).setY(this.placement.target.y - 36 + bob);
    if (ready) {
      const t = this.placement.target;
      if (Math.abs(player.x - t.x) < 22 && player.y > LAYOUT.walkMaxY - 26) {
        this.status = 'done';
        this.targetArrow?.setVisible(false);
        this.events.onDelivered?.(this.def);
      }
    }
    // Si se pasó de largo la esquina sin entregar, la misión queda perdida (sin castigo).
    if (this.status !== 'done' && player.x > this.placement.target.x + 260) {
      this.status = 'missed';
      this.targetArrow?.setVisible(false);
      this.itemArrows.forEach((a) => a.setVisible(false));
    }
  }

  destroy(): void {
    this.items.forEach((it) => it.sprite.destroy());
    this.itemArrows.forEach((a) => a.destroy());
    this.targetArrow?.destroy();
  }
}
