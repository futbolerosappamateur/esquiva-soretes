import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { formatDelta, formatTime } from '../core/LevelClock';
import { formatThousands } from '../core/math';
import { isLevelUnlocked } from '../core/progress';
import { createRun } from '../core/RunState';
import { saveStore } from '../core/save';
import { getCharacter } from '../data/characters';
import { ICON_FRAMES, TEX } from '../graphics/keys';
import { Button } from '../ui/Button';
import { ButtonMenu, type MenuItem } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import type { LevelResult } from './GameScene';

/**
 * Resultados al completar un nivel: puntos, tiempo, récords (velocidad y
 * puntuación se evalúan por separado), estrellas, monedas y desbloqueos.
 */
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
    const timeTrial = r.mode === 'timeTrial';
    addDim(this, 0.6);
    addPanel(this, cx, 135, 420, 264);

    const title = addText(this, cx, 6, timeTrial ? t.timeTrialTitle : t.title, { scale: 2, color: timeTrial ? UI_COLORS.orange : UI_COLORS.green, origin: [0.5, 0] });
    this.tweens.add({ targets: title, y: 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addText(this, cx, 25, `${r.barrioName} · NIVEL ${r.levelNumber} · ${r.envLabel} · ${getCharacter(r.characterId).name}`, {
      outline: false,
      color: UI_COLORS.cream,
      origin: [0.5, 0],
    });

    // Estrellas (sólo modo normal: la campaña no cambia en contrarreloj).
    if (!timeTrial) {
      for (let i = 0; i < 3; i++) {
        const x = cx - 22 + i * 22;
        this.add.image(x, 44, TEX.icons, ICON_FRAMES.starEmpty).setScale(1.5);
        if (i < r.stars) {
          const star = this.add.image(x, 44, TEX.icons, ICON_FRAMES.star).setScale(0);
          this.tweens.add({ targets: star, scale: 1.5, delay: 300 + i * 280, duration: 240, ease: 'Back.easeOut', onStart: () => audio.play('star', i) });
        }
      }
    }

    // Columna izquierda: puntos y tiempo.
    const lx = 40;
    let y = 58;
    addText(this, lx, y, t.score, { color: UI_COLORS.yellow });
    const total = addText(this, lx, y + 9, '0', { scale: 2, color: UI_COLORS.yellow });
    this.tweens.addCounter({ from: 0, to: r.score, duration: 800, delay: 200, onUpdate: (tw) => total.setText(formatThousands(Math.round(tw.getValue() ?? 0))) });
    y += 30;
    addText(this, lx, y, t.time, { color: UI_COLORS.celeste });
    addText(this, lx, y + 9, formatTime(r.timeMs), { scale: 2, color: r.newTimeRecord ? UI_COLORS.green : UI_COLORS.white });
    y += 30;
    const prev = r.previousBestTimeMs;
    addText(this, lx, y, `${t.bestTime}: ${formatTime(r.newTimeRecord ? r.timeMs : prev)}`, { outline: false, color: UI_COLORS.cream });
    if (prev !== null && !r.assisted) {
      const diff = r.timeMs - prev;
      addText(this, lx, y + 10, `${formatDelta(diff)} S`, { color: diff <= 0 ? UI_COLORS.green : UI_COLORS.red });
    }

    // Columna derecha: detalle.
    const rx = cx + 20;
    const rr = GAME_WIDTH - 40;
    const rows: [string, string, number][] = [
      [t.coins, `+${r.coinsRun + r.coinsFromStars}`, UI_COLORS.yellow],
      [t.shoes, `${r.shoesLeft}/3`, r.shoesLeft === 3 ? UI_COLORS.green : UI_COLORS.white],
      [t.dodged, `${r.dodged}`, UI_COLORS.white],
      [t.missions, `${r.missionsDone}`, UI_COLORS.white],
      [t.crossings, `+${formatThousands(r.crossingBonus)}`, UI_COLORS.green],
    ];
    if (!timeTrial) {
      // "VELOCIDAD: EXCELENTE" entra en la columna; "BONUS VELOCIDAD (EXCELENTE)" se pisaba con el valor.
      const label = r.speedRating ? `${TEXTS2.ranking.tabs.speed}: ${t.speedRating[r.speedRating]}` : t.speedBonus;
      rows.push([label, r.speedBonus > 0 ? `+${formatThousands(r.speedBonus)}` : '-', r.speedBonus > 0 ? UI_COLORS.green : UI_COLORS.gray]);
    }
    let ry = 58;
    rows.forEach(([label, value, color]) => {
      addText(this, rx, ry, label, { outline: false, color: UI_COLORS.cream });
      addText(this, rr, ry, value, { color, origin: [1, 0] });
      ry += 11;
    });

    // Mensajes de récords (independientes) y desbloqueos.
    const msgs: [string, number][] = [];
    if (r.newTimeRecord) {
      if (prev !== null) msgs.push([`${t.improvedBy} ${((prev - r.timeMs) / 1000).toFixed(1)} ${t.seconds}`, UI_COLORS.green]);
      msgs.push([t.newTimeRecord, UI_COLORS.green]);
    }
    if (r.newScoreRecord) msgs.push([t.newScoreRecord, UI_COLORS.yellow]);
    if (r.speedRank !== null && r.speedRank <= 10) msgs.push([`${t.rank} ${r.speedRank} · ${TEXTS2.ranking.tabs.speed}`, UI_COLORS.celeste]);
    if (r.assisted) msgs.push([t.assisted, UI_COLORS.gray]);
    r.unlockedCharacters.forEach((name) => msgs.push([`${t.unlocked}: ${name}`, UI_COLORS.green]));
    let my = 136;
    msgs.slice(0, 5).forEach(([text, color], i) => {
      const m = addText(this, cx, my, text, { outline: i < 2, color, origin: [0.5, 0], align: 'center', maxWidth: 400 });
      if (i === 0 && (r.newTimeRecord || r.newScoreRecord)) this.tweens.add({ targets: m, alpha: 0.4, duration: 380, yoyo: true, repeat: -1 });
      my += 11;
    });

    // Botones.
    const items: MenuItem[] = [];
    const make = (x: number, yy: number, label: string, onClick: () => void) => items.push({ button: new Button(this, x, yy, label, { width: 180, height: 18, onClick }) });
    const barrioDone = r.outcome?.barrioCompleted === true;
    const nextRef = { barrioId: r.ref.barrioId, levelIndex: r.ref.levelIndex + 1 };
    const hasNext = !timeTrial && !barrioDone && isLevelUnlocked(saveStore.get(), nextRef);
    if (timeTrial) {
      make(cx - 95, 214, t.retry, () => this.startLevel(r.ref.levelIndex));
      make(cx + 95, 214, t.ranking, () => this.toRanking());
      make(cx, 238, t.map, () => this.toMap());
    } else {
      if (barrioDone) make(cx - 95, 214, t.barrioDone, () => this.toBarrioComplete());
      else if (hasNext) make(cx - 95, 214, t.next, () => this.startLevel(nextRef.levelIndex));
      make(cx + 95, 214, t.retry, () => this.startLevel(r.ref.levelIndex));
      make(cx - 95, 238, t.ranking, () => this.toRanking());
      make(cx + 95, 238, t.map, () => this.toMap());
    }
    new ButtonMenu(this, items, { onBack: () => this.toMap() });
  }

  private stopGame(): void {
    this.scene.stop(SCENES.HUD);
    this.scene.stop(SCENES.GAME);
  }

  private startLevel(levelIndex: number): void {
    const r = this.result.run;
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run: createRun({ barrioId: this.result.ref.barrioId, levelIndex }, { mode: r.mode, characterId: r.characterId }) });
  }

  private toRanking(): void {
    this.stopGame();
    this.scene.start(SCENES.LEADERBOARD, {
      levelRef: this.result.ref,
      mode: this.result.mode,
      tab: 'speed',
      back: { scene: SCENES.BARRIO, data: { barrioId: this.result.barrioId, focus: this.result.ref.levelIndex, mode: this.result.mode } },
    });
  }

  private toBarrioComplete(): void {
    this.stopGame();
    this.scene.start(SCENES.BARRIO_COMPLETE, { barrioId: this.result.barrioId, unlocked: this.result.outcome?.unlockedBarrio ?? null });
  }

  private toMap(): void {
    this.stopGame();
    this.scene.start(SCENES.WORLD_MAP, { focus: this.result.barrioId });
  }
}
