import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS, TEXTS2 } from '../config/texts';
import { saveStore } from '../core/save';
import { settings } from '../core/settings';
import { Button } from '../ui/Button';
import { ButtonMenu, type MenuItem } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import { toggleFullscreen } from './MenuScene';

/** Opciones de sonido, música y volumen (se guardan en LocalStorage al instante) y reinicio del progreso. */
export class OptionsScene extends Phaser.Scene {
  private from: string = SCENES.MENU;
  private menu!: ButtonMenu;

  constructor() {
    super(SCENES.OPTIONS);
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? SCENES.MENU;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS.options;
    const showFullscreen = this.scale.fullscreen.available;
    const rows = showFullscreen ? 6 : 5;
    const panelH = 70 + rows * 23 + 18;
    const top = Math.round(135 - panelH / 2);
    addDim(this, 0.6);
    addPanel(this, cx, 135, 300, panelH);
    addText(this, cx, top + 12, t.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });

    const yesNo = (v: boolean) => (v ? t.on : t.off);
    let y = top + 50;
    const next = () => {
      const v = y;
      y += 23;
      return v;
    };

    const sfx = new Button(this, cx, next(), '', {
      width: 190,
      height: 19,
      onClick: () => {
        settings.set({ sfx: !settings.get().sfx });
        refresh();
      },
    });
    const music = new Button(this, cx, next(), '', {
      width: 190,
      height: 19,
      onClick: () => {
        settings.set({ music: !settings.get().music });
        refresh();
      },
    });
    const changeVolume = (delta: number, wrap: boolean) => {
      let v = Math.round((settings.get().volume + delta) * 10) / 10;
      if (wrap && v > 1) v = 0;
      settings.set({ volume: Math.max(0, Math.min(1, v)) });
      audio.play('click');
      refresh();
    };
    const volume = new Button(this, cx, next(), '', { width: 190, height: 19, onClick: () => changeVolume(0.1, true) });
    const items: MenuItem[] = [
      { button: sfx, onAdjust: () => sfx.activate() },
      { button: music, onAdjust: () => music.activate() },
      { button: volume, onAdjust: (d) => changeVolume(d * 0.1, false) },
    ];
    if (showFullscreen) {
      const fullscreen = new Button(this, cx, next(), t.fullscreen, { width: 190, height: 19, onClick: () => toggleFullscreen(this) });
      items.push({ button: fullscreen });
    }
    const reset = new Button(this, cx, next(), TEXTS2.options.resetProgress, { width: 190, height: 19, onClick: () => this.confirmReset() });
    items.push({ button: reset });
    const back = new Button(this, cx, next(), t.back, { width: 190, height: 19, onClick: () => this.close() });
    items.push({ button: back });
    this.menu = new ButtonMenu(this, items, { onBack: () => this.close() });

    addText(this, cx, top + panelH - 16, t.saved, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] });

    const refresh = () => {
      const s = settings.get();
      sfx.setText(`${t.sound}: ${yesNo(s.sfx)}`);
      music.setText(`${t.music}: ${yesNo(s.music)}`);
      volume.setText(`${t.volume}: < ${Math.round(s.volume * 100)}% >`);
    };
    refresh();
  }

  /** Confirmación antes de borrar el progreso (los récords y las opciones se conservan). */
  private confirmReset(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.options;
    this.menu.setEnabled(false);
    const depth = 50;
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(addDim(this, 0.6, depth));
    objs.push(addPanel(this, cx, 135, 320, 140, depth));
    objs.push(addText(this, cx, 78, t.confirmTitle, { color: UI_COLORS.red, origin: [0.5, 0], depth }));
    objs.push(addText(this, cx, 96, t.confirmText, { color: UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: 290, depth }));
    const close = (confirmMenu: ButtonMenu) => {
      confirmMenu.destroy();
      no.destroy();
      yes.destroy();
      objs.forEach((o) => o.destroy());
      this.time.delayedCall(0, () => this.menu.setEnabled(true));
    };
    const no = new Button(this, cx - 70, 180, t.confirmNo, { width: 120, height: 19, depth, onClick: () => close(confirmMenu) });
    const yes = new Button(this, cx + 70, 180, t.confirmYes, {
      width: 120,
      height: 19,
      depth,
      onClick: () => {
        saveStore.resetProgress();
        close(confirmMenu);
        const done = addText(this, cx, 16, t.done, { color: UI_COLORS.green, origin: [0.5, 0], depth });
        this.tweens.add({ targets: done, alpha: 0, delay: 1600, duration: 400, onComplete: () => done.destroy() });
      },
    });
    const confirmMenu = new ButtonMenu(this, [{ button: no }, { button: yes }], { onBack: () => close(confirmMenu), depth });
  }

  private close(): void {
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
