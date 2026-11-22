import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants';
import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { barrioStars } from '../core/progress';
import { recordsRepo } from '../core/recordsRepository';
import { saveStore } from '../core/save';
import { BARRIOS } from '../data/campaign';
import { ICON_FRAMES } from '../graphics/keys';
import { Button } from '../ui/Button';
import { ButtonMenu, type MenuItem } from '../ui/ButtonMenu';
import { addDim, addPanel } from '../ui/Panel';
import { addText } from '../ui/text';
import { profileSession } from '../core/profileSession';
import { online } from '../social/onlineSession';
import { openAccountPanel } from '../social/ui/accountPanel';
import { isPanelOpen } from '../social/ui/overlay';
import { addIcon } from '../graphics/textures/uiTextures';

export { profileSession };

/**
 * ¿Quién juega? Perfiles locales (sin registro ni correo: quedan en este
 * navegador) y copias locales de perfiles online (marcadas ONLINE: su
 * progreso se guarda en la cuenta y se puede jugar sin conexión).
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
    addText(this, cx, 6, t.title, { scale: 2, color: UI_COLORS.yellow, origin: [0.5, 0] });
    addText(this, cx, 28, t.subtitle, { outline: false, color: UI_COLORS.gray, origin: [0.5, 0] });

    const active = saveStore.activeProfile().id;
    const items: MenuItem[] = [];
    const profiles = saveStore.profiles();
    let y = 50;
    profiles.forEach((p) => {
      const stars = BARRIOS.filter((b) => b.levels.length).reduce((acc, b) => acc + barrioStars(p.data as never, b).stars, 0);
      const b = new Button(this, cx - 30, y, p.nickname, { width: 160, height: 19, onClick: () => this.choose(p.id) });
      addIcon(this, cx + 64, y, ICON_FRAMES.starSmall);
      addText(this, cx + 71, y - 4, `${stars}`, { color: UI_COLORS.yellow });
      addIcon(this, cx + 96, y, ICON_FRAMES.coin);
      addText(this, cx + 103, y - 4, `${p.data.wallet.coins}`, { color: UI_COLORS.yellow });
      if (p.id === active) addText(this, cx - 116, y - 4, '>', { color: UI_COLORS.green, origin: [1, 0] });
      if (p.online) {
        const connected = online.status === 'signedIn' && online.user?.id === p.online.accountId;
        addText(this, cx + 132, y - 4, TEXTS2.online.tag, { outline: false, color: connected ? UI_COLORS.green : UI_COLORS.gray });
      }
      items.push({ button: b });
      y += 22;
    });
    const initial = Math.max(0, profiles.findIndex((p) => p.id === active));
    y = Math.max(y + 6, 192);
    if (saveStore.canCreateProfile()) {
      items.push({ button: new Button(this, cx - 112, y, t.create, { width: 106, height: 17, onClick: () => this.toNameEntry('create') }) });
    }
    items.push({ button: new Button(this, cx, y, t.rename, { width: 106, height: 17, onClick: () => this.rename() }) });
    if (profiles.length > 1) items.push({ button: new Button(this, cx + 112, y, t.remove, { width: 106, height: 17, onClick: () => this.confirmDelete() }) });
    if (online.configured) {
      items.push({ button: new Button(this, cx - 75, GAME_HEIGHT - 24, t.back, { width: 140, height: 17, onClick: () => this.back() }) });
      items.push({ button: new Button(this, cx + 75, GAME_HEIGHT - 24, TEXTS2.online.account, { width: 140, height: 17, onClick: () => this.openAccount() }) });
    } else {
      items.push({ button: new Button(this, cx, GAME_HEIGHT - 24, t.back, { width: 140, height: 17, onClick: () => this.back() }) });
    }
    new ButtonMenu(this, items, { onBack: () => this.back(), initial });
    addText(this, cx, GAME_HEIGHT - 4, online.configured ? TEXTS2.online.localNoteOnline : t.localNote, { outline: false, color: 0x8a7f96, origin: [0.5, 1] });
    this.cameras.main.fadeIn(180, 18, 12, 24);
  }

  private choose(id: string): void {
    saveStore.selectProfile(id);
    profileSession.chosen = true;
    audio.play('start');
    this.scene.start(this.next === 'map' ? SCENES.WORLD_MAP : SCENES.MENU);
  }

  /** Cuenta online: entrar, crear perfiles online o elegir con cuál jugar. */
  private openAccount(editProfileId?: string): void {
    if (isPanelOpen()) return;
    openAccountPanel({
      editProfileId,
      onClose: ({ played }) => {
        if (!played) {
          this.scene.restart({ next: this.next });
          return;
        }
        audio.play('start');
        this.scene.start(this.next === 'map' ? SCENES.WORLD_MAP : SCENES.MENU);
      },
    });
  }

  /** El apodo de un perfil online se cambia en la cuenta (es público y único). */
  private rename(): void {
    const link = saveStore.activeProfile().online;
    if (link) this.openAccount(link.profileId);
    else this.toNameEntry('rename');
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
    addText(this, cx, 112, p.online ? TEXTS2.online.removeLinked : t.removeDetail, { outline: false, color: UI_COLORS.cream, origin: [0.5, 0], align: 'center', maxWidth: 270, depth: 51 });
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
