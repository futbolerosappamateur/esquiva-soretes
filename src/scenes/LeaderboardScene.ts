import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { formatTime } from '../core/LevelClock';
import type { GameMode, RecordEntry } from '../core/leaderboard';
import { formatThousands } from '../core/math';
import { isTimeTrialUnlocked } from '../core/progress';
import { recordsRepo } from '../core/recordsRepository';
import { saveStore } from '../core/save';
import { getLevel, type LevelRef } from '../data/campaign';
import { getCharacter } from '../data/characters';
import { Button } from '../ui/Button';
import { addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import { uniqueKeyEvents } from '../input/keyEvents';

type Tab = 'speed' | 'score' | 'character';
const TABS: Tab[] = ['speed', 'score', 'character'];

export interface LeaderboardData {
  levelRef: LevelRef;
  mode?: GameMode;
  tab?: Tab;
  /** Escena a la que vuelve (con sus datos). */
  back?: { scene: string; data?: object };
}

/**
 * Clasificaciones de un nivel (locales: los récords guardados en este
 * dispositivo). Velocidad de menor a mayor tiempo, puntos de mayor a menor,
 * y el mejor tiempo de cada personaje. Nada precargado: sólo partidas reales.
 */
export class LeaderboardScene extends Phaser.Scene {
  private data0!: LeaderboardData;
  private mode: GameMode = 'normal';
  private tab: Tab = 'speed';
  private rows: Phaser.GameObjects.GameObject[] = [];
  private tabTexts: Phaser.GameObjects.BitmapText[] = [];
  private modeText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENES.LEADERBOARD);
  }

  init(data: LeaderboardData): void {
    this.data0 = data;
    this.mode = data.mode ?? 'normal';
    this.tab = data.tab ?? 'speed';
    this.rows = [];
    this.tabTexts = [];
  }

  private get timeTrialAvailable(): boolean {
    const found = getLevel(this.data0.levelRef);
    return !!found && isTimeTrialUnlocked(saveStore.get(), found.level.id);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.ranking;
    this.cameras.main.setBackgroundColor('#1d1424');
    addPanel(this, cx, 135, 440, 258);
    const found = getLevel(this.data0.levelRef);
    addText(this, cx, 10, found ? `${TEXTS2.barrio.level} ${found.level.number} — ${found.barrio.name}` : t.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    this.modeText = addText(this, cx, 30, '', { color: UI_COLORS.orange, origin: [0.5, 0] });

    TABS.forEach((tab, i) => {
      const x = cx + (i - 1) * 120;
      const txt = addText(this, x, 44, t.tabs[tab], { color: UI_COLORS.cream, origin: [0.5, 0] }).setInteractive({ useHandCursor: true });
      txt.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.setTab(tab));
      this.tabTexts.push(txt);
    });
    const modeBtn = new Button(this, cx - 80, GAME_HEIGHT - 16, t.switchMode, { width: 140, height: 17, onClick: () => this.toggleMode() });
    modeBtn.setEnabled(this.timeTrialAvailable);
    new Button(this, cx + 80, GAME_HEIGHT - 16, t.back, { width: 140, height: 17, onClick: () => this.back() });
    addText(this, cx, GAME_HEIGHT - 31, t.localNote, { outline: false, color: 0x8a7f96, origin: [0.5, 0] });

    this.input.keyboard?.on('keydown', uniqueKeyEvents((e: KeyboardEvent) => {
      const i = TABS.indexOf(this.tab);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setTab(TABS[(i + 2) % 3]);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setTab(TABS[(i + 1) % 3]);
      else if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyM' || e.code === 'Tab') this.toggleMode();
      else if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'Enter') this.back();
    }));
    this.render();
  }

  private setTab(tab: Tab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    audio.play('click');
    this.render();
  }

  private toggleMode(): void {
    if (!this.timeTrialAvailable) return;
    this.mode = this.mode === 'normal' ? 'timeTrial' : 'normal';
    audio.play('click');
    this.render();
  }

  private render(): void {
    const t = TEXTS2.ranking;
    this.rows.forEach((o) => o.destroy());
    this.rows = [];
    this.tabTexts.forEach((txt, i) => txt.setTint(TABS[i] === this.tab ? UI_COLORS.yellow : UI_COLORS.gray));
    this.modeText.setText(`${t.mode}: ${this.mode === 'normal' ? 'NORMAL' : TEXTS2.hud.timeTrial}`);
    const found = getLevel(this.data0.levelRef);
    if (!found) return;
    const id = found.level.id;
    const me = saveStore.activeProfile().id;
    let list: RecordEntry[];
    if (this.tab === 'speed') list = recordsRepo.speedRanking(id, this.mode);
    else if (this.tab === 'score') list = recordsRepo.scoreRanking(id, this.mode);
    else list = recordsRepo.bestByCharacter(id, this.mode);
    const header = this.tab === 'score' ? t.headerScore : t.headerTime;
    const hx = [44, 70, 170, GAME_WIDTH - 44];
    this.rows.push(addText(this, hx[1], 60, t.player, { outline: false, color: UI_COLORS.gray }));
    this.rows.push(addText(this, hx[2], 60, t.character, { outline: false, color: UI_COLORS.gray }));
    this.rows.push(addText(this, hx[3], 60, header, { outline: false, color: UI_COLORS.gray, origin: [1, 0] }));
    if (list.length === 0) {
      this.rows.push(addText(this, GAME_WIDTH / 2, 120, t.empty, { color: UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: 360 }));
      return;
    }
    list.forEach((e, i) => {
      const y = 72 + i * 14;
      const mine = e.profileId === me;
      const color = i === 0 ? UI_COLORS.yellow : mine ? UI_COLORS.celeste : UI_COLORS.white;
      const charName = e.characterId === 'desconocido' ? '-' : getCharacter(e.characterId).name;
      const value = this.tab === 'score' ? formatThousands(e.score) + (e.assisted ? '*' : '') : formatTime(e.timeMs);
      this.rows.push(addText(this, hx[0], y, `${i + 1}.`, { color, origin: [1, 0] }));
      this.rows.push(addText(this, hx[1], y, e.nickname, { color }));
      this.rows.push(addText(this, hx[2], y, charName, { outline: false, color: mine ? UI_COLORS.celeste : UI_COLORS.cream }));
      this.rows.push(addText(this, hx[3], y, value, { color, origin: [1, 0] }));
    });
    if (this.tab === 'score' && list.some((e) => e.assisted)) {
      this.rows.push(addText(this, GAME_WIDTH / 2, 72 + list.length * 14 + 2, t.assistedNote, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] }));
    }
  }

  private back(): void {
    audio.play('click');
    const b = this.data0.back;
    if (b) this.scene.start(b.scene, b.data);
    else this.scene.start(SCENES.BARRIO, { barrioId: this.data0.levelRef.barrioId });
  }
}
