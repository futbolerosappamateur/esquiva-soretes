import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import {
  barrioProgressPercent,
  barrioStars,
  completedLevels,
  ensureBarrio,
  isBarrioCompleted,
  isBarrioUnlocked,
  markUnlockSeen,
  pendingUnlocks,
  unlockRequirement,
} from '../core/progress';
import { saveStore } from '../core/save';
import { BARRIOS, CITY_NAME, normalizeName, type BarrioDef } from '../data/campaign';
import { debugFlags } from '../debug/DebugOverlay';
import { ICON_FRAMES, TEX } from '../graphics/keys';
import { isTouchPrimary } from '../input/device';
import { Button } from '../ui/Button';
import { addText } from '../ui/text';
import { parseBarriosGeoJson, projectBarrios, provisionalMap, rasterizeMap, scaleProjected, type MapRaster, type ProjectedMap } from '../world/map/geo';
import { MapRenderer, type BarrioVisual } from '../world/map/MapRenderer';
import { uniqueKeyEvents } from '../input/keyEvents';
import { CHARACTERS, isPlayable } from '../data/characters';

const GEO_KEY = 'caba-barrios';
const ZOOMS = [1, 2, 3] as const;
/** Alto de la ciudad (px) en el zoom más alejado: entra entera en la pantalla. */
const CITY_HEIGHT = 228;
const TOP_BAR = 20;
const PANEL_H = 58;
const VIEW_CY = TOP_BAR + (GAME_HEIGHT - TOP_BAR - PANEL_H) / 2;

interface ZoomLevel {
  map: ProjectedMap;
  raster: MapRaster;
  renderer: MapRenderer;
  key: string;
}

/** Datos del mapa calculados una sola vez por sesión (proyección y rasterizado de cada zoom). */
let cachedBase: ProjectedMap | null = null;

/**
 * Mapa general de Buenos Aires: progresión por barrios al estilo de los
 * mapas de los arcades clásicos, con los límites reales de los 48 barrios.
 */
export class WorldMapScene extends Phaser.Scene {
  private levels: (ZoomLevel | null)[] = [null, null, null];
  private zoomIndex = 1;
  private center = { x: 0, y: 0 };
  /** Índice de cada barrio de la campaña dentro de los datos del mapa. */
  private geoIndex: number[] = [];
  private selected = 0;
  private mapImage!: Phaser.GameObjects.Image;
  private selection?: Phaser.GameObjects.Image;
  private paths!: Phaser.GameObjects.Graphics;
  private markers: Phaser.GameObjects.Image[] = [];
  private token!: Phaser.GameObjects.Image;
  private tokenBarrio = 0;
  private tokenTween?: Phaser.Tweens.Tween;
  private panelTitle!: Phaser.GameObjects.BitmapText;
  private panelLine!: Phaser.GameObjects.BitmapText;
  private panelNote!: Phaser.GameObjects.BitmapText;
  private panelStars: Phaser.GameObjects.Image[] = [];
  private enterButton!: Button;
  private tooltip!: Phaser.GameObjects.BitmapText;
  private drag: { id: number; x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  private pinch: { dist: number } | null = null;
  private animating = false;
  private pathProgress = new Map<number, number>();
  private focusId: string | null = null;
  private provisional = false;

  constructor() {
    super(SCENES.WORLD_MAP);
  }

  init(data: { focus?: string }): void {
    this.focusId = data?.focus ?? null;
    // Los objetos de la visita anterior ya fueron destruidos al cerrar la escena.
    this.selection = undefined;
    this.tokenTween = undefined;
    this.levels = [null, null, null];
    this.markers = [];
    this.panelStars = [];
    this.drag = null;
    this.pinch = null;
    this.animating = false;
    this.pathProgress = new Map();
  }

  preload(): void {
    if (!this.cache.json.exists(GEO_KEY)) this.load.json(GEO_KEY, 'data/caba-barrios.geojson');
    // Si no se puede cargar, se usa el mapa provisional (claramente marcado).
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#3a6fc4');
    if (debugFlags.unlockAll) {
      saveStore.update((s) => {
        BARRIOS.filter((b) => b.levels.length > 0).forEach((b) => (ensureBarrio(s, b.id).unlocked = true));
        // También los personajes que se ganan con desafíos (sólo para probar).
        for (const c of CHARACTERS) if (isPlayable(c) && !s.unlocks.characters.includes(c.id)) s.unlocks.characters.push(c.id);
      });
    }
    this.buildBaseMap();
    this.zoomIndex = isTouchPrimary() ? 2 : 1;

    const save = saveStore.get();
    const current = BARRIOS.findIndex((b) => b.id === (this.focusId ?? save.currentBarrio));
    this.selected = Math.max(0, current);
    this.tokenBarrio = this.selected;

    this.mapImage = this.add.image(0, 0, this.level().key).setOrigin(0, 0);
    this.paths = this.add.graphics();
    this.token = this.add.image(0, 0, TEX.playerHead).setOrigin(0.5, 1);
    this.tweens.add({ targets: this.token, scaleY: 0.9, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tooltip = addText(this, 0, 0, '', { color: UI_COLORS.white, origin: [0.5, 1] }).setDepth(30).setVisible(false);

    this.buildUi();
    this.composeAll();
    this.centerOn(this.selected, false);
    this.select(this.selected, false);

    this.setupInput();
    audio.playMusic('menu');
    this.cameras.main.fadeIn(280, 18, 12, 24);

    // Animación de los barrios recién desbloqueados.
    const pending = pendingUnlocks(saveStore.get());
    if (pending.length > 0) this.time.delayedCall(500, () => this.playUnlock(pending[0]));
  }

  // -------------------------------------------------------------------------
  // Datos y dibujo
  // -------------------------------------------------------------------------

  private buildBaseMap(): void {
    if (!cachedBase) {
      try {
        const json = this.cache.json.get(GEO_KEY) as unknown;
        // Márgenes anchos: la provincia y el río llenan la pantalla aun con el mapa alejado.
        cachedBase = projectBarrios(parseBarriosGeoJson(json), CITY_HEIGHT, 150, 44);
      } catch {
        cachedBase = provisionalMap(BARRIOS.map((b) => b.name), 30);
      }
    }
    this.provisional = cachedBase.provisional;
    const keys = cachedBase.barrios.map((b) => b.key);
    this.geoIndex = BARRIOS.map((b) => {
      const i = keys.indexOf(normalizeName(this.provisional ? b.name : b.geoName));
      return i >= 0 ? i : 0;
    });
  }

  private level(index = this.zoomIndex): ZoomLevel {
    let lv = this.levels[index];
    if (!lv) {
      const map = scaleProjected(cachedBase!, ZOOMS[index]);
      const raster = rasterizeMap(map);
      const key = `${TEX.mapBase}-z${index}`;
      const renderer = new MapRenderer(this.textures, key, map, raster);
      lv = { map, raster, renderer, key };
      this.levels[index] = lv;
      this.composeLevel(lv);
    }
    return lv;
  }

  private visuals(unlocking?: { index: number; t: number }): BarrioVisual[] {
    const save = saveStore.get();
    const out: BarrioVisual[] = cachedBase!.barrios.map(() => ({ status: 'locked' }));
    let nextShown = false;
    BARRIOS.forEach((b, i) => {
      const gi = this.geoIndex[i];
      if (isBarrioCompleted(save, b.id)) out[gi] = { status: 'completed' };
      else if (isBarrioUnlocked(save, b.id)) out[gi] = { status: 'available' };
      else if (!nextShown) {
        out[gi] = { status: 'next' };
        nextShown = true;
      }
    });
    if (unlocking) out[this.geoIndex[unlocking.index]] = { status: 'next', unlockT: unlocking.t };
    return out;
  }

  private composeLevel(lv: ZoomLevel, unlocking?: { index: number; t: number }): void {
    lv.renderer.compose(this.visuals(unlocking));
    if (!this.provisional) {
      const z = ZOOMS[this.levels.indexOf(lv)];
      lv.renderer.decorate([
        { text: 'RÍO DE LA PLATA', x: lv.map.width - 70 * z, y: Math.round(lv.map.height * 0.35), color: '#cfe3ff' },
        { text: 'PROVINCIA DE BUENOS AIRES', x: Math.round(80 * z), y: Math.round(lv.map.height * 0.62), color: '#c9d6b8' },
      ]);
    }
  }

  private composeAll(unlocking?: { index: number; t: number }): void {
    this.levels.forEach((lv) => lv && this.composeLevel(lv, unlocking));
    this.refreshMarkers();
  }

  /** Punto (coordenadas del zoom actual) de un barrio de la campaña. */
  private labelPoint(i: number, lv = this.level()): { x: number; y: number } {
    return lv.raster.labels[this.geoIndex[i]];
  }

  private screenOf(p: { x: number; y: number }): { x: number; y: number } {
    return { x: this.mapImage.x + p.x, y: this.mapImage.y + p.y };
  }

  private refreshMarkers(): void {
    this.markers.forEach((m) => m.destroy());
    this.markers = [];
    const save = saveStore.get();
    BARRIOS.forEach((b, i) => {
      const lp = this.labelPoint(i);
      let frame: string | null = null;
      if (isBarrioCompleted(save, b.id)) frame = ICON_FRAMES.badge;
      else if (!isBarrioUnlocked(save, b.id) && (i === 0 || isBarrioUnlocked(save, BARRIOS[i - 1].id))) frame = ICON_FRAMES.lock;
      if (!frame) return;
      const m = this.add.image(0, 0, TEX.icons, frame).setDepth(5);
      m.setData('barrio', i);
      m.setData('lp', lp);
      this.markers.push(m);
    });
    this.layoutWorldObjects();
  }

  // -------------------------------------------------------------------------
  // Vista (zoom y desplazamiento)
  // -------------------------------------------------------------------------

  private clampCenter(): void {
    const lv = this.level();
    const viewW = GAME_WIDTH;
    const viewH = GAME_HEIGHT - TOP_BAR - PANEL_H;
    const halfW = viewW / 2;
    const halfH = viewH / 2;
    // Si el mapa entra entero, queda centrado; si no, no se puede alejar demasiado del borde.
    this.center.x = lv.map.width <= viewW ? lv.map.width / 2 : Phaser.Math.Clamp(this.center.x, halfW, lv.map.width - halfW);
    this.center.y = lv.map.height <= viewH ? lv.map.height / 2 : Phaser.Math.Clamp(this.center.y, halfH, lv.map.height - halfH);
  }

  private applyView(): void {
    this.clampCenter();
    this.mapImage.setTexture(this.level().key);
    this.mapImage.setPosition(Math.round(GAME_WIDTH / 2 - this.center.x), Math.round(VIEW_CY - this.center.y));
    this.layoutWorldObjects();
  }

  private layoutWorldObjects(): void {
    if (!this.mapImage) return;
    for (const m of this.markers) {
      const i = m.getData('barrio') as number;
      const s = this.screenOf(this.labelPoint(i));
      m.setPosition(Math.round(s.x), Math.round(s.y));
    }
    if (!this.animating) {
      const t = this.screenOf(this.labelPoint(this.tokenBarrio));
      this.token.setPosition(Math.round(t.x), Math.round(t.y - 2));
    }
    this.drawPaths();
    this.updateSelectionOutline();
  }

  private centerOn(i: number, smooth: boolean): void {
    const lp = this.labelPoint(i);
    if (!smooth) {
      this.center = { x: lp.x, y: lp.y };
      this.applyView();
      return;
    }
    this.tweens.add({
      targets: this.center,
      x: lp.x,
      y: lp.y,
      duration: 260,
      ease: 'Sine.easeOut',
      onUpdate: () => this.applyView(),
    });
  }

  private setZoom(index: number, anchor?: { x: number; y: number }): void {
    const next = Phaser.Math.Clamp(index, 0, ZOOMS.length - 1);
    if (next === this.zoomIndex) return;
    const ratio = ZOOMS[next] / ZOOMS[this.zoomIndex];
    // Mantiene fijo en pantalla el punto bajo el puntero (o el centro).
    const ax = anchor ? anchor.x - this.mapImage.x : this.center.x;
    const ay = anchor ? anchor.y - this.mapImage.y : this.center.y;
    const offX = this.center.x - ax;
    const offY = this.center.y - ay;
    this.zoomIndex = next;
    this.level();
    this.center = { x: ax * ratio + offX, y: ay * ratio + offY };
    audio.play('click');
    this.applyView();
  }

  private drawPaths(): void {
    const g = this.paths;
    g.clear();
    const save = saveStore.get();
    for (let i = 0; i < BARRIOS.length - 1; i++) {
      const a = this.screenOf(this.labelPoint(i));
      const b = this.screenOf(this.labelPoint(i + 1));
      const unlocked = isBarrioUnlocked(save, BARRIOS[i + 1].id);
      const progress = this.pathProgress.get(i + 1) ?? (unlocked ? 1 : 0);
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.floor(dist / 5));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const lit = progress > 0 && t <= progress;
        if (!lit && i > 1 && !isBarrioUnlocked(save, BARRIOS[i].id)) continue; // sólo se insinúa el próximo tramo
        const x = Math.round(a.x + (b.x - a.x) * t);
        const y = Math.round(a.y + (b.y - a.y) * t);
        if (lit) {
          g.fillStyle(0x21142b, 1).fillRect(x - 1, y - 1, 3, 3);
          g.fillStyle(0xffd23f, 1).fillRect(x, y, 1, 1);
        } else if (k % 2 === 0) {
          g.fillStyle(0x21142b, 0.55).fillRect(x, y, 1, 1);
        }
      }
    }
  }

  private updateSelectionOutline(): void {
    const lv = this.level();
    const key = `map-sel-${this.zoomIndex}-${this.geoIndex[this.selected]}`;
    if (!this.textures.exists(key)) {
      const out = lv.renderer.outlineCanvas(this.geoIndex[this.selected], '#ffd23f');
      if (!out) return;
      const tex = this.textures.addCanvas(key, out.canvas);
      if (!tex) return;
      tex.customData = { x: out.x, y: out.y };
    }
    const pos = this.textures.get(key).customData as { x: number; y: number };
    if (!this.selection) {
      this.selection = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(2);
      this.tweens.add({ targets: this.selection, alpha: 0.45, duration: 420, yoyo: true, repeat: -1 });
    } else this.selection.setTexture(key);
    this.selection.setPosition(this.mapImage.x + pos.x, this.mapImage.y + pos.y);
  }

  // -------------------------------------------------------------------------
  // Interfaz
  // -------------------------------------------------------------------------

  private buildUi(): void {
    const depth = 20;
    const bar = this.add.graphics().setDepth(depth);
    bar.fillStyle(0x120c18, 0.82).fillRect(0, 0, GAME_WIDTH, TOP_BAR);
    bar.fillStyle(0x120c18, 0.88).fillRect(0, GAME_HEIGHT - PANEL_H, GAME_WIDTH, PANEL_H);
    bar.fillStyle(0xffd23f, 1).fillRect(0, GAME_HEIGHT - PANEL_H, GAME_WIDTH, 1);

    const back = this.add.image(12, 10, TEX.icons, ICON_FRAMES.back).setDepth(depth).setInteractive({ useHandCursor: true });
    back.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.toMenu());
    addText(this, 24, 6, TEXTS2.map.back, { color: UI_COLORS.cream, depth });
    addText(this, GAME_WIDTH / 2, 6, `${CITY_NAME}`, { color: UI_COLORS.yellow, origin: [0.5, 0], depth });
    this.add.image(GAME_WIDTH - 92, 10, TEX.icons, ICON_FRAMES.coin).setDepth(depth);
    addText(this, GAME_WIDTH - 84, 6, `${saveStore.get().wallet.coins}`, { color: UI_COLORS.yellow, depth });
    const plus = this.add.image(GAME_WIDTH - 12, 10, TEX.icons, ICON_FRAMES.plus).setDepth(depth).setInteractive({ useHandCursor: true });
    const minus = this.add.image(GAME_WIDTH - 32, 10, TEX.icons, ICON_FRAMES.minus).setDepth(depth).setInteractive({ useHandCursor: true });
    plus.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.setZoom(this.zoomIndex + 1));
    minus.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.setZoom(this.zoomIndex - 1));

    const py = GAME_HEIGHT - PANEL_H;
    this.panelTitle = addText(this, 10, py + 6, '', { scale: 2, color: UI_COLORS.yellow, depth });
    this.panelLine = addText(this, 10, py + 25, '', { color: UI_COLORS.cream, depth });
    this.panelNote = addText(this, 10, py + 34, '', { color: UI_COLORS.gray, depth, maxWidth: 300 });
    for (let k = 0; k < 9; k++) this.panelStars.push(this.add.image(0, py + 30, TEX.icons, ICON_FRAMES.starSmall).setDepth(depth).setVisible(false));
    this.enterButton = new Button(this, GAME_WIDTH - 62, py + 20, TEXTS2.map.enter, { width: 100, height: 20, onClick: () => this.enterSelected(), depth });
    const hint = isTouchPrimary() ? TEXTS2.map.hintTouch : TEXTS2.map.hintKeys;
    addText(this, GAME_WIDTH - 4, GAME_HEIGHT - PANEL_H - 2, this.provisional ? TEXTS2.map.fallback : TEXTS2.map.attribution, {
      outline: false,
      color: this.provisional ? UI_COLORS.orange : 0xdfe8ff,
      origin: [1, 1],
      depth,
    });
    addText(this, 6, GAME_HEIGHT - 1, hint, { outline: false, color: 0x8a7f96, origin: [0, 1], depth });
  }

  private select(i: number, sound = true): void {
    this.selected = Phaser.Math.Clamp(i, 0, BARRIOS.length - 1);
    if (sound) audio.play('click');
    const b = BARRIOS[this.selected];
    const save = saveStore.get();
    const unlocked = isBarrioUnlocked(save, b.id);
    this.panelTitle.setText(b.name);
    this.panelStars.forEach((s) => s.setVisible(false));
    let canEnter = false;
    if (b.levels.length === 0) {
      this.panelLine.setText(unlocked ? TEXTS2.map.soon : `${TEXTS2.map.locked} · ${TEXTS2.map.soon}`).setTint(UI_COLORS.orange);
      this.panelNote.setText(unlocked ? TEXTS2.map.soonDetail : unlockRequirement(b.id));
    } else if (!unlocked) {
      this.panelLine.setText(TEXTS2.map.locked).setTint(UI_COLORS.red);
      this.panelNote.setText(unlockRequirement(b.id));
    } else {
      canEnter = true;
      const done = isBarrioCompleted(save, b.id);
      const { stars, max } = barrioStars(save, b);
      const label = `${done ? TEXTS2.map.completed : TEXTS2.map.available} · ${completedLevels(save, b)}/${b.levels.length} · ${barrioProgressPercent(save, b)}%`;
      this.panelLine.setText(label).setTint(done ? UI_COLORS.green : UI_COLORS.cream);
      const x0 = 10 + this.panelLine.width + 8;
      for (let k = 0; k < max; k++) {
        this.panelStars[k].setFrame(k < stars ? ICON_FRAMES.starSmall : ICON_FRAMES.starSmallEmpty).setPosition(x0 + k * 9, GAME_HEIGHT - PANEL_H + 29).setVisible(true);
      }
      this.panelNote.setText(b.provisional ? TEXTS2.map.provisional : '');
    }
    this.enterButton.setEnabled(canEnter);
    this.enterButton.container.setVisible(canEnter);
    if (unlocked && b.levels.length > 0) this.moveToken(this.selected);
    this.updateSelectionOutline();
  }

  private moveToken(i: number): void {
    if (i === this.tokenBarrio) return;
    this.tokenBarrio = i;
    const t = this.screenOf(this.labelPoint(i));
    this.tokenTween?.stop();
    this.tokenTween = this.tweens.add({ targets: this.token, x: Math.round(t.x), y: Math.round(t.y - 2), duration: 240, ease: 'Quad.easeOut' });
  }

  private enterSelected(): void {
    const b = BARRIOS[this.selected];
    if (!isBarrioUnlocked(saveStore.get(), b.id) || b.levels.length === 0 || this.animating) {
      audio.play('lifeLost');
      this.cameras.main.shake(120, 0.003);
      return;
    }
    audio.play('start');
    saveStore.update((s) => (s.currentBarrio = b.id));
    this.cameras.main.fadeOut(220, 18, 12, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.BARRIO, { barrioId: b.id }));
  }

  private toMenu(): void {
    audio.play('click');
    this.scene.start(SCENES.MENU);
  }

  // -------------------------------------------------------------------------
  // Entrada: mouse, teclado y pantalla táctil
  // -------------------------------------------------------------------------

  private isOverUi(_x: number, y: number): boolean {
    return y < TOP_BAR || y > GAME_HEIGHT - PANEL_H;
  }

  /** Barrio de la campaña bajo un punto de la pantalla (o -1). */
  private barrioAt(sx: number, sy: number): number {
    const lv = this.level();
    const x = Math.floor(sx - this.mapImage.x);
    const y = Math.floor(sy - this.mapImage.y);
    if (x < 0 || y < 0 || x >= lv.raster.width || y >= lv.raster.height) return -1;
    const id = lv.raster.ids[y * lv.raster.width + x];
    if (id === 0) return -1;
    return this.geoIndex.indexOf(id - 1);
  }

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.isOverUi(p.x, p.y)) return;
      const active = this.input.manager.pointers.filter((q) => q.isDown);
      if (active.length >= 2) {
        const [a, b] = active;
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
        this.drag = null;
        return;
      }
      this.drag = { id: p.id, x: p.x, y: p.y, cx: this.center.x, cy: this.center.y, moved: false };
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        const active = this.input.manager.pointers.filter((q) => q.isDown);
        if (active.length >= 2) {
          const [a, b] = active;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d / this.pinch.dist > 1.35) {
            this.setZoom(this.zoomIndex + 1, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            this.pinch.dist = d;
          } else if (d / this.pinch.dist < 0.74) {
            this.setZoom(this.zoomIndex - 1, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            this.pinch.dist = d;
          }
        }
        return;
      }
      if (this.drag && p.id === this.drag.id && p.isDown) {
        const dx = p.x - this.drag.x;
        const dy = p.y - this.drag.y;
        if (!this.drag.moved && Math.hypot(dx, dy) > 5) this.drag.moved = true;
        if (this.drag.moved) {
          this.center.x = this.drag.cx - dx;
          this.center.y = this.drag.cy - dy;
          this.applyView();
        }
        return;
      }
      // Mouse sin apretar: nombre del barrio bajo el puntero.
      if (!p.wasTouch) {
        const i = this.isOverUi(p.x, p.y) ? -1 : this.barrioAt(p.x, p.y);
        this.tooltip.setVisible(i >= 0);
        if (i >= 0) this.tooltip.setText(BARRIOS[i].name).setPosition(Math.round(p.x), Math.round(p.y - 6));
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        if (this.input.manager.pointers.filter((q) => q.isDown).length < 2) this.pinch = null;
        return;
      }
      const drag = this.drag;
      this.drag = null;
      if (!drag || drag.moved || p.id !== drag.id || this.isOverUi(p.x, p.y) || this.animating) return;
      const i = this.barrioAt(p.x, p.y);
      if (i < 0) return;
      if (i === this.selected) this.enterSelected();
      else this.select(i);
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.isOverUi(p.x, p.y)) return;
      this.setZoom(this.zoomIndex + (dy < 0 ? 1 : -1), { x: p.x, y: p.y });
    });

    const kb = this.input.keyboard;
    kb?.on('keydown', uniqueKeyEvents((e: KeyboardEvent) => {
      if (this.animating) return;
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.moveSelection(-1, 0);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveSelection(1, 0);
          break;
        case 'ArrowUp':
        case 'KeyW':
          this.moveSelection(0, -1);
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveSelection(0, 1);
          break;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
          this.enterSelected();
          break;
        case 'Equal':
        case 'NumpadAdd':
        case 'KeyE':
          this.setZoom(this.zoomIndex + 1);
          break;
        case 'Minus':
        case 'NumpadSubtract':
        case 'KeyQ':
          this.setZoom(this.zoomIndex - 1);
          break;
        case 'Escape':
        case 'Backspace':
          this.toMenu();
          break;
        default:
          break;
      }
    }));
  }

  /** Navegación espacial: el barrio más cercano en la dirección pedida. */
  private moveSelection(dx: number, dy: number): void {
    const from = this.labelPoint(this.selected, this.level(0));
    let best = -1;
    let bestScore = Infinity;
    BARRIOS.forEach((_, i) => {
      if (i === this.selected) return;
      const p = this.labelPoint(i, this.level(0));
      const vx = p.x - from.x;
      const vy = p.y - from.y;
      const along = vx * dx + vy * dy;
      if (along <= 0) return;
      const across = Math.abs(vx * dy - vy * dx);
      if (across > along * 1.8) return;
      const score = along + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) return;
    this.select(best);
    const s = this.screenOf(this.labelPoint(best));
    if (s.x < 40 || s.x > GAME_WIDTH - 40 || s.y < TOP_BAR + 20 || s.y > GAME_HEIGHT - PANEL_H - 16) this.centerOn(best, true);
  }

  // -------------------------------------------------------------------------
  // Desbloqueo animado
  // -------------------------------------------------------------------------

  private playUnlock(barrioId: string): void {
    const i = BARRIOS.findIndex((b) => b.id === barrioId);
    if (i <= 0) {
      saveStore.update((s) => markUnlockSeen(s, barrioId));
      return;
    }
    this.animating = true;
    this.select(i - 1, false);
    this.centerOn(i - 1, true);
    this.pathProgress.set(i, 0);
    const state = { t: 0, fill: 0 };
    this.tweens.add({
      targets: state,
      t: 1,
      delay: 450,
      duration: 900,
      onUpdate: () => {
        this.pathProgress.set(i, state.t);
        this.drawPaths();
      },
      onComplete: () => {
        audio.play('unlock');
        this.centerOn(i, true);
        let step = 0;
        this.time.addEvent({
          delay: 90,
          repeat: 7,
          callback: () => {
            step++;
            this.composeAll(step < 8 ? { index: i, t: step / 8 } : undefined);
          },
        });
        const lp = this.screenOf(this.labelPoint(i));
        const banner = addText(this, GAME_WIDTH / 2, TOP_BAR + 14, `${TEXTS2.map.unlocked}\n${BARRIOS[i].name}`, {
          scale: 1,
          color: UI_COLORS.yellow,
          origin: [0.5, 0],
          align: 'center',
          depth: 25,
        });
        this.tweens.add({ targets: banner, scale: { from: 0.5, to: 1 }, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: banner, alpha: 0, delay: 2600, duration: 400, onComplete: () => banner.destroy() });
        for (let k = 0; k < 10; k++) {
          const sp = this.add.image(lp.x, lp.y, TEX.icons, ICON_FRAMES.starSmall).setDepth(8);
          const a = (k / 10) * Math.PI * 2;
          this.tweens.add({ targets: sp, x: lp.x + Math.cos(a) * 24, y: lp.y + Math.sin(a) * 18, alpha: 0, duration: 700, onComplete: () => sp.destroy() });
        }
        this.time.delayedCall(800, () => {
          saveStore.update((s) => markUnlockSeen(s, barrioId));
          this.pathProgress.delete(i);
          this.animating = false;
          this.select(i, false);
          this.composeAll();
        });
      },
    });
  }

  /** Para pruebas automatizadas. */
  get selectedBarrio(): BarrioDef {
    return BARRIOS[this.selected];
  }
}
