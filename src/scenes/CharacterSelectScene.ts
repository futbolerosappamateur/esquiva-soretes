import Phaser from 'phaser';
import { portraitKey } from '../assets/manifest';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { unlockProgress } from '../core/achievementsLogic';
import { formatTime } from '../core/LevelClock';
import type { GameMode } from '../core/leaderboard';
import { formatThousands } from '../core/math';
import { recordsRepo } from '../core/recordsRepository';
import { createRun } from '../core/RunState';
import { saveStore } from '../core/save';
import { ABILITIES, abilityCooldown } from '../data/abilities';
import { ACHIEVEMENTS } from '../data/achievements';
import { getLevel, type LevelRef } from '../data/campaign';
import { CHARACTERS, isPlayable, statBars, type CharacterDef } from '../data/characters';
import { ANIM } from '../graphics/animations';
import { ensureCharacterPreview } from '../graphics/characterTextures';
import { FX_FRAMES, ICON_FRAMES, TEX } from '../graphics/keys';
import { addIcon, addPanelImage } from '../graphics/textures/uiTextures';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { fitToTexture } from '../graphics/renderScale';
import { Button } from '../ui/Button';
import { addText } from '../ui/text';
import { uniqueKeyEvents } from '../input/keyEvents';

const COLS = 3;
const CELL_W = 44;
const CELL_H = 50;
const GRID_X = 10;
const GRID_Y = 30;
const PANEL = { x: 152, y: 28, w: 322, h: 204 };
/** Alto del retrato (ilustración grande) en la vista del personaje y en las fichas. */
const PORTRAIT_H = 76;
const CARD_PORTRAIT_H = 41;

/**
 * Selección de personaje (antes de cada partida), con estética arcade.
 * Muestra habilidad, pasiva, desventaja, estadísticas, récords con ese
 * personaje y, si está bloqueado, el desafío que falta cumplir.
 * El personaje no se puede cambiar en medio de una partida.
 */
export class CharacterSelectScene extends Phaser.Scene {
  private levelRef: LevelRef = { barrioId: 'san-telmo', levelIndex: 0 };
  private mode: GameMode = 'normal';
  private index = 0;
  private cells: { frame: Phaser.GameObjects.Image; sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image }[] = [];
  private detail: Phaser.GameObjects.GameObject[] = [];
  private playButton!: Button;

  constructor() {
    super(SCENES.CHARACTER);
  }

  init(data: { levelRef?: LevelRef; mode?: GameMode }): void {
    if (data?.levelRef) this.levelRef = data.levelRef;
    this.mode = data?.mode ?? 'normal';
    this.cells = [];
    this.detail = [];
  }

  create(): void {
    const t = TEXTS2.character;
    this.cameras.main.setBackgroundColor('#2a1d33');
    addText(this, 10, 6, t.title, { scale: 2, color: UI_COLORS.yellow });
    const found = getLevel(this.levelRef);
    if (found) {
      const modeLabel = this.mode === 'timeTrial' ? TEXTS2.hud.timeTrial : 'NORMAL';
      addText(this, GAME_WIDTH - 8, 8, `${found.barrio.name} · NIVEL ${found.level.number} · ${modeLabel}`, { outline: false, color: UI_COLORS.gray, origin: [1, 0] });
    }
    addIcon(this, GAME_WIDTH - 60, 22, ICON_FRAMES.coin);
    addText(this, GAME_WIDTH - 52, 18, `${saveStore.get().wallet.coins}`, { color: UI_COLORS.yellow });

    const save = saveStore.get();
    CHARACTERS.forEach((c, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * CELL_W + CELL_W / 2;
      const y = GRID_Y + row * CELL_H;
      const frame = addPanelImage(this, x, y + CELL_H / 2, CELL_W - 2, CELL_H - 2).setInteractive({ useHandCursor: true });
      const sprite = this.figure(c, x, y + CELL_H - 3, CARD_PORTRAIT_H, 1, i % 3);
      const unlocked = this.isUnlocked(c);
      if (!unlocked) {
        // Silueta con candado (y signo de pregunta si es un personaje futuro).
        sprite.setTint(0x120c18).setAlpha(0.9);
        addIcon(this, x + 12, y + 12, ICON_FRAMES.lock);
        if (c.unlock.kind === 'future') addText(this, x - 14, y + 4, '?', { color: UI_COLORS.gray });
      } else if (!save.seenCharacters.includes(c.id)) {
        addText(this, x, y + 2, '¡NUEVO!', { outline: true, color: UI_COLORS.green, origin: [0.5, 0] });
      }
      frame.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => (this.index === i ? this.confirm() : this.setIndex(i, true)));
      this.cells.push({ frame, sprite });
    });

    addPanelImage(this, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2, PANEL.w, PANEL.h);
    this.playButton = new Button(this, GAME_WIDTH / 2 + 60, GAME_HEIGHT - 16, t.play, { width: 150, height: 20, onClick: () => this.confirm() });
    const back = new Button(this, 80, GAME_HEIGHT - 16, t.back, { width: 120, height: 20, onClick: () => this.back() });
    back.container.setDepth(5);
    addText(this, GAME_WIDTH / 2 + 60, PANEL.y + PANEL.h + 2, t.locked4ever, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] });

    this.input.keyboard?.on('keydown', uniqueKeyEvents((e: KeyboardEvent) => {
      const n = CHARACTERS.length;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setIndex((this.index - 1 + n) % n, true);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setIndex((this.index + 1) % n, true);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.setIndex((this.index - COLS + n) % n, true);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.setIndex((this.index + COLS) % n, true);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') this.confirm();
      else if (e.code === 'Escape' || e.code === 'Backspace') this.back();
    }));

    const selected = CHARACTERS.findIndex((c) => c.id === save.selectedCharacter);
    this.setIndex(Math.max(0, selected), false);
    this.cameras.main.fadeIn(200, 18, 12, 24);
  }

  /**
   * Figura de un personaje parada con los pies en (x, y): su retrato (la
   * ilustración grande, con una respiración suave) si tiene, o si no el dibujo
   * animado del juego a la escala pedida.
   */
  private figure(c: CharacterDef, x: number, y: number, portraitH: number, spriteScale: number, startFrame: number): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image {
    const portrait = portraitKey(c.lookId);
    if (this.textures.exists(portrait)) {
      const img = this.add.image(x, y, portrait).setOrigin(0.5, 1);
      const s = portraitH / img.height;
      img.setScale(s);
      this.tweens.add({ targets: img, scaleY: s * 1.015, duration: 1300 + startFrame * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return img;
    }
    const key = ensureCharacterPreview(this, c.id);
    const sprite = fitToTexture(this.add.sprite(x, y, key, 'idle0').setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY), spriteScale);
    sprite.play({ key: ANIM.preview(c.id), startFrame });
    return sprite;
  }

  private isUnlocked(c: CharacterDef): boolean {
    return isPlayable(c) && saveStore.get().unlocks.characters.includes(c.id);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.detail.push(o);
    return o;
  }

  private setIndex(i: number, sound: boolean): void {
    this.index = i;
    if (sound) audio.play('click');
    this.cells.forEach((cell, k) => cell.frame.setTint(k === i ? 0xffe08a : 0xffffff));
    this.detail.forEach((o) => {
      this.tweens.killTweensOf(o);
      o.destroy();
    });
    this.detail = [];
    const c = CHARACTERS[i];
    const unlocked = this.isUnlocked(c);
    const t = TEXTS2.character;
    const px = PANEL.x + 8;
    let y = PANEL.y + 6;

    // Imagen grande del personaje.
    const feet = this.textures.exists(portraitKey(c.lookId)) ? PANEL.y + 81 : PANEL.y + 92;
    this.keep(this.add.image(PANEL.x + 40, feet, TEX.fx, FX_FRAMES.shadow).setScale(2).setAlpha(0.35));
    const big = this.keep(this.figure(c, PANEL.x + 40, feet, PORTRAIT_H, 2, 0));
    if (!unlocked) big.setTint(0x120c18);
    if (sound) this.tweens.add({ targets: big, alpha: { from: 0, to: 1 }, y: { from: big.y + 4, to: big.y }, duration: 160, ease: 'Quad.easeOut' });

    const tx = PANEL.x + 84;
    this.keep(addText(this, tx, y, c.name, { color: UI_COLORS.yellow }));
    y += 11;
    this.keep(addText(this, tx, y, c.role, { outline: false, color: UI_COLORS.orange }));
    y += 10;
    this.keep(addText(this, tx, y, c.description, { outline: false, color: UI_COLORS.cream, maxWidth: PANEL.w - 92 }));
    y = PANEL.y + 50;

    // Barras de estadísticas.
    const bars = statBars(c.stats);
    const g = this.keep(this.add.graphics());
    ([
      [t.speed, bars.speed],
      [t.jump, bars.jump],
      [t.control, bars.control],
    ] as [string, number][]).forEach(([label, v], k) => {
      const by = y + k * 10;
      this.keep(addText(this, tx, by, label, { outline: false, color: UI_COLORS.gray }));
      for (let b = 0; b < 5; b++) {
        g.fillStyle(b < v ? 0x6fe07a : 0x4a3657, 1).fillRect(tx + 57 + b * 9, by + 1, 7, 5);
      }
    });
    y = PANEL.y + 84;

    // Habilidad, pasiva y desventaja.
    if (c.ability) {
      const info = ABILITIES[c.ability];
      this.keep(addIcon(this, px + 8, y + 6, info.icon));
      this.keep(addText(this, px + 20, y, `${t.special}: ${info.name}`, { color: UI_COLORS.yellow }));
      this.keep(addText(this, PANEL.x + PANEL.w - 8, y, `${t.cooldown} ${abilityCooldown(c.ability)} S`, { outline: false, color: UI_COLORS.gray, origin: [1, 0] }));
      y += 10;
      this.keep(addText(this, px + 20, y, info.description, { outline: false, color: UI_COLORS.cream, maxWidth: PANEL.w - 30 }));
      y += 20;
    } else {
      this.keep(addText(this, px, y, `${t.special}: ${t.soon}`, { color: UI_COLORS.gray }));
      y += 20;
    }
    this.keep(addText(this, px, y, `${t.passive}: ${c.passive.name}`, { color: UI_COLORS.celeste }));
    y += 10;
    this.keep(addText(this, px, y, c.passive.description, { outline: false, color: UI_COLORS.cream, maxWidth: PANEL.w - 16 }));
    y += 12;
    if (c.drawback) {
      this.keep(addText(this, px, y, `${t.drawback}: ${c.drawback}`, { outline: false, color: 0xff9a8e, maxWidth: PANEL.w - 16 }));
      y += 12;
    }

    // Récords con este personaje en este nivel, o el desafío para desbloquearlo.
    y = PANEL.y + PANEL.h - 26;
    const found = getLevel(this.levelRef);
    if (unlocked && found) {
      const best = recordsRepo.profileCharacterBest(found.level.id, this.mode, saveStore.activeProfile().id, c.id);
      this.keep(addIcon(this, px + 5, y + 4, ICON_FRAMES.clock));
      this.keep(addText(this, px + 14, y, `${t.bestTime}: ${formatTime(best.time?.timeMs ?? null)}`, { color: UI_COLORS.white }));
      this.keep(addIcon(this, px + 5, y + 15, ICON_FRAMES.trophy));
      this.keep(addText(this, px + 14, y + 11, `${t.bestScore}: ${best.score ? formatThousands(best.score.score) : '-'}`, { color: UI_COLORS.white }));
    } else if (c.unlock.kind !== 'starter') {
      const prog = unlockProgress(saveStore.get(), c);
      const label = ACHIEVEMENTS[c.unlock.counter].label;
      this.keep(addIcon(this, px + 5, y + 4, ICON_FRAMES.lock));
      const head = c.unlock.kind === 'future' ? t.futureCharacter : t.unlockBy;
      this.keep(addText(this, px + 14, y, head, { color: UI_COLORS.orange }));
      this.keep(addText(this, px + 14, y + 11, `${label}: ${prog.current}/${prog.target}`, { color: prog.done ? UI_COLORS.green : UI_COLORS.white }));
    }

    this.playButton.setEnabled(unlocked);
    this.playButton.setText(unlocked ? t.play : c.unlock.kind === 'future' ? t.soon : t.locked);
    if (unlocked) {
      saveStore.update((s) => {
        s.selectedCharacter = c.id;
        if (!s.seenCharacters.includes(c.id)) s.seenCharacters.push(c.id);
      });
    }
  }

  private confirm(): void {
    const c = CHARACTERS[this.index];
    if (!this.isUnlocked(c)) {
      audio.play('lifeLost');
      this.tweens.add({ targets: this.cells[this.index].frame, x: '+=3', duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    saveStore.update((s) => (s.selectedCharacter = c.id));
    audio.play('start');
    this.cameras.main.fadeOut(240, 18, 12, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.GAME, { run: createRun(this.levelRef, { mode: this.mode, characterId: c.id }) });
    });
  }

  private back(): void {
    audio.play('click');
    this.scene.start(SCENES.BARRIO, { barrioId: this.levelRef.barrioId, focus: this.levelRef.levelIndex, mode: this.mode });
  }
}
