import Phaser from 'phaser';
import { audio } from './audio/AudioManager';
import { loadGameFont } from './graphics/BitmapFontBuilder';
import { canvasSizeFor, installRenderScale, renderScale, watchRenderScale } from './graphics/renderScale';
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
import { online } from './social/onlineSession';
import { openAccountPanel, openPublicProfile } from './social/ui/accountPanel';
import { attachOverlay, isPanelOpen } from './social/ui/overlay';

audio.init();
// Se dibuja con la resolución de la pantalla (ver graphics/renderScale.ts): antes de crear el juego.
installRenderScale();
// La letra se empieza a cargar ya (BootScene la espera antes de escribir).
void loadGameFont();
// Los récords de la v0.2 pasan (una sola vez) a la nueva tabla de récords.
importLegacyRecords();

const canvasSize = canvasSizeFor(renderScale());
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: canvasSize.width,
  height: canvasSize.height,
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

// La resolución sigue al tamaño de la ventana (y baja sola si el equipo no da abasto).
watchRenderScale(game);

// Modo online (si está configurado): arranca en segundo plano, sin frenar el juego.
attachOverlay(game);
let termsPrompted = false;
online.on(() => {
  if (isPanelOpen()) return;
  // Enlace para elegir una contraseña nueva, o cuenta recién confirmada que todavía no aceptó las condiciones.
  const needsTerms = online.status === 'signedIn' && online.account?.adultConfirmed !== true && !termsPrompted;
  if (online.passwordRecovery || needsTerms) {
    termsPrompted = true;
    openAccountPanel();
  }
});
void online.init();

// Acceso para pruebas automatizadas y depuración (sólo en desarrollo o con ?debug).
if (import.meta.env.DEV || debugFlags.enabled) {
  (window as unknown as { __ESQUIVA__: object }).__ESQUIVA__ = {
    game,
    saveStore,
    recordsRepo,
    createRun,
    online,
    openAccountPanel,
    openPublicProfile,
  };
}
