import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS } from '../config/texts';
import { createRun } from '../core/RunState';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.PAUSE);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    addDim(this, 0.55);
    addPanel(this, cx, 135, 210, 138);
    addText(this, cx, 76, TEXTS.pause.title, { scale: 3, color: UI_COLORS.yellow, origin: [0.5, 0] });
    const make = (y: number, label: string, onClick: () => void) => new Button(this, cx, y, label, { width: 150, height: 19, onClick });
    const resume = make(124, TEXTS.pause.resume, () => this.resumeGame());
    const restart = make(147, TEXTS.pause.restart, () => this.restartGame());
    const quit = make(170, TEXTS.pause.quit, () => this.quitToMenu());
    new ButtonMenu(this, [{ button: resume }, { button: restart }, { button: quit }], { onBack: () => this.resumeGame() });
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
  }

  private resumeGame(): void {
    audio.setDucked(false);
    this.scene.resume(SCENES.GAME);
    this.scene.resume(SCENES.HUD);
    this.scene.stop();
  }

  private restartGame(): void {
    audio.setDucked(false);
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.GAME, { run: createRun() });
  }

  private quitToMenu(): void {
    audio.setDucked(false);
    this.scene.stop(SCENES.GAME);
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.MENU);
  }
}
