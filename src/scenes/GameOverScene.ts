import Phaser from 'phaser';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS } from '../config/texts';
import { formatThousands } from '../core/math';
import { createRun } from '../core/RunState';
import { ANIM } from '../graphics/animations';
import { TEX } from '../graphics/keys';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import type { ResultSummary } from './GameScene';

export class GameOverScene extends Phaser.Scene {
  private summary!: ResultSummary;

  constructor() {
    super(SCENES.GAME_OVER);
  }

  init(data: ResultSummary): void {
    this.summary = data;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS.gameOver;
    const s = this.summary;
    addDim(this, 0.62);
    addPanel(this, cx, 135, 404, 246);

    const title = addText(this, cx, 16, t.title, { scale: 3, color: UI_COLORS.red, origin: [0.5, 0] });
    this.tweens.add({ targets: title, y: 18, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Moscas revoloteando alrededor del título.
    for (let i = 0; i < 3; i++) {
      const fly = this.add.sprite(cx - 60 + i * 60, 30, TEX.fly, 'fly0').play(ANIM.fly);
      this.tweens.add({ targets: fly, x: `+=${20 + i * 6}`, duration: 500 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: fly, y: `+=${8 + i * 2}`, duration: 340 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    addText(this, cx, 52, t.message, { color: UI_COLORS.yellow, origin: [0.5, 0], align: 'center', maxWidth: 360 });

    const rows: [string, string][] = [
      [t.score, formatThousands(s.run.score)],
      [t.distance, `${formatThousands(s.run.totalDistanceM)} M`],
      [t.dodged, formatThousands(s.run.totalDodged)],
      [t.record, formatThousands(s.bestScore)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 88 + i * 15;
      addText(this, 74, y, label, { color: UI_COLORS.cream });
      addText(this, GAME_WIDTH - 74, y, value, { color: i === 0 ? UI_COLORS.yellow : UI_COLORS.white, origin: [1, 0] });
    });

    if (s.isNewRecord) {
      const nr = addText(this, cx, 154, t.newRecord, { scale: 2, color: UI_COLORS.green, origin: [0.5, 0] });
      this.tweens.add({ targets: nr, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
    }

    const retry = new Button(this, cx, 196, t.retry, { width: 160, height: 19, onClick: () => this.retry() });
    const menu = new Button(this, cx, 219, t.menu, { width: 160, height: 19, onClick: () => this.toMenu() });
    new ButtonMenu(this, [{ button: retry }, { button: menu }], { onBack: () => this.toMenu() });
  }

  private retry(): void {
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run: createRun() });
  }

  private toMenu(): void {
    this.scene.stop(SCENES.GAME);
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.MENU);
  }
}
