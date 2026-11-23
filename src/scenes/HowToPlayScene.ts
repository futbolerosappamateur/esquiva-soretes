import Phaser from 'phaser';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS } from '../config/texts';
import { OBSTACLE_TYPES, type ObstacleTypeId } from '../entities/obstacles/ObstacleTypes';
import { ANIM } from '../graphics/animations';
import { FX_FRAMES, TEX } from '../graphics/keys';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { fitToTexture } from '../graphics/renderScale';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';

const ICONS: ObstacleTypeId[] = ['poop', 'giant', 'camo', 'looseTile'];

const PAGES = 4;

/** Instrucciones: controles, obstáculos y puntos, cruces/monedas/checkpoints, y poderes/tiempo/récords. */
export class HowToPlayScene extends Phaser.Scene {
  private page = 0;
  private from: string = SCENES.MENU;
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private pageButton!: Button;
  private subtitle!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENES.HOW_TO);
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? SCENES.MENU;
    this.page = 0;
    this.pageObjects = [];
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    addDim(this, 0.6);
    addPanel(this, cx, 135, 424, 244);
    addText(this, cx, 18, TEXTS.howTo.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    this.subtitle = addText(this, cx, 44, '', { color: UI_COLORS.celeste, origin: [0.5, 0] });

    this.pageButton = new Button(this, cx - 66, 236, TEXTS.howTo.next, { width: 116, height: 18, onClick: () => this.setPage((this.page + 1) % PAGES) });
    const back = new Button(this, cx + 66, 236, TEXTS.howTo.back, { width: 116, height: 18, onClick: () => this.close() });
    const adjust = (d: -1 | 1) => this.setPage((this.page + d + PAGES) % PAGES);
    new ButtonMenu(this, [{ button: this.pageButton, onAdjust: adjust }, { button: back, onAdjust: adjust }], {
      onBack: () => this.close(),
    });
    this.renderPage();
  }

  private setPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.renderPage();
  }

  private keep<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.pageObjects.push(obj);
    return obj;
  }

  private renderPage(): void {
    this.pageObjects.forEach((o) => o.destroy());
    this.pageObjects = [];
    this.pageButton.setText(this.page < PAGES - 1 ? `${TEXTS.howTo.next} ${this.page + 1}/${PAGES}` : TEXTS.howTo.prev);
    if (this.page === 0) this.renderControls();
    else if (this.page === 1) this.renderObstacles();
    else if (this.page === 2) this.renderStreets();
    else this.renderPowers();
  }

  private renderControls(): void {
    const cx = GAME_WIDTH / 2;
    this.subtitle.setText(TEXTS.howTo.pageControls);
    this.keep(addText(this, cx, 60, TEXTS.howTo.goal, { color: UI_COLORS.cream, origin: [0.5, 0] }));
    TEXTS.howTo.keyboard.forEach(([key, action], i) => {
      const y = 74 + i * 11;
      this.keep(addText(this, 58, y, key, { color: UI_COLORS.yellow }));
      this.keep(addText(this, 124, y, action, { color: UI_COLORS.white }));
    });
    this.keep(addText(this, cx, 166, TEXTS.howTo.ghosting, { color: UI_COLORS.orange, origin: [0.5, 0], align: 'center', maxWidth: 380 }));
    this.keep(addText(this, cx, 184, TEXTS.howTo.touch, { color: UI_COLORS.celeste, origin: [0.5, 0], align: 'center', maxWidth: 380 }));
    this.keep(addText(this, cx, 208, 'TIP: EL MOVIMIENTO VERTICAL ES PROFUNDIDAD, NO UN SALTO.', { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] }));

    const shadow = this.keep(this.add.image(390, 150, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3));
    const runner = this.keep(fitToTexture(this.add.sprite(390, 150, TEX.player(0), 'run0').setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY)));
    runner.play(ANIM.player(0, 'run'));
    void shadow;
  }

  private renderObstacles(): void {
    const cx = GAME_WIDTH / 2;
    this.subtitle.setText(TEXTS.howTo.pageObstacles);
    TEXTS.howTo.obstacles.forEach(([name, desc], i) => {
      const y = 60 + i * 25;
      const def = OBSTACLE_TYPES[ICONS[i]];
      const v = def.variants[0];
      this.keep(this.add.image(78, y + 10, v.texture, v.frame).setOrigin(0.5, 0.5));
      if (ICONS[i] === 'camo') this.keep(this.add.image(78, y + 13, TEX.leafCover).setOrigin(0.5, 0.5));
      this.keep(addText(this, 104, y, name, { color: UI_COLORS.yellow }));
      this.keep(addText(this, 104, y + 10, desc, { color: UI_COLORS.white }));
    });
    TEXTS.howTo.scoring.forEach((line, i) => {
      this.keep(addText(this, cx, 166 + i * 12, line, { color: UI_COLORS.celeste, origin: [0.5, 0] }));
    });
  }

  private renderStreets(): void {
    this.subtitle.setText(TEXTS.howTo.pageStreets);
    TEXTS.howTo.streets.forEach(([name, desc], i) => {
      // Algunas descripciones ocupan dos renglones: un poco más de aire entre ítems.
      const y = 58 + i * 34;
      this.keep(addText(this, 40, y, name, { color: UI_COLORS.yellow }));
      this.keep(addText(this, 40, y + 10, desc, { color: UI_COLORS.white, maxWidth: 400 }));
    });
  }

  private renderPowers(): void {
    this.subtitle.setText(TEXTS.howTo.pagePowers);
    TEXTS.howTo.powers.forEach(([name, desc], i) => {
      const y = 58 + i * 27;
      this.keep(addText(this, 40, y, name, { color: UI_COLORS.yellow }));
      this.keep(addText(this, 40, y + 10, desc, { color: UI_COLORS.white, maxWidth: 400 }));
    });
  }

  private close(): void {
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
