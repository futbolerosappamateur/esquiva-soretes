import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { COIN_TUNING, CROSSING_TUNING, EFFECTS_TUNING, PLAYER_TUNING, SCORING } from '../config/balance';
import { GAME_WIDTH, LAYOUT, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { PHRASES, TEXTS2 } from '../config/texts';
import { clamp } from '../core/math';
import { applyLevelResult, creditCoins, type LevelResultOutcome } from '../core/progress';
import { records } from '../core/records';
import { pickRandom } from '../core/rng';
import { createRun, takeUnbankedCoins, type Checkpoint, type LifeMark, type RunState } from '../core/RunState';
import { saveStore } from '../core/save';
import type { LevelRef } from '../data/campaign';
import { missionFirstKey, type MissionDef } from '../data/missions';
import { DebugOverlay, debugFlags } from '../debug/DebugOverlay';
import type { Obstacle } from '../entities/obstacles/Obstacle';
import { ObstacleManager, type ObstacleEvents } from '../entities/obstacles/ObstacleManager';
import { Player } from '../entities/Player';
import { applyPlayerCharacter } from '../graphics/characterTextures';
import { TEX } from '../graphics/keys';
import { InputController } from '../input/InputController';
import type { NpcEvent } from '../npc/NpcActor';
import { NpcSystem } from '../npc/NpcSystem';
import { CameraController } from '../systems/CameraController';
import { footprintsOverlap, type Footprint } from '../systems/Collision';
import { EffectsSystem, type FlySwarm } from '../systems/EffectsSystem';
import { CoinSystem, MissionSystem } from '../systems/PickupSystems';
import { ScoreSystem } from '../systems/ScoreSystem';
import type { CrossingController, CrossingEvents } from '../world/crossing/CrossingController';
import { CrossingSystem, type CrossingHudInfo } from '../world/crossing/CrossingSystem';
import type { Vehicle } from '../world/crossing/TrafficSim';
import { buildLevel, starsFor, type BuiltLevel, type StarThresholds } from '../world/levelBuilder';
import { PROP_DEFS, type DecalPlacement, type LevelLayout } from '../world/LevelLayout';
import { WorldView } from '../world/WorldView';

export interface HudSnapshot {
  score: number;
  multiplier: number;
  comboProgress: number;
  /** Avance en todo el nivel (0..1). */
  progress: number;
  lives: number;
  lifeMarks: LifeMark[];
  coins: number;
  /** Cuadra actual (1..blocks). */
  block: number;
  blocks: number;
  crossing: CrossingHudInfo | null;
  mission: { status: string; collected: number; required: number } | null;
}

/** Datos que la escena de juego le pasa a la HUD al empezar. */
export interface HudInit {
  barrioName: string;
  levelNumber: number;
  levelName: string;
  envLabel: string;
  blocks: { street: string; from: string; to: string }[];
  /** Fracción del nivel donde termina cada cuadra (para marcar la barra de progreso). */
  blockEnds: number[];
  startBlock: number;
  lives: number;
  lifeMarks: LifeMark[];
}

/** Lo que reciben las pantallas de resultados y de game over. */
export interface LevelResult {
  run: RunState;
  ref: LevelRef;
  barrioId: string;
  barrioName: string;
  levelNumber: number;
  levelName: string;
  envLabel: string;
  completed: boolean;
  score: number;
  distanceM: number;
  dodged: number;
  bestStreak: number;
  distancePoints: number;
  dodgePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  crossingBonus: number;
  perfectBlocks: number;
  coinsRun: number;
  coinsFromStars: number;
  stars: number;
  thresholds: StarThresholds;
  outcome: LevelResultOutcome | null;
  levelBest: number;
  isNewRecord: boolean;
  globalBest: number;
  /** Número de cuadra desde la que se puede reintentar (o null si no hay checkpoint). */
  checkpointBlock: number | null;
  blocksCompleted: number;
  totalBlocks: number;
}

export interface GameSceneData {
  run: RunState;
}

type Mode = 'playing' | 'stepped' | 'scared' | 'victory' | 'ended';

interface Solid {
  x: number;
  y: number;
  fp: Footprint;
}

export class GameScene extends Phaser.Scene {
  run!: RunState;
  built!: BuiltLevel;
  layout!: LevelLayout;
  player!: Player;
  obstacles!: ObstacleManager;
  score!: ScoreSystem;
  crossings!: CrossingSystem;
  private world!: WorldView;
  private effects!: EffectsSystem;
  private cameraCtl!: CameraController;
  private controls!: InputController;
  private coins!: CoinSystem;
  private mission!: MissionSystem;
  private npcs!: NpcSystem;
  private solids: Solid[] = [];
  private leafPiles: DecalPlacement[] = [];
  private playerFlies?: FlySwarm;
  private debugOverlay?: DebugOverlay;
  private mode: Mode = 'playing';
  private freeze = 0;
  private phraseCooldown = 0;
  private leafTimer = 0;
  /** Índice de la cuadra que se está recorriendo (o a la que se llega después del cruce). */
  private blockIndex = 0;
  private bannerShown = -1;
  private blockHits = 0;
  private crossingBonus = 0;
  private perfectBlocks = 0;

  private readonly obstacleEvents: ObstacleEvents = {
    onHazard: (o) => this.handleHazard(o),
    onNuisance: (o) => this.handleNuisance(o),
    onDodge: (o, closeCall) => this.handleDodge(o, closeCall),
  };

  constructor() {
    super(SCENES.GAME);
  }

  init(data: GameSceneData): void {
    this.run = data?.run ? { ...data.run, lifeMarks: [...data.run.lifeMarks] } : createRun({ barrioId: 'san-telmo', levelIndex: 0 });
    this.mode = 'playing';
    this.freeze = 0;
    this.phraseCooldown = 0;
    this.leafTimer = 0;
    this.blockHits = 0;
    this.crossingBonus = 0;
    this.perfectBlocks = 0;
    this.bannerShown = -1;
    this.playerFlies = undefined;
  }

  create(): void {
    this.built = buildLevel(this.run.levelRef, { seed: debugFlags.seed ?? this.run.seed, environment: debugFlags.env });
    this.layout = this.built.layout;
    const env = this.built.env;
    const layout = this.layout;
    this.applyDebugStart();
    const cp = this.run.checkpoint;
    this.blockIndex = cp ? Math.min(cp.blocksCompleted, layout.blocks.length - 1) : 0;
    const startX = cp ? cp.x : layout.startX;
    const startY = cp ? cp.y : layout.startY;

    applyPlayerCharacter(this, saveStore.get().selectedCharacter);
    this.cameras.main.setBackgroundColor(this.built.theme.skyColor);

    this.world = new WorldView(this, layout, { env });
    this.world.onPigeonScared = () => audio.play('flap');
    this.effects = new EffectsSystem(this);
    this.obstacles = new ObstacleManager(this, layout.obstacles, this.effects);
    this.obstacles.skipBefore(startX);
    this.solids = layout.props.map((p) => ({ x: p.x, y: p.y, fp: PROP_DEFS[p.kind].solid }));
    this.leafPiles = layout.decals.filter((d) => d.texture === TEX.leafPile);

    this.crossings = new CrossingSystem(this, layout.crossings, env.lampsLit, env.worldTint, {
      onEvents: (ctl, i, ev) => this.handleCrossingEvents(ctl, i, ev),
    });
    this.crossings.skipBefore(startX);
    this.coins = new CoinSystem(this, layout.coins, startX, env.actorTint);

    const missionBehind = !!layout.mission && !!cp && layout.mission.blockIndex < cp.blocksCompleted;
    this.mission = new MissionSystem(this, layout.mission, this.run.missionDone || missionBehind, {
      onPickup: (n, req) => this.onMissionPickup(n, req),
      onDelivered: (def) => this.onMissionDelivered(def),
    });
    const npcPlacements = layout.mission && !missionBehind ? [{ defId: layout.mission.giver.npc, x: layout.mission.giver.x, y: layout.mission.giver.y, dir: -1 as const }] : [];
    this.npcs = new NpcSystem(this, npcPlacements, saveStore.get().selectedCharacter, (ev) => this.handleNpcEvent(ev));
    if (env.actorTint !== 0xffffff) this.npcs.setTint(env.actorTint);

    this.player = new Player(this, startX, startY, Math.min(2, this.run.poopHits), {
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
    if (env.actorTint !== 0xffffff) this.player.sprite.setTint(env.actorTint);
    this.player.shadow.setAlpha(env.shadowAlpha);
    this.updatePlayerFlies();

    this.score = new ScoreSystem(cp ? cp.score : 0);
    this.cameraCtl = new CameraController(this.cameras.main, layout.worldWidth, CameraController.followScroll(startX));
    this.controls = new InputController(this);

    const span = Math.max(1, layout.length - layout.startX);
    const hud: HudInit = {
      barrioName: this.built.barrio.name,
      levelNumber: this.built.level.number,
      levelName: this.built.level.name,
      envLabel: env.label,
      blocks: layout.blocks.map((b) => ({ street: b.street.street, from: b.street.from, to: b.street.to })),
      blockEnds: layout.blocks.map((b) => clamp((b.endX - layout.startX) / span, 0, 1)),
      startBlock: this.blockIndex,
      lives: this.run.lives,
      lifeMarks: [...this.run.lifeMarks],
    };
    this.scene.launch(SCENES.HUD, hud);
    // Si se arranca dentro de la vereda (no en una esquina), el cartel de la cuadra lo muestra la HUD.
    if (!cp) this.bannerShown = 0;

    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.autoPause, this);
    this.scale.on(Phaser.Scale.Events.ORIENTATION_CHANGE, this.onOrientation, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (debugFlags.enabled) this.debugOverlay = new DebugOverlay(this);

    audio.playMusic('game');
    this.cameras.main.fadeIn(300, 18, 12, 24);
  }

  /** ?block=N: arranca en la esquina anterior a la cuadra N (como un checkpoint). */
  private applyDebugStart(): void {
    if (debugFlags.block === null || debugFlags.block <= 0 || this.run.checkpoint || this.run.continues > 0) return;
    const k = Math.min(debugFlags.block, this.layout.blocks.length) - 1;
    const end = this.layout.blocks[k].endX;
    this.run.checkpoint = {
      blocksCompleted: k + 1,
      x: end + 10,
      y: this.layout.startY,
      score: new ScoreSystem(0).toSnapshot(),
      coins: 0,
      crossingsDone: k,
      missionDone: false,
      carHits: 0,
    };
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.autoPause, this);
    this.scale.off(Phaser.Scale.Events.ORIENTATION_CHANGE, this.onOrientation, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.world.destroy();
    this.crossings.destroy();
    this.coins.destroy();
    this.mission.destroy();
    this.npcs.destroy();
    this.debugOverlay?.destroy();
    this.debugOverlay = undefined;
  }

  // -------------------------------------------------------------------------
  // Pausa
  // -------------------------------------------------------------------------

  private autoPause(): void {
    if (this.mode === 'playing' || this.mode === 'stepped' || this.mode === 'scared') this.openPause();
  }

  /** En el celular, si se gira a vertical aparece el aviso y el juego se pausa. */
  private onOrientation(): void {
    if (this.scale.isPortrait && this.sys.game.device.input.touch) this.autoPause();
  }

  openPause(): void {
    if (!this.scene.isActive() || this.scene.isPaused()) return;
    audio.play('pause');
    audio.setDucked(true);
    this.scene.launch(SCENES.PAUSE, { run: this.run });
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
    if ((this.mode === 'playing' || this.mode === 'stepped' || this.mode === 'scared') && this.controls.consumePause()) {
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

    const zone = this.crossings.zoneIndexAt(this.player.x);
    const zoneCtl = zone >= 0 ? this.crossings.controllers[zone] : null;
    // Esperar el semáforo no corta la racha.
    this.score.comboFrozen = zoneCtl !== null && !zoneCtl.completed;

    const p = this.player;
    this.crossings.update(dt, { x: p.x, y: p.y, footprint: p.footprint, canBeHit: p.canBeHit, active: this.mode === 'playing' }, this.cameraCtl.left);

    if (this.mode === 'playing') {
      this.obstacles.update(this.player, this.obstacleEvents);
      this.score.update(dt);
      this.score.updateDistance(this.player.x - this.layout.startX);
      this.updateLeaves(dt);
      this.updatePickups(dt);
      this.updateBlocks();
    }
    this.npcs.update(dt, { x: p.x, y: p.y, active: this.mode === 'playing' }, (id) => this.missionStateFor(id), this.cameraCtl.left, this.cameraCtl.right);

    const lookAhead = zoneCtl && !zoneCtl.completed ? zoneCtl.geo.x0 + CROSSING_TUNING.width / 2 - GAME_WIDTH / 2 + 24 : null;
    this.cameraCtl.update(dt, this.player.x, lookAhead);
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

  private updatePickups(dt: number): void {
    const p = this.player;
    const got = this.coins.update({ x: p.x, y: p.y, z: p.z }, this.cameraCtl.left, this.cameraCtl.right);
    for (const c of got) {
      this.run.coins++;
      this.score.addBonus(COIN_TUNING.pickupPoints);
      audio.play('coin');
      this.effects.sparkle(c.x, c.y - 8);
      this.effects.popup(c.x, c.y - 16, '+1', UI_COLORS.yellow);
    }
    this.mission.update(dt, { x: p.x, y: p.y, z: p.z });
  }

  /** Detecta el fin de cada cuadra (checkpoint) y del nivel. */
  private updateBlocks(): void {
    const blocks = this.layout.blocks;
    const current = blocks[this.blockIndex];
    // Cartel de la cuadra nueva al pisar su vereda después del cruce.
    if (this.bannerShown < this.blockIndex && this.player.x > current.startX + 24) {
      this.bannerShown = this.blockIndex;
      this.events.emit('hud:block', this.blockIndex);
    }
    if (this.player.x < current.endX) return;
    if (this.blockIndex >= blocks.length - 1) {
      this.winLevel();
      return;
    }
    this.completeBlock(this.blockIndex);
  }

  private completeBlock(index: number): void {
    const perfect = this.blockHits === 0;
    if (perfect) {
      this.perfectBlocks++;
      this.score.addBonus(SCORING.perfectBlockBonus);
      this.effects.popup(this.player.x, this.player.y - 54, `+${SCORING.perfectBlockBonus}`, UI_COLORS.green);
      this.showPhrase(PHRASES.perfect, UI_COLORS.green, true);
      audio.play('bonus');
    } else {
      this.showPhrase(TEXTS2.game.blockDone, UI_COLORS.yellow, true);
    }
    audio.play('checkpoint');
    this.blockIndex = index + 1;
    this.blockHits = 0;
    this.registerCheckpoint(index + 1);
    this.events.emit('hud:checkpoint', index + 1);
  }

  /** Guarda el checkpoint en la esquina y acredita las monedas juntadas hasta acá. */
  private registerCheckpoint(blocksCompleted: number): void {
    const end = this.layout.blocks[blocksCompleted - 1].endX;
    // Los metros hasta el punto de reaparición quedan cobrados: al reintentar no se suman de nuevo.
    this.score.updateDistance(end + 10 - this.layout.startX);
    const cp: Checkpoint = {
      blocksCompleted,
      x: end + 10,
      y: clamp(this.player.y, LAYOUT.walkMinY + 6, LAYOUT.walkMaxY - 6),
      score: this.score.toSnapshot(),
      coins: this.run.coins,
      crossingsDone: this.run.crossingsDone,
      missionDone: this.run.missionDone,
      carHits: this.run.carHits,
    };
    this.run.checkpoint = cp;
    this.bankProgress();
  }

  /** Acredita a la billetera las monedas (y bonus de misión) todavía no guardados. */
  private bankProgress(extraCoins = 0): void {
    const coins = takeUnbankedCoins(this.run) + extraCoins;
    const firstKey = this.run.missionFirstPending;
    this.run.missionFirstPending = null;
    saveStore.update((s) => {
      if (coins > 0) creditCoins(s, coins);
      if (firstKey && !s.missions.firstRewards.includes(firstKey)) s.missions.firstRewards.push(firstKey);
    });
  }

  // -------------------------------------------------------------------------
  // Cruces peatonales
  // -------------------------------------------------------------------------

  private handleCrossingEvents(ctl: CrossingController, index: number, ev: CrossingEvents): void {
    const near = Math.abs(this.player.x - (ctl.geo.x0 + ctl.geo.x1) / 2) < GAME_WIDTH;
    if (ev.phaseChanged === 'pedGreen' && near && !ctl.completed) audio.play('walkSignal');
    if (ev.enteredOnRed && this.mode === 'playing') {
      audio.play('warning');
      this.effects.exclaim(this.player.x + 8, this.player.y - 50);
      this.showPhrase(TEXTS2.game.redLight, UI_COLORS.red, true);
    }
    if (ev.honk) {
      audio.play('horn');
      const sprite = this.crossings.viewOf(index)?.spriteOf(ev.honk.id);
      if (sprite) this.effects.popup(sprite.x, sprite.y - sprite.height - 4, TEXTS2.game.honk, UI_COLORS.orange);
    }
    if (ev.hit) this.handleCarHit(ev.hit, ctl);
    if (ev.crossed) {
      this.run.crossingsDone++;
      saveStore.update((s) => void s.stats.crossings++);
      let bonus = 0;
      if (ev.crossed.green) bonus += CROSSING_TUNING.greenBonus;
      if (ev.crossed.clean) bonus += CROSSING_TUNING.cleanBonus;
      if (bonus > 0) {
        this.score.addBonus(bonus);
        this.crossingBonus += bonus;
        this.effects.popup(this.player.x, this.player.y - 54, `+${bonus}`, UI_COLORS.green);
        audio.play('bonus');
      }
      const msg = ev.crossed.green ? TEXTS2.game.greenCross : ev.crossed.clean ? TEXTS2.game.clean : null;
      if (msg) this.showPhrase(msg, UI_COLORS.green, true);
    }
  }

  private handleCarHit(vehicle: Vehicle, ctl: CrossingController): void {
    if (this.mode !== 'playing') return;
    this.score.registerHit();
    this.run.lives = Math.max(0, this.run.lives - 1);
    this.run.lifeMarks.push('car');
    this.run.carHits++;
    saveStore.update((s) => void s.stats.carHits++);
    const lastLife = this.run.lives <= 0;
    this.mode = 'scared';
    this.freeze = 0.06;
    audio.play('horn');
    audio.play('scared');
    this.cameras.main.shake(140, 0.005);
    if (lastLife) audio.stopMusic();
    void vehicle;
    this.player.scare(lastLife, {
      onImpact: () => {
        this.effects.exclaim(this.player.x + 8, this.player.y - 50 - this.player.z);
        this.events.emit('hud:life-lost', this.run.lives, 'car');
        this.showPhrase(pickRandom(PHRASES.carHit), UI_COLORS.red, true);
        if (!lastLife) audio.play('lifeLost');
      },
      onRespawn: () => {
        ctl.onRespawn();
        return ctl.safeSpot(this.player.y);
      },
      onRecovered: () => {
        if (this.mode === 'scared') this.mode = 'playing';
      },
      onFallen: () => this.gameOver(),
    });
  }

  // -------------------------------------------------------------------------
  // Misión y NPC
  // -------------------------------------------------------------------------

  private missionStateFor(id: string): 'available' | 'active' | 'done' {
    if (this.mission.def?.id !== id) return 'done';
    const s = this.mission.status;
    return s === 'active' ? 'active' : s === 'available' ? 'available' : 'done';
  }

  private handleNpcEvent(ev: NpcEvent): void {
    if (ev.type === 'offerMission' && this.mission.def?.id === ev.missionId && this.mission.status === 'available') {
      this.mission.accept();
      audio.play('mission');
      this.events.emit('hud:mission', this.mission.collected, this.mission.required);
    }
  }

  private onMissionPickup(collected: number, required: number): void {
    audio.play('coin');
    this.effects.sparkle(this.player.x, this.player.y - 30);
    this.showPhrase(`${TEXTS2.hud.trash} ${collected}/${required}`, UI_COLORS.celeste, true);
    this.events.emit('hud:mission', collected, required);
  }

  private onMissionDelivered(def: MissionDef): void {
    const key = missionFirstKey(def.id, this.built.level.id);
    const firstTime = !saveStore.get().missions.firstRewards.includes(key);
    const coins = def.rewardCoins + (firstTime ? def.firstTimeBonus : 0);
    this.run.coins += coins;
    this.run.missionDone = true;
    if (firstTime) this.run.missionFirstPending = key;
    this.score.addBonus(def.rewardPoints);
    audio.play('missionDone');
    this.effects.confettiBurst(this.cameraCtl.left);
    this.effects.popup(this.player.x, this.player.y - 58, `+${coins} $`, UI_COLORS.yellow);
    this.showPhrase(TEXTS2.game.missionDone, UI_COLORS.yellow, true);
    this.events.emit('hud:mission-done', coins);
  }

  // -------------------------------------------------------------------------
  // Eventos de obstáculos
  // -------------------------------------------------------------------------

  private handleHazard(o: Obstacle): void {
    o.markUsed();
    this.score.registerHit();
    this.blockHits++;
    this.run.lives = Math.max(0, this.run.lives - 1);
    this.run.lifeMarks.push('poop');
    this.run.poopHits++;
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
        this.player.setDirt(Math.min(2, this.run.poopHits));
        this.updatePlayerFlies();
        this.events.emit('hud:life-lost', this.run.lives, 'poop');
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
  // Fin del nivel
  // -------------------------------------------------------------------------

  private winLevel(): void {
    this.mode = 'victory';
    this.player.celebrate();
    audio.stopMusic();
    audio.play('victory');
    if (this.blockHits === 0) {
      this.perfectBlocks++;
      this.score.addBonus(SCORING.perfectBlockBonus);
      this.time.delayedCall(800, () => {
        audio.play('bonus');
        this.effects.popup(this.player.x, this.player.y - 54, `+${SCORING.perfectBlockBonus}`, UI_COLORS.green);
      });
    }
    this.showPhrase(TEXTS2.game.levelDone, UI_COLORS.yellow, true);
    this.effects.confettiBurst(this.cameraCtl.left);
    this.time.delayedCall(500, () => this.effects.confettiBurst(this.cameraCtl.left));

    const score = this.score.score;
    const stars = starsFor(score, this.built.stars);
    let outcome: LevelResultOutcome | null = null;
    let coinsFromStars = 0;
    saveStore.update((s) => {
      outcome = applyLevelResult(s, this.run.levelRef, { score, stars });
      coinsFromStars = outcome.newStars * COIN_TUNING.newStarCoins;
      s.currentBarrio = this.run.levelRef.barrioId;
    });
    this.bankProgress(coinsFromStars);
    const summary = this.buildResult(true, outcome, coinsFromStars, stars);
    this.time.delayedCall(2400, () => this.showResult(SCENES.LEVEL_COMPLETE, summary));
  }

  private gameOver(): void {
    if (this.mode === 'ended') return;
    this.mode = 'ended';
    audio.play('gameOver');
    const summary = this.buildResult(false, null, 0, 0);
    this.time.delayedCall(800, () => this.showResult(SCENES.GAME_OVER, summary));
  }

  private buildResult(completed: boolean, outcome: LevelResultOutcome | null, coinsFromStars: number, stars: number): LevelResult {
    const s = this.score;
    const newDodges = Math.max(0, s.dodged - this.run.dodgesSubmitted);
    this.run.dodgesSubmitted = s.dodged;
    const { isNewRecord: globalRecord } = records.submit({ score: s.score, distanceM: s.meters, dodged: s.dodged, blocksCompleted: completed ? this.layout.blocks.length : this.blockIndex }, newDodges, true);
    const levelOutcome = outcome as LevelResultOutcome | null;
    const cp = this.run.checkpoint;
    return {
      run: { ...this.run, lifeMarks: [...this.run.lifeMarks] },
      ref: { ...this.run.levelRef },
      barrioId: this.built.barrio.id,
      barrioName: this.built.barrio.name,
      levelNumber: this.built.level.number,
      levelName: this.built.level.name,
      envLabel: this.built.env.label,
      completed,
      score: s.score,
      distanceM: s.meters,
      dodged: s.dodged,
      bestStreak: s.bestStreak,
      distancePoints: s.distancePoints,
      dodgePoints: s.dodgePoints,
      bonusPoints: s.bonusPoints,
      penaltyPoints: s.penaltyPoints,
      crossingBonus: this.crossingBonus,
      perfectBlocks: this.perfectBlocks,
      coinsRun: this.run.coins,
      coinsFromStars,
      stars,
      thresholds: this.built.stars,
      outcome: levelOutcome,
      levelBest: Math.max(levelOutcome?.previousBest ?? 0, completed ? s.score : 0),
      isNewRecord: completed ? (levelOutcome?.newRecord ?? false) : globalRecord,
      globalBest: records.get().bestScore,
      checkpointBlock: !completed && cp ? Math.min(cp.blocksCompleted + 1, this.layout.blocks.length) : null,
      blocksCompleted: completed ? this.layout.blocks.length : this.blockIndex,
      totalBlocks: this.layout.blocks.length,
    };
  }

  private showResult(key: string, summary: LevelResult): void {
    this.scene.launch(key, summary);
    this.scene.pause();
    this.scene.pause(SCENES.HUD);
  }

  // -------------------------------------------------------------------------
  // Consultas para la HUD, la depuración y las pruebas
  // -------------------------------------------------------------------------

  get currentBlockNumber(): number {
    return this.blockIndex + 1;
  }

  inputKeys(): string[] {
    return this.controls.keys.heldCodes();
  }

  getHudSnapshot(): HudSnapshot {
    const span = Math.max(1, this.layout.length - this.layout.startX);
    const m = this.mission;
    return {
      score: this.score.score,
      multiplier: this.score.multiplier,
      comboProgress: this.score.comboProgress,
      progress: clamp((this.player.x - this.layout.startX) / span, 0, 1),
      lives: this.run.lives,
      lifeMarks: this.run.lifeMarks,
      coins: this.run.coins,
      block: this.blockIndex + 1,
      blocks: this.layout.blocks.length,
      crossing: this.crossings.hudInfo(this.player.x),
      mission: m.def && (m.status === 'active' || m.status === 'done') ? { status: m.status, collected: m.collected, required: m.required } : null,
    };
  }

  /** Depuración / pruebas: mueve al jugador y a la cámara a otra x (sin saltear eventos de cuadra). */
  debugTeleport(x: number, y = this.player.y): void {
    this.player.placeAt(x, y);
    this.cameraCtl.jumpTo(CameraController.followScroll(x));
    this.obstacles.skipBefore(x - 30);
  }

  /** Para las pruebas automatizadas: estado de las vidas iniciales. */
  get startingLives(): number {
    return PLAYER_TUNING.lives;
  }
}
