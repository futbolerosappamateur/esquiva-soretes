import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { spendCoins } from '../core/progress';
import { createRun } from '../core/RunState';
import { saveStore } from '../core/save';
import type { LevelRef } from '../data/campaign';
import { CHARACTERS, getCharacter } from '../data/characters';
import { ANIM } from '../graphics/animations';
import { ensureCharacterPreview } from '../graphics/characterTextures';
import { FX_FRAMES, ICON_FRAMES, TEX } from '../graphics/keys';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { Button } from '../ui/Button';
import { ButtonMenu } from '../ui/ButtonMenu';
import { addText } from '../ui/text';

/**
 * Selección de personaje (antes de cada partida). Todos tienen las mismas
 * capacidades: la elección es sólo visual y se guarda en LocalStorage.
 */
export class CharacterSelectScene extends Phaser.Scene {
  private levelRef: LevelRef = { barrioId: 'san-telmo', levelIndex: 0 };
  private index = 0;
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private locks: (Phaser.GameObjects.Image | null)[] = [];
  private nameText!: Phaser.GameObjects.BitmapText;
  private descText!: Phaser.GameObjects.BitmapText;
  private costText!: Phaser.GameObjects.BitmapText;
  private coinsText!: Phaser.GameObjects.BitmapText;
  private playButton!: Button;
  private unlockButton!: Button;
  private marker!: Phaser.GameObjects.Image;

  constructor() {
    super(SCENES.CHARACTER);
  }

  init(data: { levelRef?: LevelRef }): void {
    if (data?.levelRef) this.levelRef = data.levelRef;
    this.sprites = [];
    this.locks = [];
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.character;
    this.cameras.main.setBackgroundColor('#2a1d33');
    addText(this, cx, 8, t.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    this.add.image(GAME_WIDTH - 60, 14, TEX.icons, ICON_FRAMES.coin);
    this.coinsText = addText(this, GAME_WIDTH - 52, 10, '', { color: UI_COLORS.yellow });

    const save = saveStore.get();
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.selectedCharacter));
    const spacing = 88;
    const x0 = cx - ((CHARACTERS.length - 1) * spacing) / 2;
    const floorY = 132;
    const floor = this.add.graphics();
    floor.fillStyle(0x3b2741, 1).fillRect(0, floorY - 2, GAME_WIDTH, 30);
    floor.fillStyle(0x4a3657, 1).fillRect(0, floorY - 2, GAME_WIDTH, 2);
    CHARACTERS.forEach((c, i) => {
      const key = ensureCharacterPreview(this, c.id);
      const x = Math.round(x0 + i * spacing);
      this.add.image(x, floorY, TEX.fx, FX_FRAMES.shadow).setScale(2).setAlpha(0.35);
      const s = this.add.sprite(x, floorY, key, 'idle0').setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY).setScale(2);
      s.play({ key: ANIM.preview(c.id), startFrame: i % 3 });
      s.setInteractive({ useHandCursor: true, pixelPerfect: false });
      s.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => (this.index === i ? this.confirm() : this.setIndex(i, true)));
      this.sprites.push(s);
      this.locks.push(null);
    });
    this.marker = this.add.image(0, 0, TEX.icons, ICON_FRAMES.arrowDown).setScale(2);
    this.tweens.add({ targets: this.marker, y: '+=4', duration: 340, yoyo: true, repeat: -1 });

    this.nameText = addText(this, cx, 160, '', { scale: 2, color: UI_COLORS.white, origin: [0.5, 0] });
    this.descText = addText(this, cx, 180, '', { color: UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: 380 });
    this.costText = addText(this, cx, 194, '', { color: UI_COLORS.orange, origin: [0.5, 0] });
    addText(this, cx, GAME_HEIGHT - 10, t.sameStats, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0.5] });

    this.playButton = new Button(this, cx - 70, 222, t.play, { width: 130, height: 19, onClick: () => this.confirm() });
    this.unlockButton = new Button(this, cx - 70, 222, t.unlock, { width: 130, height: 19, onClick: () => this.unlock() });
    const back = new Button(this, cx + 70, 222, t.back, { width: 120, height: 19, onClick: () => this.back() });
    new ButtonMenu(this, [{ button: this.playButton }, { button: back }], { onBack: () => this.back() }).setEnabled(false);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.setIndex(this.index - 1, true);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.setIndex(this.index + 1, true);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') this.confirm();
      else if (e.code === 'Escape' || e.code === 'Backspace') this.back();
    });
    this.refreshLocks();
    this.setIndex(this.index, false);
    this.cameras.main.fadeIn(200, 18, 12, 24);
  }

  private isUnlocked(id: string): boolean {
    return saveStore.get().unlocks.characters.includes(id);
  }

  private refreshLocks(): void {
    CHARACTERS.forEach((c, i) => {
      const s = this.sprites[i];
      const unlocked = this.isUnlocked(c.id);
      s.setTint(unlocked ? 0xffffff : 0x3a3048);
      if (!unlocked && !this.locks[i]) this.locks[i] = this.add.image(s.x, s.y - 50, TEX.icons, ICON_FRAMES.lock).setScale(2);
      if (unlocked && this.locks[i]) {
        this.locks[i]!.destroy();
        this.locks[i] = null;
      }
    });
    this.coinsText.setText(`${saveStore.get().wallet.coins}`);
  }

  private setIndex(i: number, sound: boolean): void {
    const n = CHARACTERS.length;
    this.index = ((i % n) + n) % n;
    if (sound) audio.play('click');
    const c = CHARACTERS[this.index];
    const s = this.sprites[this.index];
    this.marker.setPosition(s.x, 40);
    this.sprites.forEach((sp, k) => sp.setScale(k === this.index ? 2 : 2).setAlpha(k === this.index ? 1 : 0.75));
    this.nameText.setText(c.name);
    this.descText.setText(c.description);
    const unlocked = this.isUnlocked(c.id);
    if (!unlocked && c.unlock.kind === 'coins') {
      const enough = saveStore.get().wallet.coins >= c.unlock.cost;
      this.costText.setText(`${TEXTS2.character.locked} · ${c.unlock.cost} MONEDAS${enough ? '' : ` · ${TEXTS2.character.notEnough}`}`);
      this.unlockButton.setEnabled(enough);
    } else {
      this.costText.setText('');
    }
    this.playButton.container.setVisible(unlocked);
    this.unlockButton.container.setVisible(!unlocked);
    this.playButton.setEnabled(unlocked);
    if (unlocked) this.unlockButton.setEnabled(false);
    if (unlocked) saveStore.update((sv) => (sv.selectedCharacter = c.id));
  }

  private unlock(): void {
    const c = CHARACTERS[this.index];
    if (c.unlock.kind !== 'coins' || this.isUnlocked(c.id)) return;
    const cost = c.unlock.cost;
    const ok = saveStore.update((s) => {
      if (!spendCoins(s, cost)) return false;
      s.unlocks.characters.push(c.id);
      s.selectedCharacter = c.id;
      return true;
    });
    if (!ok) {
      audio.play('lifeLost');
      return;
    }
    audio.play('unlock');
    this.refreshLocks();
    this.setIndex(this.index, false);
  }

  private confirm(): void {
    const c = CHARACTERS[this.index];
    if (!this.isUnlocked(c.id)) {
      if (c.unlock.kind === 'coins' && saveStore.get().wallet.coins >= c.unlock.cost) this.unlock();
      else audio.play('lifeLost');
      return;
    }
    saveStore.update((s) => (s.selectedCharacter = getCharacter(c.id).id));
    audio.play('start');
    this.cameras.main.fadeOut(240, 18, 12, 24);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.GAME, { run: createRun(this.levelRef) });
    });
  }

  private back(): void {
    audio.play('click');
    this.scene.start(SCENES.BARRIO, { barrioId: this.levelRef.barrioId });
  }
}
