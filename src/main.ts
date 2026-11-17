import Phaser from 'phaser';
import { audio } from './audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { importLegacyRecords } from './core/migrations';
import { recordsRepo } from './core/recordsRepository';
import { createRun } from './core/RunState';
import { saveStore } from './core/save';
import { debugFlags } from './debug/DebugOverlay';
import { BarrioCompleteScene } from './scenes/BarrioCompleteScene';
import { BarrioScene } from './scenes/BarrioScene';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { HudScene } from './scenes/HudScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { MenuScene } from './scenes/MenuScene';
import { NameEntryScene } from './scenes/NameEntryScene';
import { OptionsScene } from './scenes/OptionsScene';
import { PauseScene } from './scenes/PauseScene';
import { ProfileSelectScene } from './scenes/ProfileSelectScene';
import { RecordsScene } from './scenes/RecordsScene';
import { WorldMapScene } from './scenes/WorldMapScene';

audio.init();
// Los récords de la v0.2 pasan (una sola vez) a la nueva tabla de récords.
importLegacyRecords();

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
  scene: [
    BootScene,
    MenuScene,
    WorldMapScene,
    BarrioScene,
    CharacterSelectScene,
    BarrioCompleteScene,
    HowToPlayScene,
    OptionsScene,
    RecordsScene,
    ProfileSelectScene,
    NameEntryScene,
    LeaderboardScene,
    GameScene,
    HudScene,
    PauseScene,
    GameOverScene,
    LevelCompleteScene,
  ],
});

// Acceso para pruebas automatizadas y depuración (sólo en desarrollo o con ?debug).
if (import.meta.env.DEV || debugFlags.enabled) {
  (window as unknown as { __ESQUIVA__: { game: Phaser.Game; saveStore: typeof saveStore; recordsRepo: typeof recordsRepo; createRun: typeof createRun } }).__ESQUIVA__ = {
    game,
    saveStore,
    recordsRepo,
    createRun,
  };
}
