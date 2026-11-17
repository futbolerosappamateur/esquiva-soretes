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
  /** Hacia dónde mira (para que el perro rescatado camine detrás). */
  facing?: number;
}

/** Raza del perro perdido (la salchicha: distinta de los perros del paseador). */
const LOST_DOG_KIND = 3;

type MissionItem = { x: number; y: number; sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; taken: boolean };

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
  /** `blocked`: no puede juntar (la corredora durante el sprint). */
  update(player: PlayerPos, left: number, right: number, blocked = false): { x: number; y: number }[] {
    const got: { x: number; y: number }[] = [];
    for (const c of this.coins) {
      if (c.taken) continue;
      const onScreen = c.x > left - 20 && c.x < right + 20;
      c.sprite.setVisible(onScreen);
      if (!onScreen || blocked) continue;
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
 * Misión del nivel:
 *  - "juntá la basura y llevala al tacho": la ofrece el portero; los residuos
 *    están siempre en lugares alcanzables y el tacho es un cesto junto al
 *    cordón antes de la esquina;
 *  - "perro perdido": el perro está a mitad de cuadra; al tocarlo te sigue y
 *    se entrega a su dueña, que espera más adelante junto a las fachadas.
 */
export class MissionSystem {
  readonly def: MissionDef | null;
  status: MissionStatus = 'available';
  collected = 0;
  private readonly items: MissionItem[] = [];
  /** El perro rescatado (sigue al jugador y después se queda con su dueña). */
  private dog: { x: number; y: number; sprite: Phaser.GameObjects.Sprite; home: boolean } | null = null;
  private readonly targetArrow?: Phaser.GameObjects.Image;
  private readonly itemArrows: Phaser.GameObjects.Image[] = [];
  private clock = 0;
  /** Alcance para juntar basura (el portero llega más lejos). */
  pickupRadius = 1;

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
    const animal = this.def.kind === 'animal';
    for (const it of placement.items) {
      let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (animal) {
        const dog = scene.add.sprite(it.x, it.y, TEX.npcDog(LOST_DOG_KIND), 'walk0').setOrigin(0.5, 1).setDepth(it.y);
        dog.play(ANIM.dog(LOST_DOG_KIND));
        dog.anims.pause();
        this.dog = { x: it.x, y: it.y, sprite: dog, home: false };
        sprite = dog;
      } else {
        sprite = scene.add.image(it.x, it.y, TEX.litter, it.frame).setOrigin(0.5, 0.8).setDepth(DEPTH.groundDecal + 1);
      }
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

  get isAnimal(): boolean {
    return this.def?.kind === 'animal';
  }

  /** Tinte de la ambientación (de noche, el perro también se oscurece). */
  setTint(tint: number): void {
    this.dog?.sprite.setTint(tint);
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
    const animal = this.isAnimal;
    // El perro perdido se ve desde lejos (no hace falta que te ofrezcan la misión).
    const showItemArrows = this.status === 'active' || (animal && this.status === 'available');
    this.items.forEach((it, i) => {
      const arrow = this.itemArrows[i];
      arrow.setVisible(showItemArrows && !it.taken);
      arrow.setY(it.y - (animal ? 26 : 16) + bob);
      if (it.taken || this.status === 'done' || this.status === 'missed') return;
      // Se puede juntar aunque todavía no hayas hablado con el portero.
      const r = animal ? 1.4 : this.pickupRadius;
      if (!this.blocked && Math.abs(it.x - player.x) < 10 * r && Math.abs(it.y - player.y) < 8 * r && player.z < 20) this.take(it);
    });
    this.updateDog(dt, player);
    const ready = this.status === 'active' && this.collected >= this.required;
    this.targetArrow?.setVisible(ready).setY(this.placement.target.y - (animal ? 58 : 36) + bob);
    if (ready) {
      const t = this.placement.target;
      const delivered = animal
        ? Math.abs(player.x - t.x) < 34 && Math.abs(player.y - t.y) < 48
        : Math.abs(player.x - t.x) < 22 && player.y > LAYOUT.walkMaxY - 26;
      if (delivered) {
        this.status = 'done';
        this.targetArrow?.setVisible(false);
        if (this.dog) this.dog.home = true;
        this.events.onDelivered?.(this.def);
      }
    }
    // Si se pasó de largo la esquina sin entregar, la misión queda perdida (sin castigo).
    if (this.status !== 'done' && this.status !== 'missed' && player.x > this.placement.target.x + 260) {
      this.status = 'missed';
      this.targetArrow?.setVisible(false);
      this.itemArrows.forEach((a) => a.setVisible(false));
      // El perro se vuelve solo con su dueña.
      if (this.dog && this.collected > 0) this.dog.home = true;
    }
  }

  /** El perro rescatado camina detrás del jugador; al entregarlo, se queda con su dueña. */
  private updateDog(dt: number, player: PlayerPos): void {
    const d = this.dog;
    if (!d || !this.placement || this.collected === 0) return;
    const t = this.placement.target;
    const facing = player.facing ?? 1;
    const tx = d.home ? t.x + 14 : player.x - 18 * facing;
    const ty = d.home ? t.y + 6 : player.y + 3;
    const follow = Math.min(1, dt * (d.home ? 3 : 5));
    const dx = (tx - d.x) * follow;
    const dy = (ty - d.y) * follow;
    d.x += dx;
    d.y += dy;
    d.sprite.setPosition(Math.round(d.x), Math.round(d.y)).setDepth(d.y).setVisible(true);
    if (Math.abs(dx) > 0.05) d.sprite.setFlipX(dx < 0);
    const moving = Math.abs(dx) + Math.abs(dy) > 0.15;
    if (moving && !d.sprite.anims.isPlaying) d.sprite.anims.resume();
    if (!moving && d.sprite.anims.isPlaying) d.sprite.anims.pause();
  }

  /** No puede juntar objetos (la corredora durante el sprint). */
  blocked = false;

  private take(it: MissionItem): void {
    it.taken = true;
    // El perro no desaparece: empieza a seguirte.
    if (!this.isAnimal) it.sprite.setVisible(false);
    this.collected++;
    if (this.status === 'available') this.status = 'active';
    this.events.onPickup?.(this.collected, this.required);
  }

  /** Junta la basura que quede dentro del rectángulo (escobazo). Devuelve cuántas piezas. */
  collectIn(x0: number, x1: number, y0: number, y1: number): number {
    if (!this.def || this.isAnimal || this.status === 'done' || this.status === 'missed') return 0;
    let n = 0;
    for (const it of this.items) {
      if (it.taken || it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue;
      this.take(it);
      n++;
    }
    return n;
  }

  destroy(): void {
    this.items.forEach((it) => it.sprite.destroy());
    this.itemArrows.forEach((a) => a.destroy());
    this.targetArrow?.destroy();
  }
}
