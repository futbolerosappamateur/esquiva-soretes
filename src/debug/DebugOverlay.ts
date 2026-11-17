import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import type { GameScene } from '../scenes/GameScene';
import { addText } from '../ui/text';
import { PROP_DEFS } from '../world/LevelLayout';

/**
 * Herramientas de desarrollo, activables desde la URL:
 *   ?debug        muestra huellas de colisión y datos (F2 lo oculta/muestra)
 *   ?seed=1234    fija la semilla para repetir exactamente la misma cuadra
 *   ?block=3      empieza directamente en la cuadra 3
 */
function readFlags(): { enabled: boolean; seed: number | null; block: number | null } {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed');
  const block = params.get('block');
  const parsedSeed = seed !== null && seed !== '' && Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : null;
  const parsedBlock = block !== null && Number.isFinite(Number(block)) ? Math.max(0, Math.floor(Number(block)) - 1) : null;
  return { enabled: params.has('debug'), seed: parsedSeed, block: parsedBlock };
}

export const debugFlags = readFlags();

export class DebugOverlay {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly info: Phaser.GameObjects.BitmapText;
  private visible = true;

  constructor(private readonly scene: GameScene) {
    this.g = scene.add.graphics().setDepth(5000);
    this.info = addText(scene, 4, 46, '', { outline: true, color: 0x9be04f, scrollFactor: 0, depth: 5001 });
    scene.input.keyboard?.on('keydown-F2', this.toggle, this);
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.g.setVisible(this.visible);
    this.info.setVisible(this.visible);
  }

  update(): void {
    if (!this.visible) return;
    const s = this.scene;
    const p = s.player;
    const left = s.cameras.main.scrollX - 20;
    const right = left + GAME_WIDTH + 40;
    const g = this.g;
    g.clear();

    for (const prop of s.layout.props) {
      if (prop.x < left || prop.x > right) continue;
      const fp = PROP_DEFS[prop.kind].solid;
      g.lineStyle(1, 0x4fb3ff, 1).strokeRect(prop.x - fp.w / 2, prop.y - fp.h / 2, fp.w, fp.h);
    }
    for (const o of s.obstacles.list) {
      if (o.x < left || o.x > right) continue;
      const fp = o.footprint;
      const color = o.state === 'active' ? (o.def.effect === 'life' ? 0xff3355 : 0xffd23f) : 0x888888;
      g.lineStyle(1, color, 1);
      if (fp.shape === 'ellipse') g.strokeEllipse(o.x, o.y, fp.w, fp.h);
      else g.strokeRect(o.x - fp.w / 2, o.y - fp.h / 2, fp.w, fp.h);
    }
    const pf = p.footprint;
    g.lineStyle(1, p.canBeHit ? 0x33ff66 : 0xffffff, 1).strokeRect(p.x - pf.w / 2, p.y - pf.h / 2, pf.w, pf.h);
    if (p.z > 0) g.lineStyle(1, 0x33ff66, 0.5).lineBetween(p.x, p.y, p.x, p.y - p.z);

    const fps = Math.round(s.game.loop.actualFps);
    this.info.setText(`X ${Math.round(p.x)}  Y ${Math.round(p.y)}  Z ${Math.round(p.z)}\nVIDAS ${s.run.lives}  FPS ${fps}  OBST ${s.obstacles.list.length}`);
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-F2', this.toggle, this);
  }
}
