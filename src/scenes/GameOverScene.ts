import Phaser from 'phaser';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS, TEXTS2 } from '../config/texts';
import { formatThousands } from '../core/math';
import { createRun, runFromCheckpoint } from '../core/RunState';
import { ANIM } from '../graphics/animations';
import { TEX } from '../graphics/keys';
import { Button } from '../ui/Button';
import { ButtonMenu, type MenuItem } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import type { LevelResult } from './GameScene';

export class GameOverScene extends Phaser.Scene {
  private result!: LevelResult;

  constructor() {
    super(SCENES.GAME_OVER);
  }

  init(data: LevelResult): void {
    this.result = data;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS.gameOver;
    const r = this.result;
    addDim(this, 0.62);
    addPanel(this, cx, 135, 404, 262);

    const title = addText(this, cx, 10, t.title, { scale: 3, color: UI_COLORS.red, origin: [0.5, 0] });
    this.tweens.add({ targets: title, y: 12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Moscas revoloteando alrededor del título.
    for (let i = 0; i < 3; i++) {
      const fly = this.add.sprite(cx - 60 + i * 60, 24, TEX.fly, 'fly0').play(ANIM.fly);
      this.tweens.add({ targets: fly, x: `+=${20 + i * 6}`, duration: 500 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: fly, y: `+=${8 + i * 2}`, duration: 340 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    addText(this, cx, 44, t.message, { color: UI_COLORS.yellow, origin: [0.5, 0], align: 'center', maxWidth: 360 });
    addText(this, cx, 68, `${r.barrioName} · NIVEL ${r.levelNumber} · CUADRA ${Math.min(r.blocksCompleted + 1, r.totalBlocks)}/${r.totalBlocks}`, {
      outline: false,
      color: UI_COLORS.gray,
      origin: [0.5, 0],
    });

    const rows: [string, string][] = [
      [t.score, formatThousands(r.score)],
      [t.distance, `${formatThousands(r.distanceM)} M`],
      [t.dodged, formatThousands(r.dodged)],
      [t.record, formatThousands(r.globalBest)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 82 + i * 13;
      addText(this, 74, y, label, { color: UI_COLORS.cream });
      addText(this, GAME_WIDTH - 74, y, value, { color: i === 0 ? UI_COLORS.yellow : UI_COLORS.white, origin: [1, 0] });
    });

    if (r.isNewRecord) {
      const nr = addText(this, cx, 136, t.newRecord, { scale: 2, color: UI_COLORS.green, origin: [0.5, 0] });
      this.tweens.add({ targets: nr, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
    }

    const items: MenuItem[] = [];
    let y = 168;
    const make = (label: string, onClick: () => void) => {
      items.push({ button: new Button(this, cx, y, label, { width: 236, height: 17, onClick }) });
      y += 20;
    };
    if (r.checkpointBlock !== null) make(`${TEXTS2.gameOver.fromCheckpoint} ${r.checkpointBlock}`, () => this.retryCheckpoint());
    make(r.checkpointBlock !== null ? TEXTS2.gameOver.restartLevel : t.retry, () => this.restartLevel());
    make(TEXTS2.gameOver.map, () => this.toScene(SCENES.WORLD_MAP));
    make(t.menu, () => this.toScene(SCENES.MENU));
    new ButtonMenu(this, items, { onBack: () => this.toScene(SCENES.WORLD_MAP) });
  }

  private retryCheckpoint(): void {
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run: runFromCheckpoint(this.result.run) });
  }

  private restartLevel(): void {
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run: createRun(this.result.ref, this.result.run.seed) });
  }

  private toScene(key: string): void {
    this.scene.stop(SCENES.GAME);
    this.scene.stop(SCENES.HUD);
    this.scene.start(key, key === SCENES.WORLD_MAP ? { focus: this.result.barrioId } : undefined);
  }
}
