import Phaser from 'phaser';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { formatThousands } from '../core/math';
import { barrioStars, levelProgress } from '../core/progress';
import { records } from '../core/records';
import { saveStore } from '../core/save';
import { BARRIOS } from '../data/campaign';
import { ICON_FRAMES } from '../graphics/keys';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import { addIcon } from '../graphics/textures/uiTextures';

/** Récords personales y estadísticas (superpuesta al menú). */
export class RecordsScene extends Phaser.Scene {
  private from: string = SCENES.MENU;

  constructor() {
    super(SCENES.RECORDS);
  }

  init(data: { from?: string }): void {
    this.from = data?.from ?? SCENES.MENU;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.records;
    const r = records.get();
    const save = saveStore.get();
    addDim(this, 0.6);
    addPanel(this, cx, 135, 400, 256);
    addText(this, cx, 14, t.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });

    const playable = BARRIOS.filter((b) => b.levels.length > 0);
    const totalStars = playable.reduce((acc, b) => acc + barrioStars(save, b).stars, 0);
    const rows: [string, string][] = [
      [t.best, formatThousands(r.bestScore)],
      [t.coins, formatThousands(save.wallet.coins)],
      [t.levels, `${save.stats.levelsCompleted}`],
      [t.stars, `${totalStars}/${playable.length * 9}`],
      [t.played, formatThousands(r.gamesPlayed)],
      [t.dodged, formatThousands(r.totalDodged)],
    ];
    rows.forEach(([label, value], i) => {
      const y = 38 + i * 12;
      addText(this, 60, y, label, { color: UI_COLORS.cream });
      addText(this, GAME_WIDTH - 60, y, value, { color: i === 0 ? UI_COLORS.yellow : UI_COLORS.white, origin: [1, 0] });
    });

    let y = 116;
    for (const b of playable) {
      addText(this, 60, y, b.name, { color: UI_COLORS.yellow });
      y += 11;
      b.levels.forEach((l) => {
        const lp = levelProgress(save, l.id);
        addText(this, 70, y, `NIVEL ${l.number}`, { color: UI_COLORS.cream });
        for (let s = 0; s < 3; s++) addIcon(this, 150 + s * 10, y + 4, s < lp.stars ? ICON_FRAMES.starSmall : ICON_FRAMES.starSmallEmpty);
        addText(this, GAME_WIDTH - 60, y, lp.bestScore > 0 ? formatThousands(lp.bestScore) : '-', { color: UI_COLORS.white, origin: [1, 0] });
        y += 10;
      });
      y += 3;
    }

    const back = new Button(this, cx, 248, t.back, { width: 130, height: 17, onClick: () => this.close() });
    new ButtonMenu(this, [{ button: back }], { onBack: () => this.close() });
  }

  private close(): void {
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
