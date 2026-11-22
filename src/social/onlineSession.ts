import type { GameMode } from '../core/leaderboard';
import { profileSession } from '../core/profileSession';
import type { SaveData } from '../core/progress';
import { recordsRepo } from '../core/recordsRepository';
import { saveStore } from '../core/save';
import { loadRaw, saveJSON } from '../core/storage';
import { createSupabaseBackend, SocialError, toSocialError, type AuthEventName, type AuthUser, type SocialBackend } from './backend';
import { CLIENT_VERSION, ONLINE_CONFIG, TERMS_VERSION } from './config';
import { Outbox } from './outbox';
import { buildRunReport, type RunReportSource } from './runReport';
import { importPayloadFrom, localBestEntries, saveFromServer } from './stateMapping';
import type {
  AccountInfo,
  HistoryEntry,
  LeaderboardKind,
  LeaderboardResult,
  LeaderboardScope,
  MyState,
  PersonalRecord,
  ProfileCard,
  ProfileState,
  PublicProfile,
  RunResult,
  Visibility,
} from './types';

/**
 * Sesión online: cuenta, perfiles, sincronización y envío de partidas.
 *
 * - Sin configuración (o sin conexión) el juego sigue en modo local.
 * - Un perfil online tiene una copia local (para jugar sin conexión); el
 *   servidor manda: cada respuesta reemplaza esa copia.
 * - Las partidas se guardan primero en una cola local y se mandan en orden;
 *   si no hay conexión o sesión, se reintentan más tarde.
 */
export type OnlineStatus = 'disabled' | 'starting' | 'signedOut' | 'signedIn' | 'offline';

export interface Submission {
  state: 'sending' | 'queued' | 'waitingLogin' | 'done' | 'error';
  result?: RunResult;
  error?: string;
}

export interface ProfileInput {
  nickname: string;
  avatarId: string;
  favoriteCharacter: string | null;
  supervised: boolean;
  guardianConsent: boolean;
}

export interface ProfileChanges {
  nickname?: string;
  avatarId?: string;
  favoriteCharacter?: string | null;
  visibility?: Visibility;
  showInRankings?: boolean;
  socialEnabled?: boolean;
  guardianConsent?: boolean;
}

const RETRY_MS = 30_000;

export class OnlineSession {
  status: OnlineStatus;
  user: AuthUser | null = null;
  account: AccountInfo | null = null;
  profiles: ProfileState[] = [];
  maxProfiles = 6;
  /** Se abrió el juego desde el enlace para elegir una contraseña nueva. */
  passwordRecovery = false;
  /** Último problema con el servidor (por ejemplo 'server_not_ready'). */
  lastError: string | null = null;

  private backend: SocialBackend | null = null;
  private starting: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly submissions = new Map<string, Submission>();
  private outboxStore: Outbox | null = null;
  private flushing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineListener = false;

  constructor(private readonly backendFactory: () => Promise<SocialBackend> = () => createSupabaseBackend(ONLINE_CONFIG)) {
    this.status = ONLINE_CONFIG.configured ? 'starting' : 'disabled';
  }

  get configured(): boolean {
    return this.status !== 'disabled';
  }

  get outbox(): Outbox {
    this.outboxStore ??= new Outbox({ load: () => loadRaw('outbox'), save: (v) => saveJSON('outbox', v) });
    return this.outboxStore;
  }

  // ---------------------------------------------------------------- eventos

  on(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  private setStatus(status: OnlineStatus): void {
    if (this.status === 'disabled') return;
    this.status = status;
    this.emit();
  }

  // ------------------------------------------------------------- arranque

  init(): Promise<void> {
    if (this.status === 'disabled') return Promise.resolve();
    this.starting ??= this.start();
    return this.starting;
  }

  private async start(): Promise<void> {
    try {
      this.backend = await this.backendFactory();
    } catch {
      // Sin conexión ni siquiera se pudo cargar la librería: se reintenta después.
      this.starting = null;
      this.setStatus('offline');
      this.scheduleRetry();
      return;
    }
    this.backend.onAuthChange((event, user) => {
      // Supabase recomienda no llamar a otras funciones dentro de este aviso.
      setTimeout(() => void this.handleAuth(event, user), 0);
    });
    if (!this.onlineListener && typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.refresh());
      this.onlineListener = true;
    }
    this.user = await this.backend.currentUser().catch(() => null);
    if (this.user) await this.refresh();
    else this.setStatus('signedOut');
  }

  private async handleAuth(event: AuthEventName, user: AuthUser | null): Promise<void> {
    if (event === 'PASSWORD_RECOVERY') {
      this.passwordRecovery = true;
      this.user = user;
      await this.refresh();
      return;
    }
    if (event === 'SIGNED_OUT' || !user) {
      this.clearAccount();
      this.setStatus('signedOut');
      return;
    }
    const changed = this.user?.id !== user.id;
    this.user = user;
    if (changed || this.status !== 'signedIn') await this.refresh();
  }

  private clearAccount(): void {
    this.user = null;
    this.account = null;
    this.profiles = [];
  }

  /** Trae el estado de la cuenta, manda lo pendiente y sincroniza las copias locales. */
  async refresh(): Promise<void> {
    if (this.status === 'disabled') return;
    if (!this.backend) {
      await this.init();
      return;
    }
    if (!this.user) {
      this.setStatus('signedOut');
      return;
    }
    try {
      const st = await this.backend.rpc<MyState>('get_my_state');
      this.lastError = null;
      this.applyMyState(st);
      this.status = 'signedIn';
      await this.flush();
      this.syncLinkedProfiles();
      this.emit();
    } catch (e) {
      const err = toSocialError(e);
      this.lastError = err.code;
      if (err.code === 'not_authenticated' || err.code === 'forbidden') {
        this.clearAccount();
        this.setStatus('signedOut');
      } else {
        this.setStatus('offline');
        this.scheduleRetry();
      }
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || typeof setTimeout === 'undefined') return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.refresh();
    }, RETRY_MS);
  }

  private applyMyState(st: MyState): void {
    this.account = st.account ?? null;
    this.profiles = Array.isArray(st.profiles) ? st.profiles : [];
    this.maxProfiles = st.limits?.maxProfiles ?? this.maxProfiles;
  }

  /** Reemplaza las copias locales de los perfiles de esta cuenta por lo que dice el servidor. */
  private syncLinkedProfiles(): void {
    if (!this.user) return;
    for (const p of saveStore.profiles()) {
      if (!p.online || p.online.accountId !== this.user.id) continue;
      const state = this.profiles.find((s) => s.profile.id === p.online!.profileId);
      if (state) saveStore.replaceProfileData(p.id, saveFromServer(state, p.data as SaveData), state.profile.nickname);
      // Lo borraron desde otro dispositivo: la copia queda como perfil local.
      else saveStore.linkProfile(p.id, null);
    }
  }

  private applyProfileState(state: ProfileState): void {
    const i = this.profiles.findIndex((p) => p.profile.id === state.profile.id);
    if (i >= 0) this.profiles[i] = state;
    else this.profiles.push(state);
    const local = saveStore.profiles().find((p) => p.online?.profileId === state.profile.id);
    if (local) saveStore.replaceProfileData(local.id, saveFromServer(state, local.data as SaveData), state.profile.nickname);
    this.emit();
  }

  private need(): SocialBackend {
    if (!this.backend) throw new SocialError(this.status === 'disabled' ? 'disabled' : 'network', undefined, this.status !== 'disabled');
    return this.backend;
  }

  private async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    try {
      return await this.need().rpc<T>(fn, args);
    } catch (e) {
      const err = toSocialError(e);
      if (err.retryable && this.status === 'signedIn') {
        this.setStatus('offline');
        this.scheduleRetry();
      }
      throw err;
    }
  }

  private redirectUrl(): string {
    return `${window.location.origin}${window.location.pathname}`;
  }

  // --------------------------------------------------------------- cuenta

  async signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    const res = await this.need().signUp(email, password, this.redirectUrl());
    if (!res.needsConfirmation) await this.afterSignIn();
    return res;
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.need().signIn(email, password);
    await this.afterSignIn();
  }

  private async afterSignIn(): Promise<void> {
    this.user = await this.need().currentUser();
    await this.refresh();
  }

  async signOut(): Promise<void> {
    try {
      await this.need().signOut();
    } finally {
      this.clearAccount();
      this.passwordRecovery = false;
      this.setStatus('signedOut');
    }
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.need().requestPasswordReset(email, this.redirectUrl());
  }

  async updatePassword(password: string): Promise<void> {
    await this.need().updatePassword(password);
    this.passwordRecovery = false;
    this.emit();
  }

  async acceptTerms(): Promise<void> {
    this.applyMyState(await this.rpc<MyState>('accept_terms', { p_adult: true, p_terms_version: TERMS_VERSION }));
    this.emit();
  }

  async createProfile(input: ProfileInput): Promise<ProfileState> {
    const state = await this.rpc<ProfileState>('create_profile', {
      p_nickname: input.nickname,
      p_avatar: input.avatarId,
      p_favorite: input.favoriteCharacter,
      p_supervised: input.supervised,
      p_guardian_consent: input.guardianConsent,
    });
    this.applyProfileState(state);
    return state;
  }

  async updateProfile(profileId: string, changes: ProfileChanges): Promise<ProfileState> {
    const state = await this.rpc<ProfileState>('update_profile', { p_profile: profileId, p_changes: changes });
    this.applyProfileState(state);
    return state;
  }

  async deleteProfile(profileId: string): Promise<void> {
    const st = await this.rpc<MyState>('delete_profile', { p_profile: profileId });
    const localId = saveStore.findByOnline(profileId);
    if (localId) saveStore.linkProfile(localId, null);
    this.applyMyState(st);
    this.emit();
  }

  /** Perfil online del perfil local activo, si es de la cuenta conectada. */
  activeOnlineProfile(): ProfileState | null {
    const link = saveStore.activeProfile().online;
    if (!link || !this.user || link.accountId !== this.user.id) return null;
    return this.profiles.find((p) => p.profile.id === link.profileId) ?? null;
  }

  /** Perfil (online) desde el que se mira un ranking o un perfil público. */
  viewerProfileId(): string | null {
    return this.status === 'signedIn' ? (this.activeOnlineProfile()?.profile.id ?? null) : null;
  }

  /**
   * Juega con un perfil online: crea (o actualiza) su copia local y la deja
   * activa. 'no_space' = ya hay 6 perfiles en este dispositivo.
   */
  playAs(profileId: string): 'ok' | 'no_space' | 'not_found' {
    const state = this.profiles.find((p) => p.profile.id === profileId);
    if (!state || !this.user) return 'not_found';
    let localId = saveStore.findByOnline(profileId);
    if (localId) {
      const local = saveStore.profiles().find((p) => p.id === localId)!;
      saveStore.replaceProfileData(localId, saveFromServer(state, local.data as SaveData), state.profile.nickname);
    } else {
      localId = saveStore.createLinkedProfile(state.profile.nickname, { profileId, accountId: this.user.id }, saveFromServer(state, null));
      if (!localId) return 'no_space';
    }
    saveStore.selectProfile(localId);
    profileSession.chosen = true;
    this.emit();
    return 'ok';
  }

  /** Perfiles de este dispositivo que se pueden importar (no vinculados a ningún perfil online). */
  importableLocalProfiles(): { id: string; nickname: string; data: Readonly<SaveData> }[] {
    return saveStore.profiles().filter((p) => !p.online);
  }

  /**
   * Trae el progreso de un perfil local a un perfil online (una sola vez,
   * queda como no verificado) y deja ese perfil local como su copia.
   */
  async importLocal(onlineProfileId: string, localProfileId: string): Promise<{ coins: number; records: number }> {
    const local = saveStore.profiles().find((p) => p.id === localProfileId);
    if (!local || !this.user) throw new SocialError('profile_not_found');
    const entries = localBestEntries((levelId, mode) => recordsRepo.personalBest(levelId, mode, localProfileId));
    const payload = importPayloadFrom(local.data as SaveData, entries);
    const st = await this.rpc<ProfileState & { imported: { coins: number; records: number } }>('import_local_progress', {
      p_profile: onlineProfileId,
      p_payload: payload,
    });
    saveStore.linkProfile(localProfileId, { profileId: onlineProfileId, accountId: this.user.id });
    const { imported, ...state } = st;
    this.applyProfileState(state);
    return imported;
  }

  // ------------------------------------------------------------- partidas

  /**
   * Registra el final de una partida del perfil activo. Si es un perfil
   * online, la encola y la manda (ahora o cuando se pueda). Devuelve el id de
   * la partida para seguir su estado, o null en modo local.
   */
  reportRun(src: RunReportSource): string | null {
    if (this.status === 'disabled') return null;
    const link = saveStore.activeProfile().online;
    if (!link) return null;
    const report = buildRunReport(src, CLIENT_VERSION);
    this.outbox.add(link.accountId, link.profileId, report);
    const mine = this.user?.id === link.accountId;
    this.setSubmission(report.clientRunId, { state: mine && this.status === 'signedIn' ? 'sending' : mine ? 'queued' : 'waitingLogin' });
    void this.flush();
    return report.clientRunId;
  }

  submission(clientRunId: string): Submission | null {
    return this.submissions.get(clientRunId) ?? null;
  }

  /** Partidas en cola que todavía no llegaron al servidor. */
  pendingCount(): number {
    return this.outbox.size;
  }

  private setSubmission(id: string, s: Submission): void {
    this.submissions.set(id, s);
    this.emit();
  }

  /** Manda en orden las partidas pendientes de la cuenta conectada. */
  async flush(): Promise<void> {
    if (this.flushing || !this.backend || !this.user || this.status !== 'signedIn') return;
    this.flushing = true;
    try {
      for (const entry of this.outbox.pendingFor(this.user.id)) {
        const id = entry.report.clientRunId;
        this.setSubmission(id, { state: 'sending' });
        try {
          const res = await this.backend.rpc<RunResult>('submit_run', { p_profile: entry.profileId, p_run: entry.report });
          this.outbox.remove(id);
          this.applyProfileState(res.state);
          this.setSubmission(id, { state: 'done', result: res });
        } catch (e) {
          const err = toSocialError(e);
          if (err.retryable || err.code === 'rate_limited') {
            this.outbox.markAttempt(id);
            this.setSubmission(id, { state: 'queued' });
            if (err.retryable) this.status = 'offline';
            this.scheduleRetry();
            break;
          }
          // Nunca la va a aceptar (datos inválidos, perfil borrado, cuenta suspendida...).
          this.outbox.remove(id);
          this.setSubmission(id, { state: 'error', error: err.code });
        }
      }
    } finally {
      this.flushing = false;
      this.emit();
    }
  }

  // ------------------------------------------------- rankings y perfiles

  leaderboard(levelId: string, mode: GameMode, kind: LeaderboardKind, scope: LeaderboardScope = 'global'): Promise<LeaderboardResult> {
    return this.rpc<LeaderboardResult>('get_leaderboard', {
      p_level: levelId,
      p_mode: mode,
      p_kind: kind,
      p_scope: scope,
      p_viewer: this.viewerProfileId(),
      p_limit: 10,
    });
  }

  publicProfile(profileId: string): Promise<PublicProfile> {
    return this.rpc<PublicProfile>('get_public_profile', { p_profile: profileId, p_viewer: this.viewerProfileId() });
  }

  history(profileId: string): Promise<HistoryEntry[]> {
    return this.rpc<HistoryEntry[]>('get_my_runs', { p_profile: profileId, p_limit: 30 });
  }

  personalRecords(profileId: string): Promise<PersonalRecord[]> {
    return this.rpc<PersonalRecord[]>('get_personal_records', { p_profile: profileId });
  }

  private me(): string {
    const id = this.viewerProfileId();
    if (!id) throw new SocialError('profile_not_found');
    return id;
  }

  block(otherId: string): Promise<boolean> {
    return this.rpc<boolean>('block_profile', { p_me: this.me(), p_other: otherId });
  }

  unblock(otherId: string, meId: string = this.me()): Promise<boolean> {
    return this.rpc<boolean>('unblock_profile', { p_me: meId, p_other: otherId });
  }

  blocked(meId: string): Promise<ProfileCard[]> {
    return this.rpc<ProfileCard[]>('get_blocked', { p_me: meId });
  }

  report(otherId: string, reason: 'nickname' | 'behavior' | 'other', details: string): Promise<boolean> {
    return this.rpc<boolean>('report_profile', { p_me: this.me(), p_other: otherId, p_reason: reason, p_details: details || null });
  }

  // Etapa 2 (el servidor ya los soporta; la interfaz llega después).
  friends(): Promise<{ friends: ProfileCard[]; incoming: ProfileCard[]; outgoing: ProfileCard[] }> {
    return this.rpc('get_friends', { p_me: this.me() });
  }

  sendFriendRequest(otherId: string): Promise<'pending' | 'friends'> {
    return this.rpc('send_friend_request', { p_me: this.me(), p_other: otherId });
  }

  respondFriendRequest(otherId: string, accept: boolean): Promise<'friends' | 'none'> {
    return this.rpc('respond_friend_request', { p_me: this.me(), p_other: otherId, p_accept: accept });
  }

  removeFriend(otherId: string): Promise<boolean> {
    return this.rpc('remove_friend', { p_me: this.me(), p_other: otherId });
  }
}

export const online = new OnlineSession();
