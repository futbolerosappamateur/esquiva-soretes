import Phaser from 'phaser';
import { PLAYER_TUNING } from '../config/balance';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS } from '../config/texts';
import { formatThousands } from '../core/math';
import { TEX, UI_FRAMES } from '../graphics/keys';
import { isTouchPrimary } from '../input/device';
import { TouchControls } from '../input/TouchControls';
import { addText } from '../ui/text';
import type { BlockDefinition } from '../world/blocks';
import type { GameScene } from './GameScene';

interface HudData {
  block: BlockDefinition;
  themeName: string;
  lives: number;
}

const BAR = { x: 160, y: 262, w: 160, h: 4 };

/** Interfaz durante la partida. Corre como escena aparte, encima del juego. */
export class HudScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private comboText!: Phaser.GameObjects.BitmapText;
  private comboBar!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;
  private head!: Phaser.GameObjects.Image;
  private sneakers: Phaser.GameObjects.Image[] = [];
  private sneakerBacking!: Phaser.GameObjects.Graphics;
  private phrase!: Phaser.GameObjects.BitmapText;
  private touch?: TouchControls;
  private displayedScore = 0;
  private lastMultiplier = 1;
  private sneakersShifted = false;

  constructor() {
    super(SCENES.HUD);
  }

  create(data: HudData): void {
    this.gameScene = this.scene.get(SCENES.GAME) as GameScene;
    this.sneakers = [];
    this.lastMultiplier = 1;
    this.sneakersShifted = false;
    const snap = this.gameScene.getHudSnapshot();
    this.displayedScore = snap.score;

    // Fondos semitransparentes: el HUD se lee sobre cualquier fachada.
    const backing = this.add.graphics();
    backing.fillStyle(0x120c18, 0.45).fillRoundedRect(2, 1, 84, 31, 4);
    backing.fillStyle(0x120c18, 0.45).fillRoundedRect(GAME_WIDTH / 2 - 62, 1, 124, 23, 4);
    this.sneakerBacking = this.add.graphics();

    addText(this, 8, 2, TEXTS.hud.score, { color: UI_COLORS.yellow });
    this.scoreText = addText(this, 7, 9, formatThousands(snap.score), { scale: 2, color: UI_COLORS.white });
    this.comboText = addText(this, 8, 34, '', { color: UI_COLORS.orange });
    this.comboBar = this.add.graphics();

    const cx = GAME_WIDTH / 2;
    addText(this, cx, 2, data.themeName, { color: UI_COLORS.yellow, origin: [0.5, 0] });
    addText(this, cx, 13, `${TEXTS.hud.block} ${data.block.number} · ${data.block.street}`, { color: UI_COLORS.white, origin: [0.5, 0] });

    for (let i = 0; i < PLAYER_TUNING.lives; i++) {
      const clean = i < data.lives;
      this.sneakers.push(this.add.image(0, 13, TEX.ui, clean ? UI_FRAMES.sneakerClean : UI_FRAMES.sneakerDirty));
    }
    this.placeSneakers(false);

    this.progressBar = this.add.graphics();
    this.add.image(BAR.x + BAR.w + 9, BAR.y - 3, TEX.ui, UI_FRAMES.flag);
    this.head = this.add.image(BAR.x, BAR.y - 7, TEX.playerHead);

    this.phrase = addText(this, cx, 52, '', { scale: 2, origin: 0.5 }).setVisible(false);

    if (this.sys.game.device.input.touch) {
      this.touch = new TouchControls(this);
      this.touch.setShown(isTouchPrimary());
      this.input.keyboard?.on('keydown', this.hideTouch, this);
    }

    this.showIntro(data);

    this.gameScene.events.on('hud:life-lost', this.onLifeLost, this);
    this.gameScene.events.on('hud:phrase', this.onPhrase, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gameScene.events.off('hud:life-lost', this.onLifeLost, this);
      this.gameScene.events.off('hud:phrase', this.onPhrase, this);
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
  }

  private showIntro(data: HudData): void {
    const cx = GAME_WIDTH / 2;
    const title = addText(this, cx, 66, `${TEXTS.hud.block} ${data.block.number}`, { scale: 3, color: UI_COLORS.yellow, origin: 0.5 });
    const sub = addText(this, cx, 90, `${data.block.street}, ENTRE ${data.block.fromStreet || 'LA ESQUINA'} Y ${data.block.toStreet}`, {
      color: UI_COLORS.cream,
      origin: 0.5,
    });
    const go = addText(this, cx, 108, TEXTS.game.go, { scale: 2, color: UI_COLORS.orange, origin: 0.5 }).setAlpha(0);
    this.tweens.add({ targets: go, alpha: 1, delay: 600, duration: 120 });
    this.tweens.add({
      targets: [title, sub, go],
      alpha: 0,
      delay: 2000,
      duration: 400,
      onComplete: () => [title, sub, go].forEach((t) => t.destroy()),
    });
  }

  private onLifeLost(lives: number): void {
    const index = Math.max(0, Math.min(this.sneakers.length - 1, lives));
    const icon = this.sneakers[index];
    if (!icon) return;
    icon.setFrame(UI_FRAMES.sneakerDirty);
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

    // Contador "rodante" del puntaje.
    const diff = snap.score - this.displayedScore;
    if (Math.abs(diff) < 1) this.displayedScore = snap.score;
    else this.displayedScore += diff * Math.min(1, dt * 10) + Math.sign(diff) * 0.5;
    this.scoreText.setText(formatThousands(Math.round(this.displayedScore)));

    // Multiplicador
    if (snap.multiplier > 1) {
      this.comboText.setText(`×${snap.multiplier}`);
      this.comboBar.clear();
      this.comboBar.fillStyle(0x120c18, 1).fillRect(24, 37, 34, 5);
      this.comboBar.fillStyle(0xff8a1f, 1).fillRect(25, 38, Math.round(32 * snap.comboProgress), 3);
      if (snap.multiplier > this.lastMultiplier) {
        this.tweens.add({ targets: this.comboText, scale: { from: 2, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      }
    } else if (this.lastMultiplier > 1) {
      this.comboText.setText('');
      this.comboBar.clear();
    }
    this.lastMultiplier = snap.multiplier;

    // Barra de progreso de la cuadra
    const g = this.progressBar;
    g.clear();
    g.fillStyle(0x120c18, 0.85).fillRect(BAR.x - 2, BAR.y - 2, BAR.w + 4, BAR.h + 4);
    g.fillStyle(0x4a3657, 1).fillRect(BAR.x, BAR.y, BAR.w, BAR.h);
    g.fillStyle(0xffd23f, 1).fillRect(BAR.x, BAR.y, Math.round(BAR.w * snap.progress), BAR.h);
    g.fillStyle(0xfff3a0, 1).fillRect(BAR.x, BAR.y, Math.round(BAR.w * snap.progress), 1);
    this.head.setX(Math.round(BAR.x + BAR.w * snap.progress));

    const shift = this.touch?.isShown ?? false;
    if (shift !== this.sneakersShifted) this.placeSneakers(shift);
  }
}
