import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { ensurePanelTexture } from '../graphics/textures/uiTextures';

/** Panel oscuro centrado en (cx, cy). */
export function addPanel(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, depth = 0): Phaser.GameObjects.Image {
  const key = ensurePanelTexture(scene.textures, w, h);
  return scene.add.image(Math.round(cx), Math.round(cy), key).setDepth(depth);
}

/** Velo oscuro de pantalla completa para menús superpuestos. */
export function addDim(scene: Phaser.Scene, alpha = 0.55, depth = 0): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x120c18, alpha).setOrigin(0).setDepth(depth);
}
