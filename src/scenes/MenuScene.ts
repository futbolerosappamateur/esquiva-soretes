import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS, TEXTS2 } from '../config/texts';
import { formatThousands } from '../core/math';
import { records } from '../core/records';
import { saveStore } from '../core/save';
import { applyPlayerCharacter } from '../graphics/characterTextures';
import { ObstacleManager } from '../entities/obstacles/ObstacleManager';
import { ANIM } from '../graphics/animations';
import { FX_FRAMES, TEX, UI_FRAMES } from '../graphics/keys';
import { isTouchPrimary } from '../input/device';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { fitToTexture } from '../graphics/renderScale';
import { profileSession } from '../core/profileSession';
import { online } from '../social/onlineSession';
import { onlineStatusLabel } from '../social/onlineStatusLabel';
import { openAccountPanel } from '../social/ui/accountPanel';
import { isPanelOpen } from '../social/ui/overlay';
import { EffectsSystem } from '../systems/EffectsSystem';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addText } from '../ui/text';
import { generateMenuLayout } from '../world/LevelGenerator';
import type { LevelLayout } from '../world/LevelLayout';
import { THEMES } from '../world/themes';
import { WorldView } from '../world/WorldView';

const UI_DEPTH = DEPTH.overlay;
const WALK_SPEED = 26;
const WALKER_SCREEN_X = 104;
const WALKER_Y = 199;

/** Menú principal con una vereda de San Telmo animada de fondo. */
export class MenuScene extends Phaser.Scene {
  private layout!: LevelLayout;
  private world!: WorldView;
  private obstacles!: ObstacleManager;
  private effects!: EffectsSystem;
  private walker!: Phaser.GameObjects.Sprite;
  private walkerShadow!: Phaser.GameObjects.Image;
  private menu!: ButtonMenu;
  private scroll = 0;

  constructor() {
    super(SCENES.MENU);
  }

  create(): void {
    this.scroll = 0;
    const theme = THEMES['san-telmo'];
    this.layout = generateMenuLayout(theme, 20241116);
    applyPlayerCharacter(this, saveStore.get().selectedCharacter);
    // Carril libre para el paseante del menú.
    this.layout.obstacles = this.layout.obstacles.filter((o) => o.y < WALKER_Y - 16);
    this.cameras.main.setBackgroundColor(theme.skyColor);

    this.world = new WorldView(this, this.layout);
    this.effects = new EffectsSystem(this);
    this.obstacles = new ObstacleManager(this, this.layout.obstacles, this.effects);
    this.world.onPigeonScared = () => audio.play('flap');

    this.walkerShadow = this.add.image(0, WALKER_Y, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3).setDepth(DEPTH.shadow);
    this.walker = this.add
      .sprite(0, WALKER_Y, TEX.player(0), 'walk0')
      .setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY)
      .setDepth(WALKER_Y + 0.5);
    fitToTexture(this.walker);
    this.walker.play(ANIM.player(0, 'walk'));

    this.buildUi();
    audio.playMusic('menu');
    this.cameras.main.fadeIn(350, 18, 12, 24);
  }

  private buildUi(): void {
    const cx = GAME_WIDTH / 2;
    // El logo definitivo (de plastilina, animado: el sorete salta y el farol titila)
    // o, si no está, el provisional con el sorete al lado.
    const art = this.textures.exists(TEX.logoArt) && this.anims.exists(ANIM.logoArt);
    let logoBottom: number;
    if (art) {
      const logo = fitToTexture(this.add.sprite(cx, 3, TEX.logoArt, 'f0')).setOrigin(0.5, 0).setScrollFactor(0).setDepth(UI_DEPTH);
      logo.play(ANIM.logoArt);
      this.tweens.add({ targets: logo, y: 5, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      logoBottom = 3 + logo.displayHeight;
    } else {
      const logo = fitToTexture(this.add.image(cx, 7, TEX.logo)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(UI_DEPTH);
      this.tweens.add({ targets: logo, y: 10, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const mascot = this.add
        .sprite(Math.round(cx + logo.displayWidth / 2 + 10), 88, TEX.mascot, 'idle')
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(UI_DEPTH);
      mascot.play(ANIM.mascot);
      // Se aplasta y estira (escala relativa a la de su dibujo con detalle).
      const ms = fitToTexture(mascot).scaleX;
      this.tweens.add({ targets: mascot, scaleY: ms * 0.86, scaleX: ms * 1.12, duration: 260, yoyo: true, repeat: -1, repeatDelay: 380, ease: 'Quad.easeOut' });
      logoBottom = 92;
    }

    const subtitleY = Math.round(logoBottom + (art ? 2 : 8));
    addText(this, cx, subtitleY, TEXTS.subtitle.toUpperCase(), { color: UI_COLORS.cream, origin: [0.5, 0], scrollFactor: 0, depth: UI_DEPTH });

    const make = (y: number, label: string, onClick: () => void) =>
      new Button(this, cx, y, label, { width: 128, height: 18, onClick, depth: UI_DEPTH });
    const first = subtitleY + 20;
    const play = make(first, TEXTS.menu.play, () => this.startGame());
    const profile = make(first + 20, TEXTS2.profiles.change, () => this.openProfiles());
    const howTo = make(first + 40, TEXTS.menu.howTo, () => this.openOverlay(SCENES.HOW_TO));
    const options = make(first + 60, TEXTS.menu.options, () => this.openOverlay(SCENES.OPTIONS));
    const recordsBtn = make(first + 80, TEXTS2.menu.records, () => this.openOverlay(SCENES.RECORDS));
    this.menu = new ButtonMenu(this, [{ button: play }, { button: profile }, { button: howTo }, { button: options }, { button: recordsBtn }], { depth: UI_DEPTH });

    addText(this, 6, 6, `${TEXTS2.profiles.playingAs}: ${saveStore.activeProfile().nickname}`, { color: UI_COLORS.celeste, scrollFactor: 0, depth: UI_DEPTH });
    // Estado online (modo local, invitado, conectado...). Tocándolo se abre la cuenta.
    const status = addText(this, 6, 16, '', { outline: false, scrollFactor: 0, depth: UI_DEPTH });
    // Área táctil más grande que el texto (para tocarlo con el dedo).
    const hit = new Phaser.Geom.Rectangle(0, 0, 1, 1);
    status.setInteractive({ hitArea: hit, hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    const refreshStatus = () => {
      const label = onlineStatusLabel();
      status.setText(label.text).setTint(label.color);
      hit.setTo(-6, -6, status.width + 12, status.height + 10);
    };
    refreshStatus();
    const off = online.on(refreshStatus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    status.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openAccount());

    const best = records.get().bestScore;
    addText(this, cx, first + 94, best > 0 ? `${TEXTS.menu.record}: ${formatThousands(best)}` : TEXTS.menu.noRecord, {
      color: UI_COLORS.yellow,
      origin: [0.5, 0],
      scrollFactor: 0,
      depth: UI_DEPTH,
    });

    const touch = isTouchPrimary();
    addText(this, cx, GAME_HEIGHT - 14, touch ? TEXTS.menu.touchHint : TEXTS.menu.keyboardHint, {
      color: UI_COLORS.cream,
      origin: [0.5, 0],
      scrollFactor: 0,
      depth: UI_DEPTH,
    });
    addText(this, GAME_WIDTH - 4, GAME_HEIGHT - 4, TEXTS2.menu.version, { outline: false, color: UI_COLORS.gray, origin: [1, 1], scrollFactor: 0, depth: UI_DEPTH });

    if (touch && this.scale.fullscreen.available) {
      const fs = this.add
        .image(GAME_WIDTH - 14, 14, TEX.ui, UI_FRAMES.fullscreen)
        .setScrollFactor(0)
        .setDepth(UI_DEPTH)
        .setInteractive({ useHandCursor: true });
      fs.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => toggleFullscreen(this));
    }
  }

  private startGame(): void {
    this.menu.setEnabled(false);
    audio.play('start');
    this.cameras.main.fadeOut(260, 18, 12, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Una vez por sesión se elige quién juega (perfiles locales).
      if (profileSession.chosen) this.scene.start(SCENES.WORLD_MAP);
      else this.scene.start(SCENES.PROFILES, { next: 'map' });
    });
  }

  private openProfiles(): void {
    this.menu.setEnabled(false);
    this.scene.start(SCENES.PROFILES, { next: 'menu' });
  }

  private openAccount(): void {
    if (isPanelOpen()) return;
    this.menu.setEnabled(false);
    audio.play('click');
    // Al cerrar se rearma el menú (puede haber cambiado el perfil activo).
    openAccountPanel({ onClose: () => this.scene.restart() });
  }

  private openOverlay(key: string): void {
    this.scene.launch(key, { from: SCENES.MENU });
    this.scene.pause();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.scroll += WALK_SPEED * dt;
    if (this.scroll > this.layout.length - GAME_WIDTH * 2) this.scroll = 0;
    const sx = Math.round(this.scroll);
    this.cameras.main.setScroll(sx, 0);
    const wx = sx + WALKER_SCREEN_X;
    this.walker.setX(wx);
    this.walkerShadow.setX(wx);
    this.world.update(dt, this.scroll, wx, WALKER_Y);
    this.obstacles.cull(sx, sx + GAME_WIDTH);
    this.effects.update(dt);
  }
}

/** Pantalla completa (sólo con gesto del usuario) y, si se puede, bloqueo horizontal. */
export function toggleFullscreen(scene: Phaser.Scene): void {
  if (scene.scale.isFullscreen) {
    scene.scale.stopFullscreen();
    return;
  }
  scene.scale.startFullscreen();
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  orientation.lock?.('landscape').catch(() => undefined);
}
