import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_WIDTH, LAYOUT, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { formatTime } from '../core/LevelClock';
import type { GameMode } from '../core/leaderboard';
import { formatThousands } from '../core/math';
import { barrioProgressPercent, barrioStars, isLevelUnlocked, isTimeTrialUnlocked, levelProgress } from '../core/progress';
import { recordsRepo } from '../core/recordsRepository';
import { saveStore } from '../core/save';
import { getBarrio, type BarrioDef } from '../data/campaign';
import { getEnvironment } from '../data/environments';
import { addIcon, addPanelImage } from '../graphics/textures/uiTextures';
import { ICON_FRAMES, TEX } from '../graphics/keys';
import { isTouchPrimary } from '../input/device';
import { Button } from '../ui/Button';
import { addText } from '../ui/text';
import { THEMES } from '../world/themes';
import { uniqueKeyEvents } from '../input/keyEvents';

const CARD_W = 140;
const CARD_H = 104;
const CARD_Y = 168;
const BUTTONS_Y = 240;

interface Card {
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Image;
  unlocked: boolean;
  completed: boolean;
  levelId: string;
  recordText?: Phaser.GameObjects.BitmapText;
  timeText?: Phaser.GameObjects.BitmapText;
}

export interface BarrioSceneData {
  barrioId?: string;
  focus?: number;
  mode?: GameMode;
}

/**
 * Pantalla de un barrio: sus tres niveles, estrellas, récords y progreso.
 * Desde acá se elige la modalidad (NORMAL o CONTRARRELOJ, ésta sólo en
 * niveles ya completados) y se abre el ranking del nivel.
 */
export class BarrioScene extends Phaser.Scene {
  private barrio!: BarrioDef;
  private cards: Card[] = [];
  private focus = 0;
  private requestedFocus: number | null = null;
  private mode: GameMode = 'normal';
  private cursor!: Phaser.GameObjects.Image;
  private modeBtn!: Button;
  private rankBtn!: Button;
  private toast?: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENES.BARRIO);
  }

  init(data: BarrioSceneData): void {
    this.barrio = getBarrio(data?.barrioId ?? 'san-telmo') ?? getBarrio('san-telmo')!;
    this.cards = [];
    this.mode = data?.mode ?? 'normal';
    this.requestedFocus = typeof data?.focus === 'number' ? data.focus : null;
    this.toast = undefined;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const save = saveStore.get();
    this.cameras.main.setBackgroundColor('#1d1424');
    this.drawPostcard();

    addText(this, cx, 6, this.barrio.name, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    const { stars, max } = barrioStars(save, this.barrio);
    addText(this, cx, 98, `${TEXTS2.barrio.progress} ${barrioProgressPercent(save, this.barrio)}% · ${TEXTS2.results.stars} ${stars}/${max}`, { color: UI_COLORS.cream, origin: [0.5, 0] });
    if (this.barrio.provisional) addText(this, cx, 108, TEXTS2.map.provisional, { outline: false, color: UI_COLORS.orange, origin: [0.5, 0] });

    // Primer nivel sin completar (o el último) queda enfocado.
    let first = this.barrio.levels.findIndex((l, i) => isLevelUnlocked(save, { barrioId: this.barrio.id, levelIndex: i }) && !levelProgress(save, l.id).completed);
    if (first < 0) first = 0;
    if (this.requestedFocus !== null && this.requestedFocus < this.barrio.levels.length) first = this.requestedFocus;
    this.barrio.levels.forEach((_, i) => this.buildCard(i));
    this.cursor = addIcon(this, 0, 0, ICON_FRAMES.arrowDown).setDepth(10);
    this.tweens.add({ targets: this.cursor, y: '+=3', duration: 320, yoyo: true, repeat: -1 });

    const t = TEXTS2.barrio;
    new Button(this, cx - 150, BUTTONS_Y, t.back, { width: 136, height: 17, depth: 5, onClick: () => this.toMap() });
    this.modeBtn = new Button(this, cx, BUTTONS_Y, '', { width: 150, height: 17, depth: 5, onClick: () => this.toggleMode() });
    this.rankBtn = new Button(this, cx + 150, BUTTONS_Y, `${TEXTS2.ranking.open} (R)`, { width: 136, height: 17, depth: 5, onClick: () => this.openRanking() });
    if (!isTouchPrimary()) addText(this, cx, 254, t.keysHint, { outline: false, color: 0x8a7f96, origin: [0.5, 0] });
    this.setFocus(first, false);

    this.input.keyboard?.on('keydown', uniqueKeyEvents((e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setFocus(this.focus - 1, true);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setFocus(this.focus + 1, true);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') this.choose(this.focus);
      else if (e.code === 'KeyM' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') this.toggleMode();
      else if (e.code === 'KeyR') this.openRanking();
      else if (e.code === 'Escape' || e.code === 'Backspace') this.toMap();
    }));
    audio.playMusic('menu');
    this.cameras.main.fadeIn(220, 18, 12, 24);
  }

  /** Ilustración provisional: una postal armada con las fachadas del barrio. */
  private drawPostcard(): void {
    const theme = THEMES[this.barrio.theme] ?? THEMES['san-telmo'];
    const w = 300;
    const h = 62;
    const rt = this.add.renderTexture(GAME_WIDTH / 2, 58, w, h);
    rt.fill(0x8fd0f2);
    rt.draw(TEX.skyline, -40, h - 100);
    let x = -18;
    const ids = [theme.cornerStartId, ...theme.facadeIds.slice(0, 3)];
    for (const id of ids) {
      const tex = this.textures.get(TEX.facade(id));
      const img = tex.getSourceImage() as HTMLCanvasElement;
      rt.draw(TEX.facade(id), x, h + 18 - img.height);
      x += img.width;
    }
    for (let sx = 0; sx < w; sx += 64) rt.draw(TEX.sidewalk, sx, h - 12);
    const frame = addPanelImage(this, GAME_WIDTH / 2, 58, w + 10, h + 10);
    frame.setDepth(-1);
    void LAYOUT;
  }

  private buildCard(i: number): void {
    const save = saveStore.get();
    const level = this.barrio.levels[i];
    const env = getEnvironment(level.environment);
    const ref = { barrioId: this.barrio.id, levelIndex: i };
    const unlocked = isLevelUnlocked(save, ref);
    const lp = levelProgress(save, level.id);
    const x = GAME_WIDTH / 2 + (i - 1) * (CARD_W + 10);
    const frame = addPanelImage(this, 0, 0, CARD_W, CARD_H);
    const parts: Phaser.GameObjects.GameObject[] = [frame];
    const top = -CARD_H / 2;
    const icon = env.id === 'night' ? ICON_FRAMES.moon : env.id === 'autumn' ? ICON_FRAMES.leaf : ICON_FRAMES.sun;
    const card: Card = { container: undefined as never, frame, unlocked, completed: unlocked && isTimeTrialUnlocked(save, level.id), levelId: level.id };
    parts.push(addText(this, -CARD_W / 2 + 10, top + 8, `${TEXTS2.barrio.level} ${level.number}`, { color: UI_COLORS.yellow }));
    parts.push(addIcon(this, CARD_W / 2 - 16, top + 12, icon));
    parts.push(addText(this, CARD_W / 2 - 26, top + 8, env.label, { color: UI_COLORS.cream, origin: [1, 0] }));
    parts.push(addText(this, 0, top + 24, level.name, { color: UI_COLORS.white, origin: [0.5, 0], align: 'center', maxWidth: CARD_W - 16 }));
    if (unlocked) {
      for (let s = 0; s < 3; s++) {
        parts.push(addIcon(this, (s - 1) * 18, top + 58, s < lp.stars ? ICON_FRAMES.star : ICON_FRAMES.starEmpty));
      }
      card.recordText = addText(this, 0, top + 72, '', { origin: [0.5, 0] });
      parts.push(card.recordText);
      parts.push(addIcon(this, -44, top + 90, ICON_FRAMES.clock));
      card.timeText = addText(this, -36, top + 86, '', { outline: false });
      parts.push(card.timeText);
    } else {
      parts.push(this.add.rectangle(0, 12, CARD_W - 8, CARD_H - 44, 0x120c18, 0.5));
      parts.push(addIcon(this, 0, 2, ICON_FRAMES.lock, 2));
      parts.push(addText(this, 0, 22, TEXTS2.barrio.locked, { color: UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: CARD_W - 20 }));
    }
    if (card.completed) {
      parts.push(addIcon(this, CARD_W / 2 - 12, CARD_H / 2 - 12, ICON_FRAMES.check));
    }
    card.container = this.add.container(Math.round(x), CARD_Y, parts);
    if (!unlocked) card.container.setAlpha(0.85);
    frame.setInteractive({ useHandCursor: true });
    frame.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.setFocus(i, true));
    frame.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.choose(i));
    this.cards.push(card);
  }

  /** La contrarreloj sólo se habilita en niveles ya completados en modo normal. */
  private modeFor(i: number): GameMode {
    return this.mode === 'timeTrial' && this.cards[i]?.completed ? 'timeTrial' : 'normal';
  }

  /** Actualiza el contenido de las tarjetas y los botones según la modalidad. */
  private refreshMode(): void {
    const save = saveStore.get();
    const me = saveStore.activeProfile().id;
    const t = TEXTS2.barrio;
    this.cards.forEach((card, i) => {
      if (!card.recordText || !card.timeText) return;
      const mode = this.modeFor(i);
      const best = recordsRepo.personalBest(card.levelId, mode, me).time;
      if (mode === 'timeTrial') {
        card.recordText.setText(t.timeTrial).setTint(UI_COLORS.orange);
        card.frame.setTint(i === this.focus ? 0xffd2a0 : 0xffe2c4);
      } else {
        const lp = levelProgress(save, card.levelId);
        card.recordText.setText(lp.bestScore > 0 ? `${t.record} ${formatThousands(lp.bestScore)}` : t.noRecord).setTint(lp.bestScore > 0 ? UI_COLORS.celeste : UI_COLORS.gray);
        card.frame.setTint(i === this.focus ? 0xfff0b0 : 0xffffff);
      }
      card.timeText.setText(formatTime(best?.timeMs ?? null)).setTint(best ? UI_COLORS.white : UI_COLORS.gray);
    });
    const focused = this.cards[this.focus];
    const label = this.modeFor(this.focus) === 'timeTrial' ? t.timeTrial : t.normal;
    this.modeBtn.setText(`${t.mode} (M): ${label}`);
    this.modeBtn.setEnabled(!!focused?.completed);
    this.rankBtn.setEnabled(!!focused?.unlocked);
  }

  private setFocus(i: number, sound: boolean): void {
    const n = this.cards.length;
    const next = ((i % n) + n) % n;
    if (sound && next !== this.focus) audio.play('click');
    this.focus = next;
    this.cards.forEach((c, k) => {
      c.frame.setTint(k === next ? 0xfff0b0 : 0xffffff);
      c.container.setY(CARD_Y - (k === next ? 3 : 0));
    });
    const c = this.cards[next].container;
    this.cursor.setPosition(c.x, c.y - CARD_H / 2 - 8);
    this.refreshMode();
  }

  private toggleMode(): void {
    if (!this.cards[this.focus]?.completed) {
      audio.play('lifeLost');
      this.showToast(TEXTS2.barrio.timeTrialLocked);
      return;
    }
    this.mode = this.mode === 'normal' ? 'timeTrial' : 'normal';
    audio.play('click');
    this.refreshMode();
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    const toast = addText(this, GAME_WIDTH / 2, 226, text, { color: UI_COLORS.orange, origin: [0.5, 0.5], depth: 20 });
    this.toast = toast;
    this.tweens.add({ targets: toast, alpha: 0, delay: 1300, duration: 300, onComplete: () => toast.destroy() });
  }

  private openRanking(): void {
    const card = this.cards[this.focus];
    if (!card?.unlocked) {
      audio.play('lifeLost');
      return;
    }
    audio.play('select');
    const mode = this.modeFor(this.focus);
    this.scene.start(SCENES.LEADERBOARD, {
      levelRef: { barrioId: this.barrio.id, levelIndex: this.focus },
      mode,
      tab: 'speed',
      back: { scene: SCENES.BARRIO, data: { barrioId: this.barrio.id, focus: this.focus, mode: this.mode } },
    });
  }

  private choose(i: number): void {
    if (!this.cards[i]?.unlocked) {
      audio.play('lifeLost');
      this.tweens.add({ targets: this.cards[i].container, x: '+=4', duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    audio.play('select');
    this.scene.start(SCENES.CHARACTER, { levelRef: { barrioId: this.barrio.id, levelIndex: i }, mode: this.modeFor(i) });
  }

  private toMap(): void {
    audio.play('click');
    this.scene.start(SCENES.WORLD_MAP, { focus: this.barrio.id });
  }
}
