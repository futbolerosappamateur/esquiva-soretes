import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { TEX, UI_FRAMES } from '../graphics/keys';
import { clamp } from '../core/math';
import { touchState } from './TouchState';

const JOY_RADIUS = 26;
const DEAD_ZONE = 0.18;
// Abajo, sobre la calle: así no tapan la vereda donde están los obstáculos.
const JOY_HOME = { x: 44, y: GAME_HEIGHT - 38 };
const JUMP_POS = { x: GAME_WIDTH - 40, y: GAME_HEIGHT - 38 };
/** Botón del poder especial: arriba del de salto (no se superpone con el joystick ni con el salto). */
export const SPECIAL_POS = { x: GAME_WIDTH - 46, y: GAME_HEIGHT - 92 };
const SPECIAL_RADIUS = 20;
export const PAUSE_BUTTON_POS = { x: GAME_WIDTH - 15, y: 14 };

/**
 * Controles táctiles: joystick flotante en la mitad izquierda (aparece donde
 * se apoya el pulgar), salto tocando la mitad derecha y botón de pausa.
 */
export class TouchControls {
  private readonly base: Phaser.GameObjects.Image;
  private readonly knob: Phaser.GameObjects.Image;
  private readonly jumpButton: Phaser.GameObjects.Image;
  private readonly pauseButton: Phaser.GameObjects.Image;
  private readonly specialBg: Phaser.GameObjects.Graphics;
  private readonly specialRing: Phaser.GameObjects.Graphics;
  private readonly specialIcon: Phaser.GameObjects.Image;
  private hasSpecial = false;
  private joyPointer: number | null = null;
  private jumpPointer: number | null = null;
  private readonly origin = { ...JOY_HOME };
  private enabled = true;
  private shown = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.base = scene.add.image(JOY_HOME.x, JOY_HOME.y, TEX.ui, UI_FRAMES.joyBase).setDepth(50).setAlpha(0.6);
    this.knob = scene.add.image(JOY_HOME.x, JOY_HOME.y, TEX.ui, UI_FRAMES.joyKnob).setDepth(51).setAlpha(0.8);
    this.jumpButton = scene.add.image(JUMP_POS.x, JUMP_POS.y, TEX.ui, UI_FRAMES.jump).setDepth(50).setAlpha(0.9);
    this.pauseButton = scene.add.image(PAUSE_BUTTON_POS.x, PAUSE_BUTTON_POS.y, TEX.ui, UI_FRAMES.pause).setDepth(50);
    this.specialBg = scene.add.graphics().setDepth(50);
    this.specialBg.fillStyle(0x120c18, 0.55).fillCircle(SPECIAL_POS.x, SPECIAL_POS.y, 16);
    this.specialRing = scene.add.graphics().setDepth(51);
    this.specialIcon = scene.add.image(SPECIAL_POS.x, SPECIAL_POS.y, TEX.icons, 'ab-dash').setDepth(52).setScale(1.5);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.setShown(false);
  }

  get isShown(): boolean {
    return this.shown;
  }

  setShown(shown: boolean): void {
    this.shown = shown;
    [this.base, this.knob, this.jumpButton, this.pauseButton].forEach((o) => o.setVisible(shown));
    [this.specialBg, this.specialRing, this.specialIcon].forEach((o) => o.setVisible(shown && this.hasSpecial));
    if (!shown) this.release();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.release();
  }

  private release(): void {
    this.joyPointer = null;
    this.jumpPointer = null;
    touchState.active = false;
    touchState.x = 0;
    touchState.y = 0;
    this.origin.x = JOY_HOME.x;
    this.origin.y = JOY_HOME.y;
    this.base.setPosition(JOY_HOME.x, JOY_HOME.y);
    this.knob.setPosition(JOY_HOME.x, JOY_HOME.y);
    this.jumpButton.setFrame(UI_FRAMES.jump);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    if (!this.shown) this.setShown(true);
    if (!this.enabled) return;
    const dx = pointer.x - PAUSE_BUTTON_POS.x;
    const dy = pointer.y - PAUSE_BUTTON_POS.y;
    if (dx * dx + dy * dy < 18 * 18) {
      touchState.queuePause();
      return;
    }
    const sx = pointer.x - SPECIAL_POS.x;
    const sy = pointer.y - SPECIAL_POS.y;
    if (this.hasSpecial && sx * sx + sy * sy < (SPECIAL_RADIUS + 4) * (SPECIAL_RADIUS + 4)) {
      touchState.queueSpecial();
      this.specialIcon.setScale(1.2);
      this.scene.time.delayedCall(120, () => this.specialIcon.setScale(1.5));
      return;
    }
    if (pointer.x < GAME_WIDTH * 0.5) {
      if (this.joyPointer !== null) return;
      this.joyPointer = pointer.id;
      this.origin.x = clamp(pointer.x, JOY_RADIUS + 6, GAME_WIDTH * 0.5 - JOY_RADIUS);
      this.origin.y = clamp(pointer.y, 60, GAME_HEIGHT - JOY_RADIUS - 6);
      this.base.setPosition(this.origin.x, this.origin.y);
      this.updateStick(pointer);
    } else {
      this.jumpPointer = pointer.id;
      touchState.queueJump();
      this.jumpButton.setFrame(UI_FRAMES.jumpDown);
    }
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joyPointer) this.updateStick(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joyPointer) {
      this.joyPointer = null;
      touchState.active = false;
      touchState.x = 0;
      touchState.y = 0;
      this.base.setPosition(JOY_HOME.x, JOY_HOME.y);
      this.knob.setPosition(JOY_HOME.x, JOY_HOME.y);
    }
    if (pointer.id === this.jumpPointer) {
      this.jumpPointer = null;
      this.jumpButton.setFrame(UI_FRAMES.jump);
    }
  }

  private updateStick(pointer: Phaser.Input.Pointer): void {
    let dx = pointer.x - this.origin.x;
    let dy = pointer.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    this.knob.setPosition(this.origin.x + dx, this.origin.y + dy);
    let nx = dx / JOY_RADIUS;
    let ny = dy / JOY_RADIUS;
    if (Math.abs(nx) < DEAD_ZONE) nx = 0;
    if (Math.abs(ny) < DEAD_ZONE) ny = 0;
    touchState.active = true;
    // Un poco de ganancia: no hace falta llevar el pulgar hasta el borde.
    touchState.x = clamp(nx * 1.35, -1, 1);
    touchState.y = clamp(ny * 1.35, -1, 1);
  }

  /** Ícono y recarga del poder (null = el personaje no tiene poder). */
  setSpecial(info: { icon: string; charge: number; active: boolean } | null): void {
    this.hasSpecial = info !== null;
    const visible = this.shown && this.hasSpecial;
    [this.specialBg, this.specialRing, this.specialIcon].forEach((o) => o.setVisible(visible));
    if (!info || !visible) return;
    const ready = info.charge >= 1 && !info.active;
    this.specialIcon.setFrame(info.icon).setAlpha(ready || info.active ? 1 : 0.45);
    const g = this.specialRing;
    g.clear();
    g.lineStyle(3, 0x4a3657, 0.9).strokeCircle(SPECIAL_POS.x, SPECIAL_POS.y, 17);
    const frac = info.active ? 1 : info.charge;
    if (frac > 0) {
      g.lineStyle(3, info.active ? 0xff8a1f : ready ? 0x6fe07a : 0xffd23f, 1).beginPath();
      g.arc(SPECIAL_POS.x, SPECIAL_POS.y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      g.strokePath();
    }
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    touchState.reset();
  }
}
