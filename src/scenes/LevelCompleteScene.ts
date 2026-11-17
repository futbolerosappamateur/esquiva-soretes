import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { formatThousands } from '../core/math';
import { isLevelUnlocked } from '../core/progress';
import { createRun } from '../core/RunState';
import { saveStore } from '../core/save';
import { getBarrio } from '../data/campaign';
import { ICON_FRAMES, TEX } from '../graphics/keys';
import { Button } from '../ui/Button';
import { ButtonMenu, type MenuItem } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import type { LevelResult } from './GameScene';

/** Resultados al completar un nivel: estrellas, puntos, monedas y récord. */
export class LevelCompleteScene extends Phaser.Scene {
  private result!: LevelResult;

  constructor() {
    super(SCENES.LEVEL_COMPLETE);
  }

  init(data: LevelResult): void {
    this.result = data;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.results;
    const r = this.result;
    addDim(this, 0.6);
    addPanel(this, cx, 135, 404, 262);

    const title = addText(this, cx, 8, t.title, { scale: 2, color: UI_COLORS.green, origin: [0.5, 0] });
    this.tweens.add({ targets: title, y: 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addText(this, cx, 31, `${r.barrioName} · NIVEL ${r.levelNumber} · ${r.envLabel}`, { color: UI_COLORS.cream, origin: [0.5, 0] });

    // Estrellas que se llenan una por una.
    for (let i = 0; i < 3; i++) {
      const x = cx - 26 + i * 26;
      this.add.image(x, 48, TEX.icons, ICON_FRAMES.starEmpty).setScale(2);
      if (i < r.stars) {
        const star = this.add.image(x, 48, TEX.icons, ICON_FRAMES.star).setScale(0);
        this.tweens.add({
          targets: star,
          scale: 2,
          delay: 350 + i * 320,
          duration: 260,
          ease: 'Back.easeOut',
          onStart: () => audio.play('star', i),
        });
      }
    }
    addText(this, cx, 64, `2 ${t.stars}: ${formatThousands(r.thresholds.two)} · 3 ${t.stars}: ${formatThousands(r.thresholds.three)}`, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] });

    const coinsTotal = r.coinsRun + r.coinsFromStars;
    const rows: [string, string, number][] = [
      [t.distance, `${r.distanceM} M`, UI_COLORS.white],
      [t.dodged, `${r.dodged}`, UI_COLORS.white],
      [t.crossings, `+${formatThousands(r.crossingBonus)}`, UI_COLORS.green],
      [t.perfect, `${r.perfectBlocks}/${r.totalBlocks}`, r.perfectBlocks > 0 ? UI_COLORS.green : UI_COLORS.gray],
      [t.coins, `+${coinsTotal}`, UI_COLORS.yellow],
    ];
    let y = 78;
    rows.forEach(([label, value, color]) => {
      addText(this, 74, y, label, { color: UI_COLORS.cream });
      addText(this, GAME_WIDTH - 74, y, value, { color, origin: [1, 0] });
      y += 12;
    });
    addText(this, 74, y + 3, t.score, { color: UI_COLORS.yellow });
    const total = addText(this, GAME_WIDTH - 74, y + 1, '0', { scale: 2, color: UI_COLORS.yellow, origin: [1, 0] });
    this.tweens.addCounter({ from: 0, to: r.score, duration: 900, delay: 200, onUpdate: (tw) => total.setText(formatThousands(Math.round(tw.getValue() ?? 0))) });

    const recordLine = r.isNewRecord ? t.newRecord : `${t.record}: ${formatThousands(r.levelBest)}`;
    const rec = addText(this, cx, y + 22, recordLine, { color: r.isNewRecord ? UI_COLORS.green : UI_COLORS.celeste, origin: [0.5, 0] });
    if (r.isNewRecord) this.tweens.add({ targets: rec, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });

    const items: MenuItem[] = [];
    const make = (yy: number, label: string, onClick: () => void) => {
      const b = new Button(this, cx, yy, label, { width: 230, height: 17, onClick });
      items.push({ button: b });
    };
    const barrioDone = r.outcome?.barrioCompleted === true;
    const nextRef = { barrioId: r.ref.barrioId, levelIndex: r.ref.levelIndex + 1 };
    const hasNext = !barrioDone && isLevelUnlocked(saveStore.get(), nextRef);
    let by = 206;
    if (barrioDone) make(by, t.barrioDone, () => this.toBarrioComplete());
    else if (hasNext) make(by, `${t.next}`, () => this.startLevel(nextRef.levelIndex));
    by += 20;
    make(by, t.replay, () => this.startLevel(r.ref.levelIndex));
    by += 20;
    make(by, t.map, () => this.toMap());
    new ButtonMenu(this, items, { onBack: () => this.toMap() });
  }

  private stopGame(): void {
    this.scene.stop(SCENES.HUD);
    this.scene.stop(SCENES.GAME);
  }

  private startLevel(levelIndex: number): void {
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run: createRun({ barrioId: this.result.ref.barrioId, levelIndex }) });
  }

  private toBarrioComplete(): void {
    this.stopGame();
    this.scene.start(SCENES.BARRIO_COMPLETE, { barrioId: this.result.barrioId, unlocked: this.result.outcome?.unlockedBarrio ?? null });
  }

  private toMap(): void {
    this.stopGame();
    const barrio = getBarrio(this.result.barrioId);
    this.scene.start(SCENES.WORLD_MAP, { focus: barrio?.id });
  }
}
