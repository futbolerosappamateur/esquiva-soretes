import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { formatThousands } from '../core/math';
import { barrioProgressPercent, barrioStars, isLevelUnlocked, levelProgress } from '../core/progress';
import { saveStore } from '../core/save';
import { getBarrio, type BarrioDef } from '../data/campaign';
import { getEnvironment } from '../data/environments';
import { ensurePanelTexture } from '../graphics/textures/uiTextures';
import { ICON_FRAMES, TEX } from '../graphics/keys';
import { Button } from '../ui/Button';
import { addText } from '../ui/text';
import { THEMES } from '../world/themes';

const CARD_W = 140;
const CARD_H = 104;
const CARD_Y = 168;

/** Pantalla de un barrio: sus tres niveles, estrellas, récords y progreso. */
export class BarrioScene extends Phaser.Scene {
  private barrio!: BarrioDef;
  private cards: { container: Phaser.GameObjects.Container; frame: Phaser.GameObjects.Image; unlocked: boolean }[] = [];
  private focus = 0;
  private cursor!: Phaser.GameObjects.Image;

  constructor() {
    super(SCENES.BARRIO);
  }

  init(data: { barrioId?: string }): void {
    this.barrio = getBarrio(data?.barrioId ?? 'san-telmo') ?? getBarrio('san-telmo')!;
    this.cards = [];
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
    this.barrio.levels.forEach((_, i) => this.buildCard(i));
    this.cursor = this.add.image(0, 0, TEX.icons, ICON_FRAMES.arrowDown).setDepth(10);
    this.tweens.add({ targets: this.cursor, y: '+=3', duration: 320, yoyo: true, repeat: -1 });
    this.setFocus(first, false);

    const back = new Button(this, cx, GAME_HEIGHT - 12, TEXTS2.barrio.back, { width: 150, height: 17, onClick: () => this.toMap() });
    back.container.setDepth(5);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setFocus(this.focus - 1, true);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setFocus(this.focus + 1, true);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') this.choose(this.focus);
      else if (e.code === 'Escape' || e.code === 'Backspace') this.toMap();
    });
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
    const frame = this.add.image(GAME_WIDTH / 2, 58, ensurePanelTexture(this.textures, w + 10, h + 10));
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
    const frame = this.add.image(0, 0, ensurePanelTexture(this.textures, CARD_W, CARD_H));
    const parts: Phaser.GameObjects.GameObject[] = [frame];
    const top = -CARD_H / 2;
    const icon = env.id === 'night' ? ICON_FRAMES.moon : env.id === 'autumn' ? ICON_FRAMES.leaf : ICON_FRAMES.sun;
    parts.push(addText(this, -CARD_W / 2 + 10, top + 8, `${TEXTS2.barrio.level} ${level.number}`, { color: UI_COLORS.yellow }));
    parts.push(this.add.image(CARD_W / 2 - 16, top + 12, TEX.icons, icon));
    parts.push(addText(this, CARD_W / 2 - 26, top + 8, env.label, { color: UI_COLORS.cream, origin: [1, 0] }));
    parts.push(addText(this, 0, top + 24, level.name, { color: UI_COLORS.white, origin: [0.5, 0], align: 'center', maxWidth: CARD_W - 16 }));
    if (unlocked) {
      for (let s = 0; s < 3; s++) {
        parts.push(this.add.image((s - 1) * 18, top + 58, TEX.icons, s < lp.stars ? ICON_FRAMES.star : ICON_FRAMES.starEmpty));
      }
      parts.push(
        addText(this, 0, top + 72, lp.bestScore > 0 ? `${TEXTS2.barrio.record} ${formatThousands(lp.bestScore)}` : TEXTS2.barrio.noRecord, {
          color: lp.bestScore > 0 ? UI_COLORS.celeste : UI_COLORS.gray,
          origin: [0.5, 0],
        }),
      );
      parts.push(addText(this, 0, top + 86, `${level.blocks.length} ${TEXTS2.barrio.blocks}`, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] }));
    } else {
      parts.push(this.add.rectangle(0, 12, CARD_W - 8, CARD_H - 44, 0x120c18, 0.5));
      parts.push(this.add.image(0, 2, TEX.icons, ICON_FRAMES.lock).setScale(2));
      parts.push(addText(this, 0, 22, TEXTS2.barrio.locked, { color: UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: CARD_W - 20 }));
    }
    if (unlocked && lp.completed) {
      parts.push(this.add.image(CARD_W / 2 - 12, CARD_H / 2 - 12, TEX.icons, ICON_FRAMES.check));
    }
    const container = this.add.container(Math.round(x), CARD_Y, parts);
    if (!unlocked) container.setAlpha(0.85);
    frame.setInteractive({ useHandCursor: true });
    frame.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.setFocus(i, true));
    frame.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.choose(i));
    this.cards.push({ container, frame, unlocked });
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
  }

  private choose(i: number): void {
    if (!this.cards[i]?.unlocked) {
      audio.play('lifeLost');
      this.tweens.add({ targets: this.cards[i].container, x: '+=4', duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    audio.play('select');
    this.scene.start(SCENES.CHARACTER, { levelRef: { barrioId: this.barrio.id, levelIndex: i } });
  }

  private toMap(): void {
    audio.play('click');
    this.scene.start(SCENES.WORLD_MAP, { focus: this.barrio.id });
  }
}
