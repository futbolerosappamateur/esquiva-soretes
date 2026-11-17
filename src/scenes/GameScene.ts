import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { EFFECTS_TUNING, PLAYER_TUNING, SCORING } from '../config/balance';
import { LAYOUT, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { PHRASES, TEXTS } from '../config/texts';
import { clamp } from '../core/math';
import { records } from '../core/records';
import { pickRandom } from '../core/rng';
import { createRun, type RunState } from '../core/RunState';
import { DebugOverlay, debugFlags } from '../debug/DebugOverlay';
import type { Obstacle } from '../entities/obstacles/Obstacle';
import { ObstacleManager, type ObstacleEvents } from '../entities/obstacles/ObstacleManager';
import { Player } from '../entities/Player';
import { TEX } from '../graphics/keys';
import { InputController } from '../input/InputController';
import { CameraController } from '../systems/CameraController';
import { footprintsOverlap, type Footprint } from '../systems/Collision';
import { EffectsSystem, type FlySwarm } from '../systems/EffectsSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { getBlock, type BlockDefinition } from '../world/blocks';
import { generateLevel } from '../world/LevelGenerator';
import { PROP_DEFS, type DecalPlacement, type LevelLayout } from '../world/LevelLayout';
import { THEMES, type NeighborhoodTheme } from '../world/themes';
import { WorldView } from '../world/WorldView';

export interface HudSnapshot {
  score: number;
  multiplier: number;
  comboProgress: number;
  progress: number;
  lives: number;
}

/** Datos que reciben las pantallas de victoria y de game over. */
export interface ResultSummary {
  run: RunState;
  block: BlockDefinition;
  blockScore: number;
  distanceM: number;
  dodged: number;
  bestStreak: number;
  perfect: boolean;
  perfectBonus: number;
  distancePoints: number;
  dodgePoints: number;
  penaltyPoints: number;
  isNewRecord: boolean;
  bestScore: number;
}

type Mode = 'playing' | 'stepped' | 'victory' | 'ended';

interface Solid {
  x: number;
  y: number;
  fp: Footprint;
}

export class GameScene extends Phaser.Scene {
  run!: RunState;
  block!: BlockDefinition;
  layout!: LevelLayout;
  player!: Player;
  obstacles!: ObstacleManager;
  score!: ScoreSystem;
  private theme!: NeighborhoodTheme;
  private world!: WorldView;
  private effects!: EffectsSystem;
  private cameraCtl!: CameraController;
  private controls!: InputController;
  private solids: Solid[] = [];
  private leafPiles: DecalPlacement[] = [];
  private playerFlies?: FlySwarm;
  private debugOverlay?: DebugOverlay;
  private mode: Mode = 'playing';
  private freeze = 0;
  private phraseCooldown = 0;
  private leafTimer = 0;
  private blockHits = 0;
  private blockStartScore = 0;

  private readonly obstacleEvents: ObstacleEvents = {
    onHazard: (o) => this.handleHazard(o),
    onNuisance: (o) => this.handleNuisance(o),
    onDodge: (o, closeCall) => this.handleDodge(o, closeCall),
  };

  constructor() {
    super(SCENES.GAME);
  }

  init(data: { run?: RunState }): void {
    this.run = data?.run ? { ...data.run } : createRun();
    if (debugFlags.block !== null && this.run.blockIndex === 0 && this.run.score === 0) this.run.blockIndex = debugFlags.block;
    this.mode = 'playing';
    this.freeze = 0;
    this.phraseCooldown = 0;
    this.leafTimer = 0;
    this.blockHits = 0;
    this.playerFlies = undefined;
  }

  create(): void {
    this.block = getBlock(this.run.blockIndex);
    this.theme = THEMES[this.block.theme] ?? THEMES['san-telmo'];
    const seed = ((debugFlags.seed ?? this.run.seed) + this.run.blockIndex * 7919) >>> 0;
    this.layout = generateLevel(this.block, this.theme, seed);
    this.cameras.main.setBackgroundColor(this.theme.skyColor);

    this.world = new WorldView(this, this.layout, this.block.toStreet);
    this.world.onPigeonScared = () => audio.play('flap');
    this.effects = new EffectsSystem(this);
    this.obstacles = new ObstacleManager(this, this.layout.obstacles, this.effects);
    this.solids = this.layout.props.map((p) => ({ x: p.x, y: p.y, fp: PROP_DEFS[p.kind].solid }));
    this.leafPiles = this.layout.decals.filter((d) => d.texture === TEX.leafPile);

    const dirt = clamp(PLAYER_TUNING.lives - this.run.lives, 0, 2);
    this.player = new Player(this, this.layout.startX, this.layout.startY, dirt, {
      onJump: () => {
        audio.play('jump');
        this.effects.dustPuff(this.player.x, this.player.y, 3);
      },
      onLand: () => {
        audio.play('land');
        this.effects.dustPuff(this.player.x, this.player.y, 2);
      },
      onRunStep: () => this.effects.dustPuff(this.player.x - 5 * this.player.facing, this.player.y, 1),
    });
    this.updatePlayerFlies();

    this.score = new ScoreSystem(this.run.score);
    this.blockStartScore = this.run.score;
    this.cameraCtl = new CameraController(this.cameras.main, this.layout.worldWidth);
    this.controls = new InputController(this);

    this.scene.launch(SCENES.HUD, { block: this.block, themeName: this.theme.name, lives: this.run.lives });

    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.autoPause, this);
    this.scale.on(Phaser.Scale.Events.ORIENTATION_CHANGE, this.onOrientation, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (debugFlags.enabled) this.debugOverlay = new DebugOverlay(this);

    audio.playMusic('game');
    this.cameras.main.fadeIn(300, 18, 12, 24);
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.autoPause, this);
    this.scale.off(Phaser.Scale.Events.ORIENTATION_CHANGE, this.onOrientation, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.world.destroy();
    this.debugOverlay?.destroy();
    this.debugOverlay = undefined;
  }

  // -------------------------------------------------------------------------
  // Pausa
  // -------------------------------------------------------------------------

  private autoPause(): void {
    if (this.mode === 'playing' || this.mode === 'stepped') this.openPause();
  }

  /** En el celular, si se gira a vertical aparece el aviso y el juego se pausa. */
  private onOrientation(): void {
    if (this.scale.isPortrait && this.sys.game.device.input.touch) this.autoPause();
  }

  openPause(): void {
    if (!this.scene.isActive() || this.scene.isPaused()) return;
    audio.play('pause');
    audio.setDucked(true);
    this.scene.launch(SCENES.PAUSE);
    this.scene.pause();
    this.scene.pause(SCENES.HUD);
  }

  private onResume(): void {
    this.controls.reset();
    audio.setDucked(false);
  }

  // -------------------------------------------------------------------------
  // Bucle principal
  // -------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.controls.update(dt);
    if ((this.mode === 'playing' || this.mode === 'stepped') && this.controls.consumePause()) {
      this.openPause();
      return;
    }
    if (this.freeze > 0) {
      // "Hit-stop": un instante congelado que hace sentir el impacto.
      this.freeze -= dt;
      return;
    }

    const bounds = {
      minX: this.cameraCtl.left + 10,
      maxX: Math.min(this.cameraCtl.right - 14, this.layout.length + 90),
      minY: LAYOUT.walkMinY,
      maxY: LAYOUT.walkMaxY,
    };
    this.player.update(dt, this.mode === 'playing' ? this.controls : null, bounds, this.isBlocked);

    if (this.mode === 'playing') {
      this.obstacles.update(this.player, this.obstacleEvents);
      this.score.update(dt);
      this.score.updateDistance(this.player.x - this.layout.startX);
      this.updateLeaves(dt);
      if (this.mode === 'playing' && this.player.x >= this.layout.length) this.winBlock();
    }

    this.cameraCtl.update(dt, this.player.x);
    this.world.update(dt, this.cameraCtl.left, this.player.x, this.player.y);
    this.obstacles.cull(this.cameraCtl.left, this.cameraCtl.right);
    this.effects.update(dt);
    this.phraseCooldown = Math.max(0, this.phraseCooldown - dt);
    this.debugOverlay?.update();
  }

  private readonly isBlocked = (x: number, y: number): boolean => {
    for (const s of this.solids) {
      if (Math.abs(s.x - x) > 30) continue;
      if (footprintsOverlap(x, y, this.player.footprint, s.x, s.y, s.fp)) return true;
    }
    return false;
  };

  /** Al caminar sobre hojas secas, vuelan algunas. */
  private updateLeaves(dt: number): void {
    this.leafTimer -= dt;
    if (this.leafTimer > 0 || !this.player.onGround) return;
    if (Math.abs(this.player.vx) + Math.abs(this.player.vy) < 20) return;
    const pile = this.leafPiles.find((p) => Math.abs(p.x - this.player.x) < 18 && Math.abs(p.y - this.player.y) < 7);
    if (pile) {
      this.effects.leafBurst(this.player.x, this.player.y);
      this.leafTimer = 0.18;
    }
  }

  // -------------------------------------------------------------------------
  // Eventos de obstáculos
  // -------------------------------------------------------------------------

  private handleHazard(o: Obstacle): void {
    o.markUsed();
    this.score.registerHit();
    this.blockHits++;
    this.run.lives = Math.max(0, this.run.lives - 1);
    const lastLife = this.run.lives <= 0;
    this.mode = 'stepped';
    this.freeze = 0.08;
    audio.play('splat');
    this.effects.splat(o.x, o.y);
    this.effects.exclaim(this.player.x + 8, this.player.y - 50);
    this.cameras.main.shake(160, 0.006);
    if (lastLife) audio.stopMusic();

    this.player.stepIn(lastLife, {
      onDisgust: () => {
        audio.play('bleh');
        this.effects.stink(this.player.x - 8 * this.player.facing, this.player.y - 20, 3);
        this.player.setDirt(clamp(PLAYER_TUNING.lives - this.run.lives, 0, 2));
        this.updatePlayerFlies();
        this.events.emit('hud:life-lost', this.run.lives);
        this.showPhrase(pickRandom(PHRASES.hit), UI_COLORS.red, true);
        if (!lastLife) audio.play('lifeLost');
      },
      onRecovered: () => {
        if (this.mode === 'stepped') this.mode = 'playing';
      },
      onFallen: () => this.gameOver(),
    });
  }

  private handleNuisance(o: Obstacle): void {
    o.markUsed();
    const lost = this.score.registerPenalty(SCORING.looseTilePenalty);
    this.effects.splash(o.x, o.y);
    audio.play('splash');
    if (lost > 0) this.effects.popup(o.x, o.y - 12, `-${lost}`, UI_COLORS.red);
    this.player.slowDown();
    this.showPhrase(pickRandom(PHRASES.looseTile), UI_COLORS.celeste);
  }

  private handleDodge(o: Obstacle, closeCall: boolean): void {
    const res = this.score.registerDodge(closeCall);
    this.effects.popup(o.x, o.y - (o.def.id === 'giant' ? 26 : 14), `+${res.points}`, res.multiplier > 1 ? UI_COLORS.orange : UI_COLORS.white);
    audio.play('dodge', this.score.streak);
    if (res.multiplierUp) {
      this.showPhrase(`${pickRandom(PHRASES.combo)} ×${res.multiplier}`, UI_COLORS.yellow, true);
      audio.play('combo');
      this.effects.sparkle(this.player.x, this.player.y - 40);
    } else if (closeCall) {
      this.showPhrase(pickRandom(PHRASES.closeCall), UI_COLORS.celeste);
      audio.play('closeCall');
      this.effects.sparkle(o.x, o.y - 6);
    }
  }

  private showPhrase(text: string, color: number, force = false): void {
    if (!force && this.phraseCooldown > 0) return;
    this.phraseCooldown = EFFECTS_TUNING.phraseCooldown;
    this.events.emit('hud:phrase', text, color);
  }

  private updatePlayerFlies(): void {
    const count = this.player.dirtLevel;
    if (count === 0) {
      if (this.playerFlies) this.effects.removeSwarm(this.playerFlies);
      this.playerFlies = undefined;
      return;
    }
    if (this.playerFlies) this.playerFlies.setCount(count);
    else {
      this.playerFlies = this.effects.flies(() => ({ x: this.player.x, y: this.player.y - 8 - this.player.z, depth: this.player.y + 0.5 }), count, 10);
    }
  }

  // -------------------------------------------------------------------------
  // Fin de la cuadra
  // -------------------------------------------------------------------------

  private winBlock(): void {
    this.mode = 'victory';
    this.player.celebrate();
    audio.stopMusic();
    audio.play('victory');
    const perfect = this.blockHits === 0;
    if (perfect) {
      this.score.addBonus(SCORING.perfectBlockBonus);
      this.showPhrase(PHRASES.perfect, UI_COLORS.green, true);
      this.time.delayedCall(800, () => {
        audio.play('bonus');
        this.effects.popup(this.player.x, this.player.y - 54, `+${SCORING.perfectBlockBonus}`, UI_COLORS.green);
      });
    } else {
      this.showPhrase(TEXTS.game.corner, UI_COLORS.yellow, true);
    }
    this.effects.confettiBurst(this.cameraCtl.left);
    this.time.delayedCall(500, () => this.effects.confettiBurst(this.cameraCtl.left));
    const summary = this.buildSummary(true, perfect);
    this.time.delayedCall(2400, () => this.showResult(SCENES.VICTORY, summary));
  }

  private gameOver(): void {
    if (this.mode === 'ended') return;
    this.mode = 'ended';
    audio.play('gameOver');
    const summary = this.buildSummary(false, false);
    this.time.delayedCall(800, () => this.showResult(SCENES.GAME_OVER, summary));
  }

  private buildSummary(completed: boolean, perfect: boolean): ResultSummary {
    const s = this.score;
    this.run.score = s.score;
    this.run.totalDistanceM += s.meters;
    this.run.totalDodged += s.dodged;
    if (completed) this.run.blocksCompleted += 1;
    const newDodges = this.run.totalDodged - this.run.dodgesSubmitted;
    this.run.dodgesSubmitted = this.run.totalDodged;
    const { isNewRecord } = records.submit(
      { score: this.run.score, distanceM: this.run.totalDistanceM, dodged: this.run.totalDodged, blocksCompleted: this.run.blocksCompleted },
      newDodges,
      !completed,
    );
    return {
      run: { ...this.run },
      block: this.block,
      blockScore: s.score - this.blockStartScore,
      distanceM: s.meters,
      dodged: s.dodged,
      bestStreak: s.bestStreak,
      perfect,
      perfectBonus: perfect ? SCORING.perfectBlockBonus : 0,
      distancePoints: s.distancePoints,
      dodgePoints: s.dodgePoints,
      penaltyPoints: s.penaltyPoints,
      isNewRecord,
      bestScore: records.get().bestScore,
    };
  }

  private showResult(key: string, summary: ResultSummary): void {
    this.scene.launch(key, summary);
    this.scene.pause();
    this.scene.pause(SCENES.HUD);
  }

  getHudSnapshot(): HudSnapshot {
    const span = Math.max(1, this.layout.length - this.layout.startX);
    return {
      score: this.score.score,
      multiplier: this.score.multiplier,
      comboProgress: this.score.comboProgress,
      progress: clamp((this.player.x - this.layout.startX) / span, 0, 1),
      lives: this.run.lives,
    };
  }
}
