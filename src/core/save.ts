import {
  createDefaultSave,
  createProfile,
  MAX_PROFILES,
  migrateSaveFile,
  sanitizeNickname,
  type OnlineLink,
  type ProfileRecord,
  type SaveData,
  type SaveFile,
} from './progress';
import { loadRaw, saveJSON } from './storage';

const KEY = 'save';

type Listener = (save: Readonly<SaveData>) => void;

/**
 * Progreso persistente en LocalStorage, con perfiles locales: cada perfil
 * (un apodo, sin registro ni correo) tiene su propia campaña, monedas,
 * personajes y logros. `get()` y `update()` trabajan sobre el perfil activo.
 *
 * Convive con las claves de versiones anteriores ('records' y 'settings'),
 * que no se tocan: los récords existentes se conservan siempre.
 */
export class SaveStore {
  private file: SaveFile;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.file = migrateSaveFile(loadRaw(KEY));
    this.persist();
  }

  private get active(): ProfileRecord {
    return this.file.profiles.find((p) => p.id === this.file.activeProfileId) ?? this.file.profiles[0];
  }

  /** Progreso del perfil activo. */
  get(): Readonly<SaveData> {
    return this.active.data;
  }

  /** Aplica un cambio al perfil activo y lo guarda en el acto. */
  update<T>(mutate: (draft: SaveData) => T): T {
    const result = mutate(this.active.data);
    this.persist();
    this.notify();
    return result;
  }

  /** Reinicia la campaña, las monedas, los personajes y los logros del perfil activo. */
  resetProgress(): void {
    this.active.data = createDefaultSave();
    this.persist();
    this.notify();
  }

  // --- Perfiles -----------------------------------------------------------

  activeProfile(): Readonly<{ id: string; nickname: string; createdAt: string; online: OnlineLink | null }> {
    const p = this.active;
    return { id: p.id, nickname: p.nickname, createdAt: p.createdAt, online: p.online ? { ...p.online } : null };
  }

  profiles(): { id: string; nickname: string; createdAt: string; data: Readonly<SaveData>; online: OnlineLink | null }[] {
    return this.file.profiles.map((p) => ({ id: p.id, nickname: p.nickname, createdAt: p.createdAt, data: p.data, online: p.online ? { ...p.online } : null }));
  }

  // --- Perfiles online (copias locales) -----------------------------------

  /** Id del perfil local vinculado a un perfil online (o null). */
  findByOnline(onlineProfileId: string): string | null {
    return this.file.profiles.find((p) => p.online?.profileId === onlineProfileId)?.id ?? null;
  }

  /**
   * Crea la copia local de un perfil online (o devuelve la que ya existe).
   * Devuelve null si no hay lugar para otro perfil en este dispositivo.
   */
  createLinkedProfile(nickname: string, link: OnlineLink, data: SaveData): string | null {
    const existing = this.findByOnline(link.profileId);
    if (existing) return existing;
    if (!this.canCreateProfile()) return null;
    const p = createProfile(sanitizeNickname(nickname) || 'JUGADOR', data);
    p.online = { ...link };
    this.file.profiles.push(p);
    this.persist();
    return p.id;
  }

  /** Vincula (o desvincula, con null) un perfil local existente. */
  linkProfile(localId: string, link: OnlineLink | null): boolean {
    const p = this.file.profiles.find((x) => x.id === localId);
    if (!p) return false;
    if (link) {
      for (const other of this.file.profiles) if (other !== p && other.online?.profileId === link.profileId) delete other.online;
      p.online = { ...link };
    } else {
      delete p.online;
    }
    this.persist();
    this.notify();
    return true;
  }

  /** Reemplaza el progreso de un perfil (al sincronizar con el servidor). */
  replaceProfileData(localId: string, data: SaveData, nickname?: string): boolean {
    const p = this.file.profiles.find((x) => x.id === localId);
    if (!p) return false;
    p.data = data;
    if (nickname) p.nickname = sanitizeNickname(nickname) || p.nickname;
    this.persist();
    if (p === this.active) this.notify();
    return true;
  }

  canCreateProfile(): boolean {
    return this.file.profiles.length < MAX_PROFILES;
  }

  /** Crea un perfil nuevo y lo deja activo. Devuelve su id (o null si no hay lugar). */
  createProfile(nickname: string): string | null {
    if (!this.canCreateProfile()) return null;
    const p = createProfile(sanitizeNickname(nickname) || `JUGADOR ${this.file.profiles.length + 1}`);
    this.file.profiles.push(p);
    this.file.activeProfileId = p.id;
    this.persist();
    this.notify();
    return p.id;
  }

  selectProfile(id: string): boolean {
    if (!this.file.profiles.some((p) => p.id === id)) return false;
    this.file.activeProfileId = id;
    this.persist();
    this.notify();
    return true;
  }

  renameProfile(id: string, nickname: string): boolean {
    const p = this.file.profiles.find((x) => x.id === id);
    const clean = sanitizeNickname(nickname);
    if (!p || !clean) return false;
    p.nickname = clean;
    this.persist();
    return true;
  }

  /** Borra un perfil (nunca el último). */
  deleteProfile(id: string): boolean {
    if (this.file.profiles.length <= 1) return false;
    const i = this.file.profiles.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.file.profiles.splice(i, 1);
    if (this.file.activeProfileId === id) this.file.activeProfileId = this.file.profiles[0].id;
    this.persist();
    this.notify();
    return true;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.active.data));
  }

  private persist(): void {
    saveJSON(KEY, this.file);
  }
}

export const saveStore = new SaveStore();
