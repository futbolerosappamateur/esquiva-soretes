import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { FONTS } from '../graphics/BitmapFontBuilder';
import { ensureButtonTexture, type ButtonState } from '../graphics/textures/uiTextures';

export interface ButtonOptions {
  width?: number;
  height?: number;
  onClick: () => void;
  depth?: number;
}

/** Botón pixelado que funciona con mouse, toque y teclado (vía ButtonMenu). */
export class Button {
  readonly container: Phaser.GameObjects.Container;
  readonly width: number;
  readonly height: number;
  /** Lo usa ButtonMenu para enfocar el botón al pasar el mouse. */
  onHover?: () => void;
  private readonly bg: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.BitmapText;
  private readonly keys: Record<ButtonState, string>;
  private focused = false;
  private pressed = false;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    private readonly opts: ButtonOptions,
  ) {
    this.width = opts.width ?? 132;
    this.height = opts.height ?? 20;
    this.keys = {
      idle: ensureButtonTexture(scene.textures, this.width, this.height, 'idle'),
      focus: ensureButtonTexture(scene.textures, this.width, this.height, 'focus'),
      down: ensureButtonTexture(scene.textures, this.width, this.height, 'down'),
    };
    this.bg = scene.add.image(0, 0, this.keys.idle);
    this.label = scene.add.bitmapText(0, 0, FONTS.PLAIN, text.toUpperCase()).setOrigin(0.5, 0.5);
    // Los botones son interfaz: no se mueven con la cámara.
    // (también en los hijos, así el área táctil sigue al botón aunque la cámara se mueva).
    this.container = scene.add.container(Math.round(x), Math.round(y), [this.bg, this.label]).setScrollFactor(0, 0, true);
    if (opts.depth !== undefined) this.container.setDepth(opts.depth);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.onHover?.());
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.pressed = false;
      this.refresh();
    });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.pressed = true;
      this.onHover?.();
      this.refresh();
    });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.pressed) this.activate();
    });
    this.refresh();
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    this.refresh();
  }

  setText(text: string): void {
    this.label.setText(text.toUpperCase());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.setAlpha(enabled ? 1 : 0.5);
  }

  activate(): void {
    this.pressed = false;
    this.refresh();
    if (!this.enabled) return;
    audio.play('select');
    this.opts.onClick();
  }

  private refresh(): void {
    const state: ButtonState = this.pressed ? 'down' : this.focused ? 'focus' : 'idle';
    this.bg.setTexture(this.keys[state]);
    this.label.setTint(state === 'idle' ? 0xfff4d6 : 0x21142b);
    this.label.setY(this.pressed ? 1 : 0);
  }

  destroy(): void {
    this.container.destroy();
  }
}
