import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { barrioStars } from '../core/progress';
import { saveStore } from '../core/save';
import { getBarrio } from '../data/campaign';
import { ANIM } from '../graphics/animations';
import { FX_FRAMES, ICON_FRAMES, TEX } from '../graphics/keys';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { fitToTexture } from '../graphics/renderScale';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addText } from '../ui/text';
import { addIcon } from '../graphics/textures/uiTextures';

/** Pantalla especial al completar los tres niveles de un barrio. */
export class BarrioCompleteScene extends Phaser.Scene {
  private barrioId = 'san-telmo';
  private unlocked: string | null = null;

  constructor() {
    super(SCENES.BARRIO_COMPLETE);
  }

  init(data: { barrioId?: string; unlocked?: string | null }): void {
    this.barrioId = data?.barrioId ?? 'san-telmo';
    this.unlocked = data?.unlocked ?? null;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.barrioDone;
    const barrio = getBarrio(this.barrioId);
    this.cameras.main.setBackgroundColor('#2a1d33');
    audio.play('victory');

    const title = addText(this, cx, 10, t.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    this.tweens.add({ targets: title, scale: { from: 0.8, to: 2 }, duration: 500, ease: 'Back.easeOut' });
    addText(this, cx, 34, barrio?.name ?? '', { scale: 3, color: UI_COLORS.white, origin: [0.5, 0] });

    const badge = addIcon(this, cx, 112, ICON_FRAMES.badge, 4);
    this.tweens.add({ targets: badge, angle: { from: -8, to: 8 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // El personaje festeja.
    const hero = fitToTexture(this.add.sprite(cx - 96, 178, TEX.player(0), 'win0').setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY), 2);
    hero.play(ANIM.player(0, 'win'));
    this.add.image(cx - 96, 178, TEX.fx, FX_FRAMES.shadow).setScale(2).setAlpha(0.3).setDepth(-1);

    if (barrio) {
      const { stars, max } = barrioStars(saveStore.get(), barrio);
      addIcon(this, cx + 54, 154, ICON_FRAMES.star, 2);
      addText(this, cx + 70, 146, `${stars}/${max}`, { scale: 2, color: UI_COLORS.yellow, origin: [0, 0] });
    }
    const next = this.unlocked ? getBarrio(this.unlocked) : null;
    addText(this, cx, 190, next ? `${t.unlocked}: ${next.name}` : t.last, { color: next ? UI_COLORS.green : UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: 400 });
    if (next) audio.play('unlock');

    // Papel picado.
    for (let i = 0; i < 40; i++) {
      const c = this.add.image(Math.random() * GAME_WIDTH, -10 - Math.random() * 120, TEX.fx, FX_FRAMES.confetti).setTint([0xffd23f, 0xff5a4e, 0x6fe07a, 0x8fd6ff, 0xd96f8f][i % 5]);
      this.tweens.add({ targets: c, y: GAME_HEIGHT + 10, x: c.x + (Math.random() * 40 - 20), angle: 360, duration: 2200 + Math.random() * 1800, delay: Math.random() * 1200, repeat: -1 });
    }

    const go = new Button(this, cx, 230, t.continue, { width: 160, height: 19, onClick: () => this.scene.start(SCENES.WORLD_MAP, { focus: this.barrioId }) });
    new ButtonMenu(this, [{ button: go }], { onBack: () => this.scene.start(SCENES.WORLD_MAP, { focus: this.barrioId }) });
    this.cameras.main.fadeIn(300, 18, 12, 24);
  }
}
