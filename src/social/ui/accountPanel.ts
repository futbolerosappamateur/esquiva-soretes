import { formatTime } from '../../core/LevelClock';
import { formatThousands } from '../../core/math';
import { BARRIOS, getBarrio } from '../../data/campaign';
import { CHARACTERS, getCharacter, isPlayable } from '../../data/characters';
import { saveStore } from '../../core/save';
import { AVATARS, DEFAULT_AVATAR_ID } from '../avatars';
import { toSocialError } from '../backend';
import { cleanNicknameInput, nicknameProblem } from '../nicknameRules';
import { online, type ProfileChanges } from '../onlineSession';
import type { HistoryEntry, PersonalRecord, ProfileState, PublicProfile, Visibility } from '../types';
import { avatarUrl } from './avatarImages';
import { busy, button, checkbox, field, h, maskEmail, messageLine, textInput } from './dom';
import { errorText, OT } from './onlineTexts';
import { closePanel, openPanel, renderPanel } from './overlay';

/**
 * Panel de la cuenta online: entrar o crear cuenta, condiciones, perfiles
 * (incluidos los supervisados para chicos), privacidad, importación del
 * progreso local e historial. Todo en HTML encima del juego.
 */
export interface AccountPanelOptions {
  /** Al cerrar. played = se eligió JUGAR con un perfil online (ya quedó activo en el juego). */
  onClose?: (result: { played: boolean }) => void;
  /** Abrir directamente la edición de este perfil online. */
  editProfileId?: string;
}

let options: AccountPanelOptions = {};
let played = false;
let unsubscribe: (() => void) | null = null;
let lastKey = '';

const statusKey = () => `${online.status}|${online.account?.adultConfirmed ? 1 : 0}|${online.passwordRecovery ? 1 : 0}|${online.user?.id ?? ''}`;

export function openAccountPanel(opts: AccountPanelOptions = {}): void {
  options = opts;
  played = false;
  openPanel({
    onClose: () => {
      unsubscribe?.();
      unsubscribe = null;
      const cb = options.onClose;
      options = {};
      cb?.({ played });
    },
  });
  unsubscribe?.();
  // Si cambia el estado de la sesión (entró, se cortó la conexión...), se muestra la pantalla que corresponde.
  unsubscribe = online.on(() => {
    if (statusKey() !== lastKey) showAuto();
  });
  const edit = opts.editProfileId ? online.profiles.find((p) => p.profile.id === opts.editProfileId) : undefined;
  if (edit && online.status === 'signedIn') {
    lastKey = statusKey();
    showProfileForm(edit);
  } else {
    showAuto();
  }
}

// ------------------------------------------------------------------ piezas

const title = (text: string) => h('h2', { class: 'es-title', text });
const text = (t: string, cls = '') => h('p', { class: `es-text ${cls}`.trim(), text: t });
const actions = (...buttons: (HTMLElement | null | false)[]) => h('div', { class: 'es-actions' }, ...buttons);
const submitButton = (label: string) => h('button', { class: 'es-btn es-btn-primary', text: label, attrs: { type: 'submit' } });
const closeButton = () => button(OT.close, () => closePanel());
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function avatarImg(id: string, cls = 'es-avatar es-avatar-small'): HTMLImageElement {
  return h('img', { class: cls, attrs: { src: avatarUrl(id), alt: '', draggable: 'false' } });
}

function levelLabel(levelId: string): string {
  for (const b of BARRIOS) {
    const l = b.levels.find((x) => x.id === levelId);
    if (l) return `${b.name} ${l.number}`;
  }
  return levelId.toUpperCase();
}

function badgeLabel(id: string): string {
  if (id.startsWith('char:')) return `DESBLOQUEÓ A ${getCharacter(id.slice(5)).name}`;
  if (id.startsWith('barrio:')) return `COMPLETÓ ${getBarrio(id.slice(7))?.name ?? id.slice(7).toUpperCase()}`;
  return id.toUpperCase();
}

const starsOf = (st: ProfileState) => Object.values(st.levels).reduce((acc, l) => acc + l.stars, 0);
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

// --------------------------------------------------------------- pantallas

function showAuto(): void {
  lastKey = statusKey();
  const s = online.status;
  if (s === 'disabled') return showNotConfigured();
  if (s === 'starting') return showLoading();
  if (online.passwordRecovery && online.user) return showNewPassword();
  if (s === 'offline') return showOffline();
  if (s === 'signedOut') return showSignIn('in');
  if (!online.account?.adultConfirmed) return showTerms();
  return showProfiles();
}

function showNotConfigured(): void {
  renderPanel([title(OT.notConfiguredTitle), text(OT.notConfigured), actions(closeButton())]);
}

function showLoading(): void {
  renderPanel([title(OT.notConfiguredTitle), text(OT.loading, 'es-muted'), actions(closeButton())]);
}

function showOffline(): void {
  const pending = online.pendingCount();
  renderPanel([
    title(OT.offlineTitle),
    text(online.lastError === 'server_not_ready' ? OT.serverNotReady : OT.offline),
    pending > 0 ? text(OT.pending(pending), 'es-muted') : null,
    actions(button(OT.retry, () => void online.refresh(), 'primary'), closeButton()),
  ]);
}

function showSignIn(tab: 'in' | 'up', presetEmail = ''): void {
  const email = textInput('email', { autocomplete: 'email', maxLength: 254, value: presetEmail });
  const pass = textInput('password', { autocomplete: tab === 'in' ? 'current-password' : 'new-password', maxLength: 72 });
  const pass2 = tab === 'up' ? textInput('password', { autocomplete: 'new-password', maxLength: 72 }) : null;
  const msg = messageLine();
  const tabs = h(
    'div',
    { class: 'es-tabs', attrs: { role: 'tablist' } },
    tabButton(OT.signInTab, tab === 'in', () => showSignIn('in', email.value)),
    tabButton(OT.signUpTab, tab === 'up', () => showSignIn('up', email.value)),
  );
  const form = h(
    'form',
    { attrs: { novalidate: true } },
    field(OT.email, email),
    field(OT.password, pass, tab === 'up' ? OT.passwordShort : undefined),
    pass2 ? field(OT.password2, pass2) : null,
    msg.el,
    actions(submitButton(tab === 'in' ? OT.signIn : OT.signUp)),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const em = email.value.trim();
    if (!EMAIL_RE.test(em)) return msg.error(OT.emailInvalid);
    if (tab === 'up' && pass.value.length < 8) return msg.error(OT.passwordShort);
    if (tab === 'in' && !pass.value) return msg.error(OT.passwordShort);
    if (pass2 && pass.value !== pass2.value) return msg.error(OT.passwordMismatch);
    msg.clear();
    void busy(form, async () => {
      try {
        if (tab === 'in') {
          await online.signIn(em, pass.value);
          showAuto();
        } else {
          const res = await online.signUp(em, pass.value);
          if (res.needsConfirmation) showCheckEmail(em);
          else showAuto();
        }
      } catch (err) {
        msg.error(errorText(toSocialError(err).code));
      }
    });
  });
  renderPanel(
    [
      title(OT.notConfiguredTitle),
      tabs,
      form,
      text(OT.privacyNote, 'es-muted'),
      tab === 'up' ? text(OT.adultNote, 'es-muted') : null,
      actions(
        tab === 'in' ? button(OT.forgot, () => showForgot(email.value), 'link') : null,
        button(OT.guest, () => closePanel(), 'link'),
      ),
      text(OT.guestNote, 'es-hint'),
    ],
  );
}

function tabButton(label: string, selected: boolean, onClick: () => void): HTMLButtonElement {
  const b = button(label, onClick);
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', String(selected));
  return b;
}

function showCheckEmail(email: string): void {
  renderPanel([
    title(OT.checkEmailTitle),
    text(OT.checkEmail),
    text(maskEmail(email), 'es-muted'),
    actions(button(OT.signIn, () => showSignIn('in', email), 'primary'), closeButton()),
  ]);
}

function showForgot(presetEmail: string): void {
  const email = textInput('email', { autocomplete: 'email', maxLength: 254, value: presetEmail });
  const msg = messageLine();
  const form = h('form', { attrs: { novalidate: true } }, text(OT.forgotText), field(OT.email, email), msg.el, actions(submitButton(OT.forgotSend)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const em = email.value.trim();
    if (!EMAIL_RE.test(em)) return msg.error(OT.emailInvalid);
    void busy(form, async () => {
      try {
        await online.requestPasswordReset(em);
        msg.ok(OT.forgotSent);
      } catch (err) {
        msg.error(errorText(toSocialError(err).code));
      }
    });
  });
  renderPanel([title(OT.forgotTitle), form, actions(button(OT.back, () => showSignIn('in', email.value)))], () => showSignIn('in', email.value));
}

function showNewPassword(): void {
  const pass = textInput('password', { autocomplete: 'new-password', maxLength: 72 });
  const pass2 = textInput('password', { autocomplete: 'new-password', maxLength: 72 });
  const msg = messageLine();
  const form = h('form', { attrs: { novalidate: true } }, field(OT.password, pass, OT.passwordShort), field(OT.password2, pass2), msg.el, actions(submitButton(OT.save)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pass.value.length < 8) return msg.error(OT.passwordShort);
    if (pass.value !== pass2.value) return msg.error(OT.passwordMismatch);
    void busy(form, async () => {
      try {
        await online.updatePassword(pass.value);
        msg.ok(OT.newPasswordSaved);
        setTimeout(() => showAuto(), 1200);
      } catch (err) {
        msg.error(errorText(toSocialError(err).code));
      }
    });
  });
  renderPanel([title(OT.newPasswordTitle), form]);
}

function showTerms(): void {
  const msg = messageLine();
  const go = button(OT.termsContinue, () => {
    void busy(box, async () => {
      try {
        await online.acceptTerms();
        showAuto();
      } catch (err) {
        msg.error(errorText(toSocialError(err).code));
      }
    });
  }, 'primary');
  go.disabled = true;
  const check = checkbox(OT.termsCheck, false, (v) => (go.disabled = !v));
  const box = h(
    'div',
    {},
    title(OT.termsTitle),
    h('ul', { class: 'es-list' }, ...OT.terms.map((t) => h('li', { text: t }))),
    check.row,
    msg.el,
    actions(go, button(OT.signOut, () => void online.signOut(), 'link')),
  );
  renderPanel([box]);
}

function showProfiles(): void {
  const msg = messageLine();
  const activeLink = saveStore.activeProfile().online;
  const rows = online.profiles.map((st) => profileRow(st, st.profile.id === activeLink?.profileId, msg));
  const pending = online.pendingCount();
  const canCreate = online.profiles.length < online.maxProfiles;
  renderPanel([
    title(OT.accountTitle),
    text(maskEmail(online.user?.email ?? null), 'es-muted'),
    pending > 0 ? text(OT.pending(pending), 'es-muted') : text(''),
    h('h3', { class: 'es-subtitle', text: OT.profilesTitle }),
    ...(rows.length ? rows : [text(OT.noProfiles)]),
    msg.el,
    actions(
      canCreate ? button(OT.newProfile, () => showProfileForm(null), 'primary') : null,
      button(OT.signOut, () => void online.signOut()),
      closeButton(),
    ),
  ]);
}

function profileRow(st: ProfileState, current: boolean, msg: ReturnType<typeof messageLine>): HTMLElement {
  const p = st.profile;
  const tags: HTMLElement[] = [];
  if (current) tags.push(h('span', { class: 'es-tag es-tag-green', text: OT.playing }));
  if (p.supervised) tags.push(h('span', { class: 'es-tag es-tag-blue', text: OT.supervisedTag }));
  if (p.visibility !== 'public') tags.push(h('span', { class: 'es-tag', text: p.visibility === 'private' ? OT.privateTag : OT.friendsTag }));
  if (!p.showInRankings) tags.push(h('span', { class: 'es-tag es-tag-orange', text: OT.hiddenTag }));
  const play = button(current ? OT.playing : OT.play, () => {
    const res = online.playAs(p.id);
    if (res === 'no_space') return msg.error(OT.noSpace);
    if (res !== 'ok') return msg.error(errorText('profile_not_found'));
    played = true;
    closePanel();
  }, 'primary', 'es-btn-small');
  return h(
    'div',
    { class: `es-profile${current ? ' es-current' : ''}` },
    avatarImg(p.avatarId),
    h(
      'div',
      { class: 'es-profile-info' },
      h('div', { class: 'es-profile-name', text: p.nickname }),
      h('div', { class: 'es-hint', text: `${starsOf(st)} ${OT.stars} · ${formatThousands(st.stats.coins)} ${OT.coins}` }),
      h('div', { class: 'es-tags' }, ...tags),
    ),
    h(
      'div',
      { class: 'es-profile-actions' },
      play,
      button(OT.edit, () => showProfileForm(st), 'normal', 'es-btn-small'),
      button(OT.history, () => showHistory(st, 'runs'), 'normal', 'es-btn-small'),
    ),
  );
}

function showProfileForm(existing: ProfileState | null): void {
  const p = existing?.profile ?? null;
  const msg = messageLine();
  // Apodo: en mayúsculas y sólo con los caracteres que acepta el servidor. Al crear el
  // primer perfil online se propone el apodo del perfil local que se está usando.
  const local = saveStore.activeProfile();
  const suggestion = !p && online.profiles.length === 0 && !local.online && !nicknameProblem(local.nickname) ? local.nickname : '';
  const nick = textInput('text', { maxLength: 10, value: p?.nickname ?? suggestion, autocomplete: 'off' });
  nick.dataset.upper = '1';
  const hint = h('p', { class: 'es-hint', text: OT.nicknameHint });
  nick.addEventListener('input', () => {
    const clean = cleanNicknameInput(nick.value);
    if (clean !== nick.value) nick.value = clean;
    const problem = nick.value.length >= 3 ? nicknameProblem(nick.value.trim()) : null;
    hint.textContent = problem ? errorText(problem) : OT.nicknameHint;
    hint.className = problem ? 'es-hint es-error' : 'es-hint';
  });

  let avatar = p?.avatarId ?? DEFAULT_AVATAR_ID;
  const avatarButtons = AVATARS.map((a) => {
    const b = h('button', { class: 'es-avatar-btn', attrs: { type: 'button', 'aria-pressed': String(a.id === avatar), 'aria-label': a.label, title: a.label } }, avatarImg(a.id, 'es-avatar'));
    b.addEventListener('click', () => {
      avatar = a.id;
      avatarButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    return b;
  });

  const fav = h('select', { class: 'es-select' }, h('option', { text: OT.noFavorite, attrs: { value: '' } }), ...CHARACTERS.filter(isPlayable).map((c) => h('option', { text: c.name, attrs: { value: c.id } })));
  fav.value = p?.favoriteCharacter ?? '';

  const body: (HTMLElement | null)[] = [
    h('div', { class: 'es-field' }, h('label', { text: OT.nickname }), nick, hint),
    h('div', { class: 'es-field' }, h('label', { text: OT.avatar }), h('div', { class: 'es-avatar-grid' }, ...avatarButtons)),
    field(OT.favorite, fav),
  ];

  // Creación: perfil supervisado (chicos) con autorización del adulto.
  const supervised = checkbox(OT.supervised, false);
  const consent = checkbox(OT.guardianConsent, false);
  // Edición: privacidad.
  let visibility: Visibility = p?.visibility ?? 'public';
  const ranks = checkbox(OT.showInRankings, p?.showInRankings ?? true);
  const social = checkbox(OT.socialEnabled, p?.socialEnabled ?? true);
  const change = checkbox(OT.guardianChange, false);
  const visHelp = h('p', { class: 'es-hint', text: OT.visibilityHelp[visibility] });

  if (!p) {
    const supHelp = h('p', { class: 'es-hint', text: OT.supervisedHelp });
    consent.row.hidden = true;
    supervised.input.addEventListener('change', () => (consent.row.hidden = !supervised.input.checked));
    body.push(h('h3', { class: 'es-subtitle', text: OT.privacy }), supervised.row, supHelp, consent.row);
  } else {
    const radios = (['public', 'friends', 'private'] as Visibility[]).map((v) => {
      const b = button(OT.visibility[v], () => {
        visibility = v;
        radios.forEach((x, i) => x.setAttribute('aria-pressed', String(['public', 'friends', 'private'][i] === v)));
        visHelp.textContent = OT.visibilityHelp[v];
        refreshConsent();
      }, 'normal', 'es-btn-small');
      b.setAttribute('aria-pressed', String(v === visibility));
      return b;
    });
    const refreshConsent = () => {
      const opening = p.supervised && ((p.visibility === 'private' && visibility !== 'private') || (!p.showInRankings && ranks.input.checked) || (!p.socialEnabled && social.input.checked));
      change.row.hidden = !opening;
    };
    ranks.input.addEventListener('change', refreshConsent);
    social.input.addEventListener('change', refreshConsent);
    refreshConsent();
    body.push(h('h3', { class: 'es-subtitle', text: OT.privacy }), h('div', { class: 'es-radios' }, ...radios), visHelp, ranks.row, social.row, change.row);
  }

  const save = submitButton(p ? OT.save : OT.create);
  const form = h('form', { attrs: { novalidate: true } }, ...body, msg.el, actions(save, button(OT.back, () => showProfiles())));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nickname = nick.value.trim();
    const problem = nicknameProblem(nickname);
    if (problem) return msg.error(errorText(problem));
    void busy(form, async () => {
      try {
        if (!p) {
          if (supervised.input.checked && !consent.input.checked) return msg.error(errorText('consent_required'));
          const created = await online.createProfile({
            nickname,
            avatarId: avatar,
            favoriteCharacter: fav.value || null,
            supervised: supervised.input.checked,
            guardianConsent: consent.input.checked,
          });
          if (online.importableLocalProfiles().some(hasProgress)) showImport(created);
          else showProfiles();
          return;
        }
        const changes: ProfileChanges = {};
        if (nickname !== p.nickname) changes.nickname = nickname;
        if (avatar !== p.avatarId) changes.avatarId = avatar;
        if ((fav.value || null) !== p.favoriteCharacter) changes.favoriteCharacter = fav.value || null;
        if (visibility !== p.visibility) changes.visibility = visibility;
        if (ranks.input.checked !== p.showInRankings) changes.showInRankings = ranks.input.checked;
        if (social.input.checked !== p.socialEnabled) changes.socialEnabled = social.input.checked;
        if (!change.row.hidden) {
          if (!change.input.checked) return msg.error(errorText('consent_required'));
          changes.guardianConsent = true;
        }
        if (Object.keys(changes).length === 0) return showProfiles();
        const updated = await online.updateProfile(p.id, changes);
        // La pantalla nueva arranca con el mensaje de guardado.
        lastSaved = true;
        showProfileForm(updated);
      } catch (err) {
        msg.error(errorText(toSocialError(err).code));
      }
    });
  });

  const extra: HTMLElement[] = [];
  if (p) {
    const blockedBox = h('div', {}, text(OT.loading, 'es-hint'));
    void loadBlocked(p.id, blockedBox);
    extra.push(h('h3', { class: 'es-subtitle', text: OT.blockedTitle }), blockedBox);
    extra.push(actions(button(OT.deleteProfile, () => confirmDelete(p.id, p.nickname), 'danger', 'es-btn-small')));
  }
  renderPanel([title(p ? OT.editTitle : OT.createTitle), form, ...extra], () => showProfiles());
  if (lastSaved) {
    msg.ok(OT.saved);
    lastSaved = false;
  }
}
let lastSaved = false;

const hasProgress = (p: { data: { wallet: { coins: number }; barrios: Record<string, { levels: Record<string, { completed: boolean }> }> } }) =>
  p.data.wallet.coins > 0 || Object.values(p.data.barrios).some((b) => Object.values(b.levels).some((l) => l.completed));

async function loadBlocked(profileId: string, box: HTMLElement): Promise<void> {
  try {
    const list = await online.blocked(profileId);
    box.replaceChildren(
      ...(list.length
        ? list.map((c) =>
            h(
              'div',
              { class: 'es-profile' },
              avatarImg(c.avatarId),
              h('div', { class: 'es-profile-info' }, h('div', { class: 'es-profile-name', text: c.nickname })),
              button(OT.unblock, () => {
                void online.unblock(c.profileId, profileId).then(() => loadBlocked(profileId, box));
              }, 'normal', 'es-btn-small'),
            ),
          )
        : [text(OT.noBlocked, 'es-hint')]),
    );
  } catch (err) {
    box.replaceChildren(text(errorText(toSocialError(err).code), 'es-hint es-error'));
  }
}

function confirmDelete(profileId: string, nickname: string): void {
  const msg = messageLine();
  const box = h(
    'div',
    {},
    title(OT.deleteProfile),
    text(OT.deleteConfirm(nickname)),
    msg.el,
    actions(
      button(OT.deleteYes, () => {
        void busy(box, async () => {
          try {
            await online.deleteProfile(profileId);
            showProfiles();
          } catch (err) {
            msg.error(errorText(toSocialError(err).code));
          }
        });
      }, 'danger'),
      button(OT.cancel, () => showProfiles()),
    ),
  );
  renderPanel([box], () => showProfiles());
}

function showImport(st: ProfileState): void {
  const msg = messageLine();
  const locals = online.importableLocalProfiles().filter(hasProgress);
  const list = h(
    'div',
    {},
    ...locals.map((lp) => {
      const stars = Object.values(lp.data.barrios).reduce((acc, b) => acc + Object.values(b.levels).reduce((a, l) => a + l.stars, 0), 0);
      return h(
        'div',
        { class: 'es-profile' },
        h(
          'div',
          { class: 'es-profile-info' },
          h('div', { class: 'es-profile-name', text: lp.nickname }),
          h('div', { class: 'es-hint', text: `${stars} ${OT.stars} · ${formatThousands(lp.data.wallet.coins)} ${OT.coins}` }),
        ),
        button(`${OT.importFrom} ${lp.nickname}`, () => {
          void busy(box, async () => {
            try {
              const res = await online.importLocal(st.profile.id, lp.id);
              list.replaceChildren(text(OT.importDone(res.coins, res.records), 'es-ok'));
              skip.textContent = OT.back;
            } catch (err) {
              msg.error(errorText(toSocialError(err).code));
            }
          });
        }, 'primary', 'es-btn-small'),
      );
    }),
  );
  const skip = button(OT.importSkip, () => showProfiles());
  const box = h('div', {}, title(OT.importTitle), text(OT.importText), list, msg.el, actions(skip));
  renderPanel([box], () => showProfiles());
}

function showHistory(st: ProfileState, tab: 'runs' | 'records'): void {
  const content = h('div', {}, text(OT.loading, 'es-hint'));
  const tabs = h(
    'div',
    { class: 'es-tabs', attrs: { role: 'tablist' } },
    tabButton(OT.runsTab, tab === 'runs', () => showHistory(st, 'runs')),
    tabButton(OT.recordsTab, tab === 'records', () => showHistory(st, 'records')),
  );
  renderPanel([title(`${OT.historyTitle} · ${st.profile.nickname}`), tabs, content, actions(button(OT.back, () => showProfiles()))], () => showProfiles());
  const fail = (err: unknown) => content.replaceChildren(text(errorText(toSocialError(err).code), 'es-error'));
  if (tab === 'runs') online.history(st.profile.id).then((runs) => content.replaceChildren(runsTable(runs)), fail);
  else online.personalRecords(st.profile.id).then((recs) => content.replaceChildren(recordsTable(recs)), fail);
}

function runStatus(r: HistoryEntry): [string, string] {
  if (r.source === 'import') return [OT.status.unverified, 'es-tag'];
  if (r.status === 'rejected') return [OT.status.rejected, 'es-tag es-tag-red'];
  if (r.status === 'suspicious') return [OT.status.suspicious, 'es-tag es-tag-orange'];
  if (!r.completed) return [OT.status.lost, 'es-tag'];
  if (r.assisted) return [OT.status.assisted, 'es-tag'];
  if (r.official) return [OT.status.official, 'es-tag es-tag-green'];
  return [OT.status.valid, 'es-tag es-tag-blue'];
}

function runsTable(runs: HistoryEntry[]): HTMLElement {
  if (!runs.length) return text(OT.noRuns);
  return h(
    'table',
    { class: 'es-table' },
    h('thead', {}, h('tr', {}, ...[OT.colDate, OT.colLevel, OT.colCharacter, OT.colTime, OT.colScore, OT.colStatus].map((c) => h('th', { text: c })))),
    h(
      'tbody',
      {},
      ...runs.map((r) => {
        const [label, cls] = runStatus(r);
        return h(
          'tr',
          {},
          h('td', { text: dateOf(r.playedAt) }),
          h('td', { text: levelLabel(r.levelId) + (r.mode === 'timeTrial' ? ` · ${OT.timeTrial}` : '') }),
          h('td', { text: getCharacter(r.characterId).name }),
          h('td', { class: 'es-num', text: formatTime(r.timeMs) }),
          h('td', { class: 'es-num', text: formatThousands(r.score) }),
          h('td', {}, h('span', { class: cls, text: label })),
        );
      }),
    ),
  );
}

function recordsTable(recs: PersonalRecord[]): HTMLElement {
  if (!recs.length) return text(OT.noRecords);
  const unverifiedTag = () => h('span', { class: 'es-tag', text: OT.unverified });
  return h(
    'table',
    { class: 'es-table' },
    h('thead', {}, h('tr', {}, ...[OT.colLevel, OT.bestTime, OT.bestScore].map((c) => h('th', { text: c })))),
    h(
      'tbody',
      {},
      ...recs.map((r) =>
        h(
          'tr',
          {},
          h('td', { text: levelLabel(r.levelId) + (r.mode === 'timeTrial' ? ` · ${OT.timeTrial}` : '') }),
          h(
            'td',
            { class: 'es-num' },
            r.bestTime ? formatTime(r.bestTime.timeMs) : '--:--.-',
            r.unverifiedTime ? h('div', {}, `${formatTime(r.unverifiedTime.timeMs)} `, unverifiedTag()) : null,
          ),
          h(
            'td',
            { class: 'es-num' },
            r.bestScore ? formatThousands(r.bestScore.score) : '-',
            r.unverifiedScore ? h('div', {}, `${formatThousands(r.unverifiedScore.score)} `, unverifiedTag()) : null,
          ),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------ perfil público

/** Ficha de un jugador (desde los rankings online), con reportar y bloquear. */
export function openPublicProfile(profileId: string, onClose?: () => void): void {
  openPanel({ onClose });
  renderPanel([title(OT.publicTitle), text(OT.loading, 'es-hint'), actions(closeButton())]);
  online.publicProfile(profileId).then(
    (p) => renderPublic(p),
    (err) => renderPanel([title(OT.publicTitle), text(errorText(toSocialError(err).code), 'es-error'), actions(closeButton())]),
  );
}

function renderPublic(p: PublicProfile): void {
  const msg = messageLine();
  const viewer = online.viewerProfileId();
  const mine = online.profiles.some((x) => x.profile.id === p.profileId);
  const info: HTMLElement[] = [h('div', { class: 'es-profile-name', text: p.nickname })];
  if (p.limited) info.push(text(OT.limited, 'es-muted'));
  else {
    if (p.favoriteCharacter) info.push(text(`${OT.favorite}: ${getCharacter(p.favoriteCharacter).name}`));
    if (p.memberSince) info.push(text(`${OT.memberSince}: ${dateOf(p.memberSince)}`, 'es-muted'));
    if (p.stats) {
      info.push(
        h(
          'dl',
          { class: 'es-stats' },
          h('dt', { text: OT.levelsCompleted }),
          h('dd', { text: String(p.stats.levelsCompleted) }),
          h('dt', { text: OT.poopsDodged }),
          h('dd', { text: formatThousands(p.stats.poopsDodged) }),
          h('dt', { text: OT.bestStreak }),
          h('dd', { text: String(p.stats.bestStreak) }),
        ),
      );
    }
  }
  const badges = p.badges && !p.limited ? h('div', {}, h('h3', { class: 'es-subtitle', text: OT.badges }), p.badges.length ? h('ul', { class: 'es-list' }, ...p.badges.map((b) => h('li', { text: badgeLabel(b) }))) : text(OT.noBadges, 'es-hint')) : null;

  const buttons: HTMLElement[] = [];
  if (mine) buttons.push(h('span', { class: 'es-tag es-tag-green', text: OT.itsYou }));
  else if (viewer) {
    buttons.push(button(OT.report, () => showReport(p), 'normal'));
    if (p.blockedByMe) {
      buttons.push(button(OT.unblock, () => {
        void online.unblock(p.profileId).then(() => {
          msg.ok(OT.unblockedDone);
          p.blockedByMe = false;
          renderPublic(p);
        }, (err) => msg.error(errorText(toSocialError(err).code)));
      }));
    } else {
      buttons.push(button(OT.block, () => confirmBlock(p), 'danger'));
    }
  }
  buttons.push(closeButton());
  renderPanel([
    title(OT.publicTitle),
    h('div', { class: 'es-public' }, avatarImg(p.avatarId, 'es-avatar es-avatar-big'), h('div', { class: 'es-profile-info' }, ...info)),
    ...(badges ? [badges] : []),
    ...(!viewer && !mine ? [text(OT.loginToModerate, 'es-hint')] : []),
    msg.el,
    actions(...buttons),
  ]);
}

function showReport(p: PublicProfile): void {
  const msg = messageLine();
  const reason = h('select', { class: 'es-select' }, ...(['nickname', 'behavior', 'other'] as const).map((r) => h('option', { text: OT.reasons[r], attrs: { value: r } })));
  const details = h('textarea', { class: 'es-textarea', attrs: { rows: '3', maxlength: '200' } });
  const send = submitButton(OT.reportSend);
  const form = h('form', { attrs: { novalidate: true } }, text(p.nickname), field(OT.reportReason, reason), field(OT.reportDetails, details), msg.el, actions(send, button(OT.back, () => renderPublic(p))));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void busy(form, async () => {
      try {
        await online.report(p.profileId, reason.value as 'nickname' | 'behavior' | 'other', details.value.trim());
        msg.ok(OT.reportDone);
        send.hidden = true;
      } catch (err) {
        msg.error(errorText(toSocialError(err).code));
      }
    });
  });
  renderPanel([title(OT.reportTitle), form], () => renderPublic(p));
}

function confirmBlock(p: PublicProfile): void {
  const msg = messageLine();
  const box = h(
    'div',
    {},
    title(OT.block),
    text(OT.blockConfirm(p.nickname)),
    msg.el,
    actions(
      button(OT.block, () => {
        void busy(box, async () => {
          try {
            await online.block(p.profileId);
            p.blockedByMe = true;
            renderPublic(p);
          } catch (err) {
            msg.error(errorText(toSocialError(err).code));
          }
        });
      }, 'danger'),
      button(OT.cancel, () => renderPublic(p)),
    ),
  );
  renderPanel([box], () => renderPublic(p));
}
