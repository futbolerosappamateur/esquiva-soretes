import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { NICKNAME_MAX, sanitizeNickname } from '../core/progress';
import { saveStore } from '../core/save';
import { fitToTexture } from '../graphics/renderScale';
import { ensureButtonTexture } from '../graphics/textures/uiTextures';
import { uniqueKeyEvents } from '../input/keyEvents';
import { addText } from '../ui/text';

const ROWS = ['ABCDEFGHIJ', 'KLMNÑOPQRS', 'TUVWXYZ012', '3456789 <>'];
const KEY_W = 26;
const KEY_H = 20;

/**
 * Ingreso del apodo al estilo de los arcades: grilla de letras navegable con
 * flechas o con toques. También se puede escribir directo con el teclado.
 * "<" borra y ">" confirma.
 */
export class NameEntryScene extends Phaser.Scene {
  private mode: 'create' | 'rename' = 'create';
  private profileId = '';
  private next: 'map' | 'menu' = 'map';
  private value = '';
  private row = 0;
  private col = 0;
  private keys: { bg: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText; ch: string }[][] = [];
  private display!: Phaser.GameObjects.BitmapText;
  private blink = 0;

  constructor() {
    super(SCENES.NAME_ENTRY);
  }

  init(data: { mode?: 'create' | 'rename'; profileId?: string; next?: 'map' | 'menu' }): void {
    this.mode = data?.mode ?? 'create';
    this.profileId = data?.profileId ?? '';
    this.next = data?.next ?? 'map';
    const current = saveStore.profiles().find((p) => p.id === this.profileId);
    this.value = this.mode === 'rename' && current ? current.nickname : '';
    this.row = 0;
    this.col = 0;
    this.keys = [];
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.profiles;
    this.cameras.main.setBackgroundColor('#2a1d33');
    addText(this, cx, 10, this.mode === 'create' ? t.newTitle : t.renameTitle, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    this.display = addText(this, cx, 40, '', { scale: 2, color: UI_COLORS.white, origin: [0.5, 0] });
    addText(this, cx, 62, t.nameHint, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] });

    const x0 = cx - (KEY_W * 10) / 2 + KEY_W / 2;
    ROWS.forEach((row, r) => {
      const line: { bg: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText; ch: string }[] = [];
      [...row].forEach((ch, c) => {
        const x = x0 + c * KEY_W;
        const y = 92 + r * (KEY_H + 4);
        const bg = fitToTexture(this.add.image(x, y, ensureButtonTexture(this.textures, KEY_W - 3, KEY_H, 'idle'))).setInteractive({ useHandCursor: true });
        const text = ch === ' ' ? 'ESP' : ch === '<' ? '←' : ch === '>' ? 'OK' : ch;
        const label = addText(this, x, y, text, { outline: false, color: UI_COLORS.cream, origin: 0.5 });
        bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
          this.row = r;
          this.col = c;
          this.press(ch);
        });
        line.push({ bg, label, ch });
      });
      this.keys.push(line);
    });

    this.input.keyboard?.on('keydown', uniqueKeyEvents((e: KeyboardEvent) => this.onKey(e)));
    this.refresh();
  }

  private onKey(e: KeyboardEvent): void {
    const k = e.key.toUpperCase();
    if (e.code === 'ArrowLeft') this.move(0, -1);
    else if (e.code === 'ArrowRight') this.move(0, 1);
    else if (e.code === 'ArrowUp') this.move(-1, 0);
    else if (e.code === 'ArrowDown') this.move(1, 0);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.press(this.keys[this.row][this.col].ch);
    else if (e.code === 'Backspace') this.press('<');
    else if (e.code === 'Escape') this.cancel();
    else if (k.length === 1 && /[A-ZÑ0-9 ]/.test(k)) this.type(k);
  }

  private move(dr: number, dc: number): void {
    this.row = (this.row + dr + ROWS.length) % ROWS.length;
    this.col = (this.col + dc + 10) % 10;
    audio.play('click');
    this.refresh();
  }

  private type(ch: string): void {
    if (this.value.length >= NICKNAME_MAX) return;
    if (ch === ' ' && (this.value.length === 0 || this.value.endsWith(' '))) return;
    this.value += ch;
    audio.play('click');
    this.refresh();
  }

  private press(ch: string): void {
    if (ch === '<') {
      this.value = this.value.slice(0, -1);
      audio.play('click');
      this.refresh();
    } else if (ch === '>') {
      this.confirm();
    } else {
      this.type(ch);
    }
  }

  private confirm(): void {
    const name = sanitizeNickname(this.value);
    if (!name) {
      audio.play('lifeLost');
      this.cameras.main.shake(100, 0.004);
      return;
    }
    if (this.mode === 'create') saveStore.createProfile(name);
    else saveStore.renameProfile(this.profileId, name);
    audio.play('select');
    this.scene.start(SCENES.PROFILES, { next: this.next });
  }

  private cancel(): void {
    audio.play('click');
    this.scene.start(SCENES.PROFILES, { next: this.next });
  }

  private refresh(): void {
    this.keys.forEach((line, r) =>
      line.forEach((k, c) => {
        const focus = r === this.row && c === this.col;
        k.bg.setTexture(ensureButtonTexture(this.textures, KEY_W - 3, KEY_H, focus ? 'focus' : 'idle'));
        k.label.setTint(focus ? 0x21142b : 0xfff4d6);
      }),
    );
  }

  update(_time: number, delta: number): void {
    this.blink += delta / 1000;
    const cursor = this.value.length < NICKNAME_MAX && Math.floor(this.blink * 2) % 2 === 0 ? '-' : ' ';
    this.display.setText(`${this.value}${cursor}`);
    void GAME_HEIGHT;
  }
}
