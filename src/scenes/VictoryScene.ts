import Phaser from 'phaser';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS } from '../config/texts';
import { formatThousands } from '../core/math';
import { createRun } from '../core/RunState';
import { DESIGNED_BLOCKS, getBlock } from '../world/blocks';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import type { ResultSummary } from './GameScene';

interface Row {
  label: string;
  detail: string;
  value: number;
  sign: '+' | '-' | '';
  color: number;
}

export class VictoryScene extends Phaser.Scene {
  private summary!: ResultSummary;

  constructor() {
    super(SCENES.VICTORY);
  }

  init(data: ResultSummary): void {
    this.summary = data;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS.victory;
    const s = this.summary;
    addDim(this, 0.55);
    addPanel(this, cx, 135, 404, 254);

    const title = addText(this, cx, 14, t.title, { scale: 2, color: UI_COLORS.green, origin: [0.5, 0] });
    this.tweens.add({ targets: title, y: 16, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addText(this, cx, 38, `CUADRA ${s.block.number} · ${s.block.street} Y ${s.block.toStreet}`, { color: UI_COLORS.cream, origin: [0.5, 0] });

    const rows: Row[] = [
      { label: t.distance, detail: `${s.distanceM} M`, value: s.distancePoints, sign: '+', color: UI_COLORS.white },
      { label: t.dodged, detail: `${s.dodged}`, value: s.dodgePoints, sign: '+', color: UI_COLORS.white },
      { label: t.bestCombo, detail: '', value: s.bestStreak, sign: '', color: UI_COLORS.white },
    ];
    if (s.penaltyPoints > 0) rows.push({ label: 'BALDOSAS FLOJAS', detail: '', value: s.penaltyPoints, sign: '-', color: UI_COLORS.red });
    rows.push({ label: t.perfect, detail: s.perfect ? '' : 'NO', value: s.perfectBonus, sign: s.perfect ? '+' : '', color: s.perfect ? UI_COLORS.green : UI_COLORS.gray });
    rows.push({ label: t.blockScore, detail: '', value: s.blockScore, sign: '', color: UI_COLORS.yellow });
    rows.push({ label: t.total, detail: '', value: s.run.score, sign: '', color: UI_COLORS.yellow });

    let y = 56;
    rows.forEach((row, i) => {
      addText(this, 70, y, row.label, { color: UI_COLORS.cream });
      if (row.detail) addText(this, 300, y, row.detail, { color: UI_COLORS.gray, origin: [1, 0] });
      const valueText = addText(this, GAME_WIDTH - 70, y, row.label === t.perfect && !s.perfect ? '-' : `${row.sign}0`, {
        color: row.color,
        origin: [1, 0],
      });
      if (!(row.label === t.perfect && !s.perfect)) {
        this.tweens.addCounter({
          from: 0,
          to: row.value,
          delay: 150 + i * 140,
          duration: 420,
          onUpdate: (tw) => valueText.setText(`${row.sign}${formatThousands(Math.round(tw.getValue() ?? 0))}`),
        });
      }
      y += i === rows.length - 3 ? 17 : 13;
    });

    const recordLine = s.isNewRecord ? t.newRecord : `${t.record}: ${formatThousands(s.bestScore)}`;
    const rec = addText(this, cx, y + 4, recordLine, { color: s.isNewRecord ? UI_COLORS.green : UI_COLORS.celeste, origin: [0.5, 0] });
    if (s.isNewRecord) this.tweens.add({ targets: rec, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
    if (s.run.blocksCompleted === DESIGNED_BLOCKS) addText(this, cx, y + 16, t.neighborhoodDone, { color: UI_COLORS.yellow, origin: [0.5, 0] });

    const nextBlock = getBlock(s.run.blockIndex + 1);
    const next = new Button(this, cx, 202, `${t.next}: ${nextBlock.toStreet}`, { width: 220, height: 18, onClick: () => this.nextBlock() });
    const replay = new Button(this, cx, 223, t.replay, { width: 220, height: 18, onClick: () => this.replay() });
    const menu = new Button(this, cx, 244, t.menu, { width: 220, height: 18, onClick: () => this.toMenu() });
    new ButtonMenu(this, [{ button: next }, { button: replay }, { button: menu }], { onBack: () => this.toMenu() });
  }

  private nextBlock(): void {
    const run = { ...this.summary.run, blockIndex: this.summary.run.blockIndex + 1 };
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run });
  }

  private replay(): void {
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run: createRun() });
  }

  private toMenu(): void {
    this.scene.stop(SCENES.GAME);
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.MENU);
  }
}
