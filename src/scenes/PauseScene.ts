import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS, TEXTS2 } from '../config/texts';
import { createRun, type RunState } from '../core/RunState';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';

export class PauseScene extends Phaser.Scene {
  private run: RunState | null = null;

  constructor() {
    super(SCENES.PAUSE);
  }

  init(data: { run?: RunState }): void {
    this.run = data?.run ?? null;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    addDim(this, 0.55);
    addPanel(this, cx, 135, 210, 138);
    addText(this, cx, 76, TEXTS.pause.title, { scale: 3, color: UI_COLORS.yellow, origin: [0.5, 0] });
    const make = (y: number, label: string, onClick: () => void) => new Button(this, cx, y, label, { width: 150, height: 19, onClick });
    const resume = make(124, TEXTS.pause.resume, () => this.resumeGame());
    const restart = make(147, TEXTS2.pause.restart, () => this.restartGame());
    const quit = make(170, TEXTS2.pause.quit, () => this.quitToMap());
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
    const ref = this.run?.levelRef ?? { barrioId: 'san-telmo', levelIndex: 0 };
    this.scene.start(SCENES.GAME, { run: createRun(ref, this.run?.seed ?? null) });
  }

  private quitToMap(): void {
    audio.setDucked(false);
    this.scene.stop(SCENES.GAME);
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.WORLD_MAP, { focus: this.run?.levelRef.barrioId });
  }
}
