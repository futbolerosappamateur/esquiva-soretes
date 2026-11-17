import Phaser from 'phaser';
import { audio } from './audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { debugFlags } from './debug/DebugOverlay';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { OptionsScene } from './scenes/OptionsScene';
import { PauseScene } from './scenes/PauseScene';
import { VictoryScene } from './scenes/VictoryScene';

audio.init();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#120c18',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
  // El audio lo maneja nuestro propio sintetizador (audio/AudioManager.ts).
  audio: { noAudio: true },
  render: { powerPreference: 'high-performance' },
  banner: false,
  // El orden define qué escena se dibuja encima de cuál.
  scene: [BootScene, MenuScene, HowToPlayScene, OptionsScene, GameScene, HudScene, PauseScene, GameOverScene, VictoryScene],
});

// Acceso para pruebas automatizadas y depuración (sólo en desarrollo o con ?debug).
if (import.meta.env.DEV || debugFlags.enabled) {
  (window as unknown as { __ESQUIVA__: { game: Phaser.Game } }).__ESQUIVA__ = { game };
}
