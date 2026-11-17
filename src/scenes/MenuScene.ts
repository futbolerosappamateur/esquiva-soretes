import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS } from '../config/texts';
import { formatThousands } from '../core/math';
import { records } from '../core/records';
import { createRun } from '../core/RunState';
import { ObstacleManager } from '../entities/obstacles/ObstacleManager';
import { ANIM } from '../graphics/animations';
import { FX_FRAMES, TEX, UI_FRAMES } from '../graphics/keys';
import { isTouchPrimary } from '../input/device';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { EffectsSystem } from '../systems/EffectsSystem';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addText } from '../ui/text';
import type { BlockDefinition } from '../world/blocks';
import { generateLevel } from '../world/LevelGenerator';
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
    const block: BlockDefinition = {
      theme: theme.id,
      number: 0,
      street: 'DEFENSA',
      fromStreet: '',
      toStreet: '',
      length: 20000,
      difficulty: [0.1, 0.3],
    };
    this.layout = generateLevel(block, theme, 20241116);
    // Carril libre para el paseante del menú.
    this.layout.obstacles = this.layout.obstacles.filter((o) => o.y < WALKER_Y - 16);
    this.cameras.main.setBounds(0, 0, this.layout.worldWidth, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(theme.skyColor);

    this.world = new WorldView(this, this.layout, null);
    this.effects = new EffectsSystem(this);
    this.obstacles = new ObstacleManager(this, this.layout.obstacles, this.effects);
    this.world.onPigeonScared = () => audio.play('flap');

    this.walkerShadow = this.add.image(0, WALKER_Y, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3).setDepth(DEPTH.shadow);
    this.walker = this.add
      .sprite(0, WALKER_Y, TEX.player(0), 'walk0')
      .setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY)
      .setDepth(WALKER_Y + 0.5);
    this.walker.play(ANIM.player(0, 'walk'));

    this.buildUi();
    audio.playMusic('menu');
    this.cameras.main.fadeIn(350, 18, 12, 24);
  }

  private buildUi(): void {
    const cx = GAME_WIDTH / 2;
    const logo = this.add.image(cx, 8, TEX.logo).setOrigin(0.5, 0).setScrollFactor(0).setDepth(UI_DEPTH);
    this.tweens.add({ targets: logo, y: 11, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const mascot = this.add
      .sprite(Math.round(cx + logo.width / 2 + 14), 84, TEX.mascot, 'idle')
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);
    mascot.play(ANIM.mascot);
    this.tweens.add({ targets: mascot, scaleY: 0.86, scaleX: 1.12, duration: 260, yoyo: true, repeat: -1, repeatDelay: 380, ease: 'Quad.easeOut' });

    addText(this, cx, 100, TEXTS.subtitle.toUpperCase(), { color: UI_COLORS.cream, origin: [0.5, 0], scrollFactor: 0, depth: UI_DEPTH });

    const make = (y: number, label: string, onClick: () => void) =>
      new Button(this, cx, y, label, { width: 128, height: 19, onClick, depth: UI_DEPTH });
    const play = make(131, TEXTS.menu.play, () => this.startGame());
    const howTo = make(154, TEXTS.menu.howTo, () => this.openOverlay(SCENES.HOW_TO));
    const options = make(177, TEXTS.menu.options, () => this.openOverlay(SCENES.OPTIONS));
    this.menu = new ButtonMenu(this, [{ button: play }, { button: howTo }, { button: options }], { depth: UI_DEPTH });

    const best = records.get().bestScore;
    addText(this, cx, 204, best > 0 ? `${TEXTS.menu.record}: ${formatThousands(best)}` : TEXTS.menu.noRecord, {
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
    addText(this, GAME_WIDTH - 4, GAME_HEIGHT - 4, 'V0.1', { outline: false, color: UI_COLORS.gray, origin: [1, 1], scrollFactor: 0, depth: UI_DEPTH });

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
      this.scene.start(SCENES.GAME, { run: createRun() });
    });
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
