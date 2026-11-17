import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { barrioStars } from '../core/progress';
import { recordsRepo } from '../core/recordsRepository';
import { saveStore } from '../core/save';
import { BARRIOS } from '../data/campaign';
import { ICON_FRAMES, TEX } from '../graphics/keys';
import { Button } from '../ui/Button';
import { ButtonMenu, type MenuItem } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';

/** Se elige perfil una vez por sesión antes de ir al mapa. */
export const profileSession = { chosen: false };

/**
 * Perfiles locales: cada jugador de la casa tiene su apodo, su progreso y sus
 * récords. Sin registro ni correo: todo queda en este navegador.
 */
export class ProfileSelectScene extends Phaser.Scene {
  private next: 'map' | 'menu' = 'map';
  private confirming = false;

  constructor() {
    super(SCENES.PROFILES);
  }

  init(data: { next?: 'map' | 'menu' }): void {
    this.next = data?.next ?? 'map';
    this.confirming = false;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const t = TEXTS2.profiles;
    this.cameras.main.setBackgroundColor('#2a1d33');
    addText(this, cx, 8, t.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    addText(this, cx, 28, t.subtitle, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] });

    const active = saveStore.activeProfile().id;
    const items: MenuItem[] = [];
    const profiles = saveStore.profiles();
    let y = 50;
    profiles.forEach((p) => {
      const stars = BARRIOS.filter((b) => b.levels.length).reduce((acc, b) => acc + barrioStars(p.data as never, b).stars, 0);
      const b = new Button(this, cx - 30, y, p.nickname, { width: 160, height: 19, onClick: () => this.choose(p.id) });
      this.add.image(cx + 64, y, TEX.icons, ICON_FRAMES.starSmall);
      addText(this, cx + 71, y - 4, `${stars}`, { color: UI_COLORS.yellow });
      this.add.image(cx + 96, y, TEX.icons, ICON_FRAMES.coin);
      addText(this, cx + 103, y - 4, `${p.data.wallet.coins}`, { color: UI_COLORS.yellow });
      if (p.id === active) addText(this, cx - 116, y - 4, '>', { color: UI_COLORS.green, origin: [1, 0] });
      items.push({ button: b });
      y += 22;
    });
    const initial = Math.max(0, profiles.findIndex((p) => p.id === active));
    y = Math.max(y + 6, 192);
    if (saveStore.canCreateProfile()) {
      items.push({ button: new Button(this, cx - 112, y, t.create, { width: 106, height: 17, onClick: () => this.toNameEntry('create') }) });
    }
    items.push({ button: new Button(this, cx, y, t.rename, { width: 106, height: 17, onClick: () => this.toNameEntry('rename') }) });
    if (profiles.length > 1) items.push({ button: new Button(this, cx + 112, y, t.remove, { width: 106, height: 17, onClick: () => this.confirmDelete() }) });
    items.push({ button: new Button(this, cx, GAME_HEIGHT - 18, t.back, { width: 140, height: 17, onClick: () => this.back() }) });
    new ButtonMenu(this, items, { onBack: () => this.back(), initial });
    addText(this, cx, GAME_HEIGHT - 6, t.localNote, { outline: false, color: 0x8a7f96, origin: [0.5, 1] });
    this.cameras.main.fadeIn(180, 18, 12, 24);
  }

  private choose(id: string): void {
    saveStore.selectProfile(id);
    profileSession.chosen = true;
    audio.play('start');
    this.scene.start(this.next === 'map' ? SCENES.WORLD_MAP : SCENES.MENU);
  }

  private toNameEntry(mode: 'create' | 'rename'): void {
    this.scene.start(SCENES.NAME_ENTRY, { mode, profileId: saveStore.activeProfile().id, next: this.next });
  }

  private confirmDelete(): void {
    if (this.confirming) return;
    this.confirming = true;
    const cx = GAME_WIDTH / 2;
    const p = saveStore.activeProfile();
    const t = TEXTS2.profiles;
    addDim(this, 0.7, 50);
    addPanel(this, cx, 135, 300, 110, 50);
    addText(this, cx, 96, `${t.removeConfirm} ${p.nickname}?`, { color: UI_COLORS.red, origin: [0.5, 0], depth: 51 });
    addText(this, cx, 112, t.removeDetail, { outline: false, color: UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: 270, depth: 51 });
    const no = new Button(this, cx - 70, 160, t.no, { width: 110, height: 18, depth: 51, onClick: () => this.scene.restart({ next: this.next }) });
    const yes = new Button(this, cx + 70, 160, t.yes, {
      width: 110,
      height: 18,
      depth: 51,
      onClick: () => {
        if (saveStore.deleteProfile(p.id)) recordsRepo.removeProfile(p.id);
        this.scene.restart({ next: this.next });
      },
    });
    new ButtonMenu(this, [{ button: no }, { button: yes }], { depth: 51, onBack: () => this.scene.restart({ next: this.next }) });
  }

  private back(): void {
    audio.play('click');
    this.scene.start(SCENES.MENU);
  }
}
