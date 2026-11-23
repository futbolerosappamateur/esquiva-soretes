import { hideLoadingScreen, setLoadingProgress } from '../ui/loadingScreen';
import Phaser from 'phaser';
import { applyManifest, queueManifest } from '../assets/AssetLoader';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { createRun } from '../core/RunState';
import { BARRIOS } from '../data/campaign';
import { debugFlags } from '../debug/DebugOverlay';
import { createAnimations } from '../graphics/animations';
import { loadGameFont, registerFonts } from '../graphics/BitmapFontBuilder';
import { TEXTURE_STEPS } from '../graphics/textures';
import { addText } from '../ui/text';

/**
 * Carga inicial: gráficos definitivos declarados en el manifiesto (si los
 * hay), la letra del juego, texturas provisionales y animaciones. Lo hace por
 * pasos para poder mostrar el progreso.
 */
export class BootScene extends Phaser.Scene {
  private step = 0;
  private bar!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENES.BOOT);
  }

  preload(): void {
    queueManifest(this.load);
    // Mientras bajan los dibujos, el porcentaje en la pantalla de carga de la página.
    this.load.on(Phaser.Loader.Events.PROGRESS, (fraction: number) => setLoadingProgress(fraction));
    // Un archivo faltante no rompe nada: queda el gráfico provisional.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => console.warn(`No se pudo cargar ${file.key}`));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1d1424');
    // La letra viene en un archivo aparte: se espera a que esté (tarda un instante) antes de escribir.
    void loadGameFont().then(() => {
      if (this.sys.isActive()) this.start();
    });
  }

  private start(): void {
    registerFonts(this);
    // Desde acá se ve la barra de progreso del juego.
    hideLoadingScreen();
    const cx = GAME_WIDTH / 2;
    addText(this, cx, GAME_HEIGHT / 2 - 34, 'ESQUIVA SORETES', { scale: 2, color: UI_COLORS.yellow, origin: 0.5 });
    this.label = addText(this, cx, GAME_HEIGHT / 2 + 22, '', { color: UI_COLORS.cream, origin: 0.5 });
    this.bar = this.add.graphics();
    this.step = 0;
    this.showProgress();
    this.time.delayedCall(30, () => this.runStep());
  }

  private showProgress(): void {
    const total = TEXTURE_STEPS.length;
    const w = 200;
    const x = Math.round(GAME_WIDTH / 2 - w / 2);
    const y = Math.round(GAME_HEIGHT / 2 + 4);
    this.bar.clear();
    this.bar.fillStyle(0x120c18, 1).fillRect(x - 2, y - 2, w + 4, 10);
    this.bar.fillStyle(0x4a3657, 1).fillRect(x, y, w, 6);
    this.bar.fillStyle(0xffd23f, 1).fillRect(x, y, Math.round((w * this.step) / total), 6);
    const next = TEXTURE_STEPS[this.step];
    this.label.setText(next ? `${next.label.toUpperCase()}...` : '¡LISTO!');
  }

  private runStep(): void {
    if (this.step < TEXTURE_STEPS.length) {
      TEXTURE_STEPS[this.step].run(this.textures);
      this.step++;
      this.showProgress();
      this.time.delayedCall(16, () => this.runStep());
      return;
    }
    createAnimations(this.anims);
    // Los definitivos reemplazan a los provisionales (y pueden redefinir animaciones).
    applyManifest(this.textures, this.anims);
    // ?level=san-telmo-2 abre directamente ese nivel (para probar).
    if (debugFlags.level) {
      for (const barrio of BARRIOS) {
        const levelIndex = barrio.levels.findIndex((l) => l.id === debugFlags.level);
        if (levelIndex >= 0) {
          this.scene.start(SCENES.GAME, { run: createRun({ barrioId: barrio.id, levelIndex }) });
          return;
        }
      }
    }
    this.scene.start(SCENES.MENU);
  }
}
