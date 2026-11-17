import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS } from '../config/texts';
import { settings } from '../core/settings';
import { Button } from '../ui/Button';
import { ButtonMenu, type MenuItem } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import { toggleFullscreen } from './MenuScene';

/** Opciones de sonido, música y volumen (se guardan en LocalStorage al instante). */
export class OptionsScene extends Phaser.Scene {
  private from: string = SCENES.MENU;

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
    const rows = showFullscreen ? 5 : 4;
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
    let fullscreen: Button | null = null;
    if (showFullscreen) {
      fullscreen = new Button(this, cx, next(), t.fullscreen, { width: 190, height: 19, onClick: () => toggleFullscreen(this) });
      items.push({ button: fullscreen });
    }
    const back = new Button(this, cx, next(), t.back, { width: 190, height: 19, onClick: () => this.close() });
    items.push({ button: back });
    new ButtonMenu(this, items, { onBack: () => this.close() });

    addText(this, cx, top + panelH - 16, t.saved, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] });

    const refresh = () => {
      const s = settings.get();
      sfx.setText(`${t.sound}: ${yesNo(s.sfx)}`);
      music.setText(`${t.music}: ${yesNo(s.music)}`);
      volume.setText(`${t.volume}: < ${Math.round(s.volume * 100)}% >`);
    };
    refresh();
  }

  private close(): void {
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
