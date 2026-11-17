import Phaser from 'phaser';
import { PLAYER_TUNING } from '../config/balance';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS, TEXTS2 } from '../config/texts';
import { formatThousands } from '../core/math';
import type { LifeMark } from '../core/RunState';
import { ICON_FRAMES, TEX, UI_FRAMES } from '../graphics/keys';
import { SIGNAL_FRAMES } from '../graphics/textures/crossingTextures';
import { isTouchPrimary } from '../input/device';
import { TouchControls } from '../input/TouchControls';
import { addText } from '../ui/text';
import type { GameScene, HudInit } from './GameScene';

const BAR = { x: 150, y: 262, w: 180, h: 4 };

/** Interfaz durante la partida. Corre como escena aparte, encima del juego. */
export class HudScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private data0!: HudInit;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private coinText!: Phaser.GameObjects.BitmapText;
  private comboText!: Phaser.GameObjects.BitmapText;
  private comboBar!: Phaser.GameObjects.Graphics;
  private blockText!: Phaser.GameObjects.BitmapText;
  private progressBar!: Phaser.GameObjects.Graphics;
  private head!: Phaser.GameObjects.Image;
  private sneakers: Phaser.GameObjects.Image[] = [];
  private sneakerBacking!: Phaser.GameObjects.Graphics;
  private phrase!: Phaser.GameObjects.BitmapText;
  private signalBox!: Phaser.GameObjects.Container;
  private signalIcon!: Phaser.GameObjects.Image;
  private signalText!: Phaser.GameObjects.BitmapText;
  private missionBox!: Phaser.GameObjects.Container;
  private missionText!: Phaser.GameObjects.BitmapText;
  private toast?: Phaser.GameObjects.BitmapText;
  private touch?: TouchControls;
  private displayedScore = 0;
  private lastMultiplier = 1;
  private lastBlockLabel = '';
  private sneakersShifted = false;
  private clock = 0;

  constructor() {
    super(SCENES.HUD);
  }

  create(data: HudInit): void {
    this.data0 = data;
    this.gameScene = this.scene.get(SCENES.GAME) as GameScene;
    this.sneakers = [];
    this.lastMultiplier = 1;
    this.lastBlockLabel = '';
    this.sneakersShifted = false;
    this.clock = 0;
    this.toast = undefined;
    const snap = this.gameScene.getHudSnapshot();
    this.displayedScore = snap.score;

    // Fondos semitransparentes: la HUD se lee sobre cualquier fachada.
    const backing = this.add.graphics();
    backing.fillStyle(0x120c18, 0.45).fillRoundedRect(2, 1, 92, 42, 4);
    backing.fillStyle(0x120c18, 0.45).fillRoundedRect(GAME_WIDTH / 2 - 78, 1, 156, 23, 4);
    this.sneakerBacking = this.add.graphics();

    addText(this, 8, 2, TEXTS.hud.score, { color: UI_COLORS.yellow });
    this.scoreText = addText(this, 7, 9, formatThousands(snap.score), { scale: 2, color: UI_COLORS.white });
    this.add.image(12, 32, TEX.icons, ICON_FRAMES.coin);
    this.coinText = addText(this, 20, 29, `${snap.coins}`, { color: UI_COLORS.yellow });
    this.comboText = addText(this, 52, 29, '', { color: UI_COLORS.orange });
    this.comboBar = this.add.graphics();

    const cx = GAME_WIDTH / 2;
    addText(this, cx, 2, `${data.barrioName} · ${TEXTS2.hud.level} ${data.levelNumber}`, { color: UI_COLORS.yellow, origin: [0.5, 0] });
    this.blockText = addText(this, cx, 13, '', { color: UI_COLORS.white, origin: [0.5, 0] });

    for (let i = 0; i < PLAYER_TUNING.lives; i++) this.sneakers.push(this.add.image(0, 13, TEX.ui, UI_FRAMES.sneakerClean));
    this.refreshSneakers(data.lifeMarks);
    this.placeSneakers(false);

    this.progressBar = this.add.graphics();
    this.add.image(BAR.x + BAR.w + 9, BAR.y - 3, TEX.ui, UI_FRAMES.flag);
    this.head = this.add.image(BAR.x, BAR.y - 7, TEX.playerHead);

    // Semáforo peatonal grande (sólo en los cruces).
    this.signalIcon = this.add.image(0, 0, TEX.hudSignal, SIGNAL_FRAMES.pedStop);
    this.signalText = addText(this, 0, 18, '', { color: UI_COLORS.white, origin: [0.5, 0] });
    const sigBg = this.add.graphics();
    sigBg.fillStyle(0x120c18, 0.6).fillRoundedRect(-30, -16, 60, 46, 4);
    this.signalBox = this.add.container(GAME_WIDTH - 40, 46, [sigBg, this.signalIcon, this.signalText]).setVisible(false);

    // Misión de la basura.
    const misBg = this.add.graphics();
    misBg.fillStyle(0x120c18, 0.5).fillRoundedRect(0, 0, 92, 15, 4);
    const trash = this.add.image(9, 7, TEX.icons, ICON_FRAMES.trash);
    this.missionText = addText(this, 18, 4, '', { color: UI_COLORS.celeste });
    this.missionBox = this.add.container(2, 46, [misBg, trash, this.missionText]).setVisible(false);

    this.phrase = addText(this, cx, 66, '', { scale: 2, origin: 0.5 }).setVisible(false);

    if (this.sys.game.device.input.touch) {
      this.touch = new TouchControls(this);
      this.touch.setShown(isTouchPrimary());
      this.input.keyboard?.on('keydown', this.hideTouch, this);
    }

    this.showLevelIntro(data);

    const ev = this.gameScene.events;
    ev.on('hud:life-lost', this.onLifeLost, this);
    ev.on('hud:phrase', this.onPhrase, this);
    ev.on('hud:block', this.onBlock, this);
    ev.on('hud:checkpoint', this.onCheckpoint, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ev.off('hud:life-lost', this.onLifeLost, this);
      ev.off('hud:phrase', this.onPhrase, this);
      ev.off('hud:block', this.onBlock, this);
      ev.off('hud:checkpoint', this.onCheckpoint, this);
      this.input.keyboard?.off('keydown', this.hideTouch, this);
      this.touch?.destroy();
      this.touch = undefined;
    });
  }

  private hideTouch(): void {
    this.touch?.setShown(false);
  }

  private placeSneakers(shifted: boolean): void {
    this.sneakersShifted = shifted;
    const right = GAME_WIDTH - (shifted ? 38 : 14);
    this.sneakers.forEach((s, i) => s.setX(right - (this.sneakers.length - 1 - i) * 22));
    const left = right - (this.sneakers.length - 1) * 22 - 14;
    this.sneakerBacking.clear();
    this.sneakerBacking.fillStyle(0x120c18, 0.45).fillRoundedRect(left, 2, right + 14 - left, 22, 4);
    this.signalBox?.setX(shifted ? GAME_WIDTH - 64 : GAME_WIDTH - 40);
  }

  /** Las zapatillas perdidas se marcan desde la derecha: sucia (sorete) o pisada (auto). */
  private refreshSneakers(marks: readonly LifeMark[]): void {
    const n = this.sneakers.length;
    this.sneakers.forEach((icon, i) => {
      const lostIndex = n - 1 - i;
      const mark = marks[lostIndex];
      if (!mark) icon.setTexture(TEX.ui, UI_FRAMES.sneakerClean);
      else if (mark === 'car') icon.setTexture(TEX.icons, ICON_FRAMES.sneakerFlat);
      else icon.setTexture(TEX.ui, UI_FRAMES.sneakerDirty);
    });
  }

  private banner(lines: { text: string; scale: number; color: number }[], delay = 0, hold = 2000): void {
    const cx = GAME_WIDTH / 2;
    let y = 70;
    const objs = lines.map((l) => {
      const t = addText(this, cx, y, l.text, { scale: l.scale, color: l.color, origin: 0.5 }).setAlpha(0);
      y += 9 * l.scale + 6;
      return t;
    });
    this.tweens.add({ targets: objs, alpha: 1, delay, duration: 160 });
    this.tweens.add({ targets: objs, alpha: 0, delay: delay + hold, duration: 400, onComplete: () => objs.forEach((o) => o.destroy()) });
  }

  private blockLine(i: number): string {
    const b = this.data0.blocks[i];
    return b ? `${b.street}, ENTRE ${b.from} Y ${b.to}` : '';
  }

  private showLevelIntro(data: HudInit): void {
    if (data.startBlock > 0) {
      this.banner([
        { text: `${TEXTS2.hud.block} ${data.startBlock + 1}/${data.blocks.length}`, scale: 3, color: UI_COLORS.yellow },
        { text: TEXTS2.game.checkpoint, scale: 1, color: UI_COLORS.green },
      ]);
      return;
    }
    this.banner([
      { text: `${TEXTS2.hud.level} ${data.levelNumber} · ${data.envLabel}`, scale: 3, color: UI_COLORS.yellow },
      { text: data.levelName, scale: 1, color: UI_COLORS.orange },
      { text: `${TEXTS2.hud.block} 1 · ${this.blockLine(0)}`, scale: 1, color: UI_COLORS.cream },
    ]);
    const go = addText(this, GAME_WIDTH / 2, 132, TEXTS.game.go, { scale: 2, color: UI_COLORS.orange, origin: 0.5 }).setAlpha(0);
    this.tweens.add({ targets: go, alpha: 1, delay: 700, duration: 120 });
    this.tweens.add({ targets: go, alpha: 0, delay: 2100, duration: 400, onComplete: () => go.destroy() });
  }

  private onBlock(index: number): void {
    if (index === 0) return;
    this.banner(
      [
        { text: `${TEXTS2.hud.block} ${index + 1}/${this.data0.blocks.length}`, scale: 3, color: UI_COLORS.yellow },
        { text: this.blockLine(index), scale: 1, color: UI_COLORS.cream },
      ],
      0,
      1600,
    );
  }

  private onCheckpoint(blocksCompleted: number): void {
    this.toast?.destroy();
    const t = addText(this, GAME_WIDTH / 2, BAR.y - 14, `${TEXTS2.game.checkpoint} · ${TEXTS2.hud.block} ${blocksCompleted}/${this.data0.blocks.length}`, {
      color: UI_COLORS.green,
      origin: [0.5, 1],
    });
    this.toast = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
  }

  private onLifeLost(lives: number): void {
    const marks = this.gameScene.getHudSnapshot().lifeMarks;
    this.refreshSneakers(marks);
    const index = Math.max(0, Math.min(this.sneakers.length - 1, lives));
    const icon = this.sneakers[index];
    if (!icon) return;
    this.tweens.add({ targets: icon, scale: { from: 2, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: icon, angle: { from: -15, to: 15 }, duration: 60, yoyo: true, repeat: 3, onComplete: () => icon.setAngle(0) });
  }

  private onPhrase(text: string, color: number): void {
    this.tweens.killTweensOf(this.phrase);
    this.phrase.setText(text).setTint(color).setVisible(true).setAlpha(1).setScale(1);
    this.tweens.add({ targets: this.phrase, scale: 2, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.phrase, alpha: 0, delay: 1000, duration: 260, onComplete: () => this.phrase.setVisible(false) });
  }

  update(_time: number, delta: number): void {
    if (!this.gameScene.sys.isActive() && !this.gameScene.sys.isPaused()) return;
    const snap = this.gameScene.getHudSnapshot();
    const dt = Math.min(delta, 50) / 1000;
    this.clock += dt;

    // Contador "rodante" del puntaje.
    const diff = snap.score - this.displayedScore;
    if (Math.abs(diff) < 1) this.displayedScore = snap.score;
    else this.displayedScore += diff * Math.min(1, dt * 10) + Math.sign(diff) * 0.5;
    this.scoreText.setText(formatThousands(Math.round(this.displayedScore)));
    this.coinText.setText(`${snap.coins}`);

    // Multiplicador
    if (snap.multiplier > 1) {
      this.comboText.setText(`×${snap.multiplier}`);
      this.comboBar.clear();
      this.comboBar.fillStyle(0x120c18, 1).fillRect(66, 31, 24, 5);
      this.comboBar.fillStyle(0xff8a1f, 1).fillRect(67, 32, Math.round(22 * snap.comboProgress), 3);
      if (snap.multiplier > this.lastMultiplier) {
        this.tweens.add({ targets: this.comboText, scale: { from: 2, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      }
    } else if (this.lastMultiplier > 1) {
      this.comboText.setText('');
      this.comboBar.clear();
    }
    this.lastMultiplier = snap.multiplier;

    // Cuadra actual o esquina con cruce.
    const block = this.data0.blocks[snap.block - 1];
    const label = snap.crossing
      ? `${TEXTS2.hud.corner} ${this.data0.blocks[snap.crossing.index]?.to ?? ''}`
      : `${TEXTS2.hud.block} ${snap.block}/${snap.blocks} · ${block?.street ?? ''}`;
    if (label !== this.lastBlockLabel) {
      this.lastBlockLabel = label;
      this.blockText.setText(label);
    }

    // Semáforo peatonal grande en la HUD.
    const c = snap.crossing;
    this.signalBox.setVisible(c !== null);
    if (c) {
      const flashOn = Math.floor(this.clock * 2.5) % 2 === 0;
      if (c.signal === 'walk') {
        this.signalIcon.setFrame(SIGNAL_FRAMES.pedWalk);
        this.signalText.setText(TEXTS2.hud.cross).setTint(UI_COLORS.green);
      } else if (c.signal === 'flash') {
        this.signalIcon.setFrame(flashOn ? SIGNAL_FRAMES.pedWalk : SIGNAL_FRAMES.pedOff);
        this.signalText.setText(`${TEXTS2.hud.hurry} ${Math.ceil(c.secondsOfWalkLeft)}`).setTint(UI_COLORS.orange);
      } else {
        this.signalIcon.setFrame(SIGNAL_FRAMES.pedStop);
        this.signalText.setText(`${TEXTS2.hud.wait} ${Math.ceil(c.secondsUntilWalk)}`).setTint(c.onRoad ? UI_COLORS.red : UI_COLORS.white);
      }
    }

    // Misión.
    const m = snap.mission;
    this.missionBox.setVisible(m !== null && m.status === 'active');
    if (m && m.status === 'active') {
      this.missionText.setText(m.collected >= m.required ? TEXTS2.hud.tacho : `${TEXTS2.hud.trash} ${m.collected}/${m.required}`);
    }

    // Barra de progreso del nivel, con una marca en cada esquina.
    const g = this.progressBar;
    g.clear();
    g.fillStyle(0x120c18, 0.85).fillRect(BAR.x - 2, BAR.y - 2, BAR.w + 4, BAR.h + 4);
    g.fillStyle(0x4a3657, 1).fillRect(BAR.x, BAR.y, BAR.w, BAR.h);
    g.fillStyle(0xffd23f, 1).fillRect(BAR.x, BAR.y, Math.round(BAR.w * snap.progress), BAR.h);
    g.fillStyle(0xfff3a0, 1).fillRect(BAR.x, BAR.y, Math.round(BAR.w * snap.progress), 1);
    this.data0.blockEnds.slice(0, -1).forEach((f) => {
      g.fillStyle(0xfff4d6, 1).fillRect(Math.round(BAR.x + BAR.w * f), BAR.y - 2, 1, BAR.h + 4);
    });
    this.head.setX(Math.round(BAR.x + BAR.w * snap.progress));

    const shift = this.touch?.isShown ?? false;
    if (shift !== this.sneakersShifted) this.placeSneakers(shift);
  }
}
