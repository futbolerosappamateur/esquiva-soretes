import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BANNED_WORDS, nicknameProblem } from '../../src/social/nicknameRules';
import { computeLevelRules } from '../../src/social/rules/gameRules';
import { errorOf, SupabaseTestDb } from './pgliteSupabase';

/**
 * Pruebas de la base de datos online contra un PostgreSQL real (PGlite) con
 * las mismas migraciones que se aplican en Supabase: seguridad (RLS y
 * permisos), cuentas y perfiles, validación de partidas, rankings,
 * privacidad, importación del progreso local y funciones sociales.
 */

const RULES = computeLevelRules();
const L1 = RULES.find((l) => l.id === 'san-telmo-1')!;
const L2 = RULES.find((l) => l.id === 'san-telmo-2')!;

let db: SupabaseTestDb;
let nickCounter = 0;
const freshNick = () => `NICK${(++nickCounter).toString(36).toUpperCase()}`;

type State = {
  profile: { id: string; nickname: string; visibility: string; showInRankings: boolean; socialEnabled: boolean; supervised: boolean };
  stats: { coins: number; coinsEarned: number; runsPlayed: number; runsCompleted: number; levelsCompleted: number; crossings: number; poopsDodged: number };
  levels: Record<string, { completed: boolean; stars: number; bestScore: number; plays: number; source: string }>;
  achievements: Record<string, number>;
  characters: { id: string; source: string }[];
  badges: { id: string }[];
  missionRewards: string[];
};
type RunResult = {
  status: 'valid' | 'suspicious' | 'rejected' | 'unverified';
  reasons: string[];
  official: boolean;
  duplicate: boolean;
  rewards: { coins: number; starCoins: number; newStars: number; unlockedCharacters: string[]; badges: string[] };
  ranks: { speed: number | null; score: number | null };
  state: State;
};

async function newPlayer(nickname = freshNick()): Promise<{ uid: string; profileId: string; state: State }> {
  const uid = await db.createUser();
  await db.rpc(uid, 'accept_terms', { p_adult: true, p_terms_version: '1' });
  const state = await db.rpc<State>(uid, 'create_profile', { p_nickname: nickname, p_avatar: 'pibe', p_favorite: 'player_girl' });
  return { uid, profileId: state.profile.id, state };
}

let runCounter = 0;
/** Desglose coherente: el bonus incluye el de velocidad. */
const bd = (speed: number, otherBonus = 1500) => ({ distance: 4700, dodge: 12000, bonus: otherBonus + speed, penalty: 200, crossing: 1600, speed });

/** Una partida limpia y completa del nivel 1 (2 estrellas, bonus de velocidad "bueno"). */
function cleanRun(over: Record<string, unknown> = {}) {
  const run = baseRun(over);
  // Si no se fuerza el puntaje, se calcula del desglose (para que siempre sume bien).
  if (!('score' in over)) {
    const b = run.breakdown as ReturnType<typeof bd>;
    run.score = b.distance + b.dodge + b.bonus - b.penalty;
  }
  return run;
}

function baseRun(over: Record<string, unknown>): Record<string, unknown> {
  const timeMs = 200000;
  return {
    clientRunId: `r-test-${++runCounter}-${Math.random().toString(36).slice(2, 8)}`,
    levelId: L1.id,
    mode: 'normal',
    characterId: 'player_default',
    completed: true,
    timeMs,
    startTimeMs: 0,
    score: 4700 + 12000 + 2500 - 200,
    assisted: false,
    assistReasons: [],
    continues: 0,
    startBlock: 0,
    blocksCompleted: L1.blocks,
    shoesLeft: 3,
    breakdown: bd(1000),
    counts: { dodged: 100, bestStreak: 30, closeCalls: 5, crossings: 4, carHits: 0, missions: 1 },
    attempt: {
      dodged: 100,
      crossings: 4,
      carHits: 0,
      missions: 1,
      coinsBanked: 30 + 6 + 15,
      achievements: { trashDeposited: 3, safeCrossings: 4, poopsDodged: 100, levelsCompleted: 1, flawlessLevels: 1, waterJetsDodged: 1 },
    },
    splits: [40000, 80000, 120000, 160000],
    playedAt: new Date().toISOString(),
    clientVersion: 'test',
    ...over,
  };
}

const submit = (uid: string, profileId: string, run: object) => db.rpc<RunResult>(uid, 'submit_run', { p_profile: profileId, p_run: run });

beforeAll(async () => {
  db = await SupabaseTestDb.create();
}, 60000);

afterAll(async () => {
  await db?.close();
});

describe('reglas cargadas desde el código', () => {
  it('niveles, personajes, logros y avatares', async () => {
    const [counts] = await db.sql<Record<string, number>>(`
      select (select count(*)::int from public.game_levels where active) as levels,
             (select count(*)::int from public.game_characters where playable) as playable,
             (select count(*)::int from public.game_characters where starter) as starters,
             (select count(*)::int from public.game_achievements) as achievements,
             (select count(*)::int from public.game_avatars) as avatars`);
    expect(counts).toEqual({ levels: 9, playable: 8, starters: 4, achievements: 8, avatars: 12 });
    const [l1] = await db.sql<{ min_time_ms: number; max_score: number }>(`select min_time_ms, max_score from public.game_levels where id = 'san-telmo-1'`);
    expect(l1.min_time_ms).toBe(L1.minTimeMs);
    expect(l1.max_score).toBe(L1.maxScore);
  });
});

describe('seguridad: RLS y permisos mínimos', () => {
  it('ningún cliente escribe tablas directamente', async () => {
    const { uid, profileId } = await newPlayer();
    const attempts = [
      `insert into public.runs (profile_id, account_id, client_run_id, nickname, level_id, barrio_id, mode, character_id, completed, score, assisted, status, played_at)
       values ('${profileId}', '${uid}', 'hack-000001', 'X', 'san-telmo-1', 'san-telmo', 'normal', 'player_default', true, 1, false, 'valid', now())`,
      `update public.profile_stats set coins = 999999 where profile_id = '${profileId}'`,
      `update public.profiles set show_in_rankings = true where id = '${profileId}'`,
      `insert into public.profile_characters (profile_id, character_id, source) values ('${profileId}', 'player_police', 'challenge')`,
      `insert into public.profile_achievements (profile_id, achievement_id, count) values ('${profileId}', 'safeCrossings', 100)`,
      `delete from public.runs`,
      `insert into public.game_levels (id) values ('x')`,
    ];
    for (const sql of attempts) {
      expect(await errorOf(db.as('authenticated', uid, sql))).toMatch(/permission denied/);
    }
  });

  it('cada cuenta sólo lee sus filas; los invitados no leen perfiles', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await submit(b.uid, b.profileId, cleanRun());
    const profiles = await db.as<{ id: string }>('authenticated', a.uid, 'select id from public.profiles');
    expect(profiles.map((p) => p.id)).toEqual([a.profileId]);
    expect(await db.as('authenticated', a.uid, 'select id from public.runs')).toEqual([]);
    expect(await db.as('authenticated', a.uid, 'select * from public.accounts')).toHaveLength(1);
    expect(await errorOf(db.as('anon', null, 'select id from public.profiles'))).toMatch(/permission denied/);
    expect(await errorOf(db.as('authenticated', a.uid, 'select * from public.reports'))).toMatch(/permission denied/);
    expect(await errorOf(db.as('authenticated', a.uid, 'select * from public.game_banned_words'))).toMatch(/permission denied/);
    // Las reglas del juego son públicas.
    expect(await db.as('anon', null, 'select id from public.game_levels')).toHaveLength(9);
  });

  it('funciones: invitados sólo rankings y perfiles públicos; nadie llama a las internas ni a moderación', async () => {
    const { uid, profileId } = await newPlayer();
    expect(await errorOf(db.rpc(null, 'get_leaderboard', { p_level: L1.id, p_mode: 'normal', p_kind: 'speed' }))).toBe('');
    expect(await errorOf(db.rpc(null, 'submit_run', { p_profile: profileId, p_run: cleanRun() }))).toMatch(/permission denied/);
    expect(await errorOf(db.rpc(null, 'get_my_state'))).toMatch(/permission denied/);
    expect(await errorOf(db.rpc(uid, 'moderate_nickname', { p_profile: profileId }))).toMatch(/permission denied/);
    expect(await errorOf(db.rpc(uid, 'set_run_status', { p_run: profileId, p_status: 'valid' }))).toMatch(/permission denied/);
    expect(await errorOf(db.as('authenticated', uid, `select private.refresh_unlocks('${profileId}', 'challenge')`))).toMatch(/permission denied/);
    expect(await errorOf(db.as('authenticated', uid, `select private.profile_state('${profileId}')`))).toMatch(/permission denied/);
  });

  it('un jugador no puede usar el perfil de otro', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    expect(await errorOf(submit(a.uid, b.profileId, cleanRun()))).toBe('profile_not_found');
    expect(await errorOf(db.rpc(a.uid, 'update_profile', { p_profile: b.profileId, p_changes: { avatarId: 'vieja' } }))).toBe('profile_not_found');
    expect(await errorOf(db.rpc(a.uid, 'get_my_runs', { p_profile: b.profileId }))).toBe('profile_not_found');
    expect(await errorOf(db.rpc(a.uid, 'delete_profile', { p_profile: b.profileId }))).toBe('profile_not_found');
  });
});

describe('cuentas y perfiles', () => {
  it('primero se confirma que la cuenta es de un adulto', async () => {
    const uid = await db.createUser();
    const empty = await db.rpc<{ account: unknown; profiles: unknown[] }>(uid, 'get_my_state');
    expect(empty.account).toBeNull();
    expect(empty.profiles).toEqual([]);
    expect(await errorOf(db.rpc(uid, 'create_profile', { p_nickname: freshNick(), p_avatar: 'pibe' }))).toBe('terms_required');
    expect(await errorOf(db.rpc(uid, 'accept_terms', { p_adult: false, p_terms_version: '1' }))).toBe('adult_required');
    const st = await db.rpc<{ account: { adultConfirmed: boolean } }>(uid, 'accept_terms', { p_adult: true, p_terms_version: '1' });
    expect(st.account.adultConfirmed).toBe(true);
  });

  it('perfil nuevo: personajes iniciales, progreso en cero, sin datos personales', async () => {
    const { state } = await newPlayer('MARTINA');
    expect(state.characters.map((c) => c.id).sort()).toEqual(['player_default', 'player_girl', 'player_runner', 'player_skater']);
    expect(state.stats.coins).toBe(0);
    expect(state.levels).toEqual({});
    expect(JSON.stringify(state)).not.toMatch(/@|email|account/i);
  });

  it('apodos: formato, palabras prohibidas y únicos sin importar acentos', async () => {
    const { uid } = await newPlayer('LUCÍA');
    const other = await db.createUser();
    await db.rpc(other, 'accept_terms', { p_adult: true, p_terms_version: '1' });
    const make = (n: string) => errorOf(db.rpc(other, 'create_profile', { p_nickname: n, p_avatar: 'pibe' }));
    expect(await make('LUCIA')).toBe('nickname_taken');
    expect(await make('lucia')).toBe('nickname_invalid');
    expect(await make('AB')).toBe('nickname_invalid');
    expect(await make('12345')).toBe('nickname_invalid');
    expect(await make('EL PUTO')).toBe('nickname_banned');
    expect(await make('P3L0TUD0')).toBe('nickname_banned');
    expect(await make('JUGADOR 1')).toBe('nickname_banned');
    expect(await make('PIJAMA')).toBe('');
    expect(await errorOf(db.rpc(other, 'create_profile', { p_nickname: freshNick(), p_avatar: 'foto' }))).toBe('avatar_invalid');
    expect(uid).toBeTruthy();
  });

  it('máximo de perfiles por cuenta', async () => {
    const uid = await db.createUser();
    await db.rpc(uid, 'accept_terms', { p_adult: true, p_terms_version: '1' });
    for (let i = 0; i < 6; i++) await db.rpc(uid, 'create_profile', { p_nickname: freshNick(), p_avatar: 'pibe' });
    expect(await errorOf(db.rpc(uid, 'create_profile', { p_nickname: freshNick(), p_avatar: 'pibe' }))).toBe('too_many_profiles');
  });

  it('perfil supervisado: consentimiento, privado y sin funciones sociales por defecto', async () => {
    const { uid } = await newPlayer();
    expect(await errorOf(db.rpc(uid, 'create_profile', { p_nickname: freshNick(), p_avatar: 'piba', p_supervised: true }))).toBe('consent_required');
    const kid = await db.rpc<State>(uid, 'create_profile', { p_nickname: freshNick(), p_avatar: 'piba', p_supervised: true, p_guardian_consent: true });
    expect(kid.profile).toMatchObject({ supervised: true, visibility: 'private', showInRankings: false, socialEnabled: false });
    const id = kid.profile.id;
    expect(await errorOf(db.rpc(uid, 'update_profile', { p_profile: id, p_changes: { socialEnabled: true } }))).toBe('consent_required');
    expect(await errorOf(db.rpc(uid, 'update_profile', { p_profile: id, p_changes: { showInRankings: true } }))).toBe('consent_required');
    const up = await db.rpc<State>(uid, 'update_profile', { p_profile: id, p_changes: { socialEnabled: true, showInRankings: true, guardianConsent: true } });
    expect(up.profile).toMatchObject({ socialEnabled: true, showInRankings: true, visibility: 'private' });
    const consents = await db.sql<{ consent: string }>(`select consent from public.guardian_consents where profile_id = $1 order by created_at, consent`, [id]);
    expect(consents.map((c) => c.consent).sort()).toEqual(['rankings', 'social_features', 'supervised_profile']);
  });

  it('cambio de apodo: el primero es libre, después uno por día', async () => {
    const { uid, profileId } = await newPlayer();
    const first = await db.rpc<State>(uid, 'update_profile', { p_profile: profileId, p_changes: { nickname: freshNick() } });
    expect(first.profile.nickname).toMatch(/^NICK/);
    expect(await errorOf(db.rpc(uid, 'update_profile', { p_profile: profileId, p_changes: { nickname: freshNick() } }))).toBe('nickname_cooldown');
    const fav = await db.rpc<State & { profile: { favoriteCharacter: string } }>(uid, 'update_profile', {
      p_profile: profileId,
      p_changes: { favoriteCharacter: 'player_skater', avatarId: 'soretito', visibility: 'friends' },
    });
    expect(fav.profile).toMatchObject({ favoriteCharacter: 'player_skater', visibility: 'friends' });
  });
});

describe('partidas: validación y recompensas', () => {
  it('partida limpia: oficial, progreso, monedas, logros y estadísticas', async () => {
    const { uid, profileId } = await newPlayer();
    const res = await submit(uid, profileId, cleanRun());
    expect(res.status).toBe('valid');
    expect(res.reasons).toEqual([]);
    expect(res.official).toBe(true);
    expect(res.ranks.speed).toBe(1);
    expect(res.rewards).toMatchObject({ coins: 51, starCoins: 20, newStars: 2 });
    expect(res.state.levels[L1.id]).toMatchObject({ completed: true, stars: 2, bestScore: 19000, plays: 1, source: 'game' });
    expect(res.state.stats).toMatchObject({ coins: 71, runsPlayed: 1, runsCompleted: 1, levelsCompleted: 1, crossings: 4, poopsDodged: 100 });
    expect(res.state.achievements).toMatchObject({ trashDeposited: 3, safeCrossings: 4, levelsCompleted: 1, flawlessLevels: 1, waterJetsDodged: 1 });
    expect(res.state.missionRewards).toEqual([`trash-to-bin@${L1.id}`]);
  });

  it('reenviar la misma partida no acredita dos veces', async () => {
    const { uid, profileId } = await newPlayer();
    const run = cleanRun();
    await submit(uid, profileId, run);
    const again = await submit(uid, profileId, run);
    expect(again.duplicate).toBe(true);
    expect(again.state.stats.coins).toBe(71);
    expect(again.state.levels[L1.id].plays).toBe(1);
  });

  it('el bonus de primera vez de la misión se cobra una sola vez', async () => {
    const { uid, profileId } = await newPlayer();
    await submit(uid, profileId, cleanRun());
    const second = await submit(uid, profileId, cleanRun());
    // Sin bonus de primera vez el tope es 45 + 6: llegan 51 → se recorta y queda sospechosa.
    expect(second.rewards.coins).toBe(51);
    expect(second.status).toBe('valid');
    const third = await submit(uid, profileId, cleanRun({ attempt: { ...(cleanRun().attempt as object), coinsBanked: 52 } }));
    expect(third.status).toBe('suspicious');
    expect(third.reasons).toContain('coins_high');
    expect(third.rewards.coins).toBe(51);
  });

  it('rechaza lo imposible: nivel bloqueado, personaje bloqueado, tiempo y puntaje', async () => {
    const { uid, profileId } = await newPlayer();
    const locked = await submit(uid, profileId, cleanRun({ levelId: L2.id }));
    expect(locked.status).toBe('rejected');
    expect(locked.reasons).toContain('level_locked');
    const char = await submit(uid, profileId, cleanRun({ characterId: 'player_police' }));
    expect(char.reasons).toContain('character_locked');
    const fast = await submit(uid, profileId, cleanRun({ timeMs: L1.minTimeMs - 1 }));
    expect(fast.reasons).toContain('time_impossible');
    const score = await submit(uid, profileId, cleanRun({ score: L1.maxScore + 1 }));
    expect(score.reasons).toContain('score_impossible');
    const tt = await submit(uid, profileId, cleanRun({ mode: 'timeTrial' }));
    expect(tt.reasons).toContain('level_locked');
    // Nada se acreditó.
    expect(tt.state.stats.coins).toBe(0);
    expect(tt.state.levels).toEqual({});
    expect(tt.state.stats.runsPlayed).toBe(0);
    const stored = await db.sql<{ status: string }>(`select status from public.runs where profile_id = $1`, [profileId]);
    expect(stored.every((r) => r.status === 'rejected')).toBe(true);
  });

  it('datos de forma inválida: error sin guardar nada', async () => {
    const { uid, profileId } = await newPlayer();
    expect(await errorOf(submit(uid, profileId, cleanRun({ levelId: 'nivel-trucho' })))).toBe('invalid_payload');
    expect(await errorOf(submit(uid, profileId, cleanRun({ clientRunId: "x'; drop table runs;--" })))).toBe('invalid_payload');
    expect(await errorOf(submit(uid, profileId, cleanRun({ score: 'mucho' })))).toBe('invalid_payload');
    expect(await db.sql(`select 1 from public.runs where profile_id = $1`, [profileId])).toEqual([]);
  });

  it('datos incoherentes: sospechosa, fuera de los rankings y con lo acreditado recortado', async () => {
    const { uid, profileId } = await newPlayer();
    const res = await submit(uid, profileId, cleanRun({
      score: 19000,
      breakdown: { distance: 4700, dodge: 12000, bonus: 2500, penalty: 0, speed: 1000 },
      attempt: { ...(cleanRun().attempt as object), achievements: { trashDeposited: 50, poopsDodged: 9999 } },
      splits: [40000, 30000],
    }));
    expect(res.status).toBe('suspicious');
    expect(res.official).toBe(false);
    expect(res.reasons).toEqual(expect.arrayContaining(['breakdown_mismatch', 'achievements_high', 'splits_incoherent']));
    expect(res.state.achievements.trashDeposited).toBe(3);
    expect(res.state.achievements.poopsDodged).toBe(L1.dodgeables);
    expect(res.ranks.speed).toBeNull();
    const dodge = await submit(uid, profileId, cleanRun({ counts: { ...(cleanRun().counts as object), dodged: 2 } }));
    expect(dodge.reasons).toContain('dodge_points_incoherent');
  });

  it('partida asistida (checkpoint): se acredita, pero nunca es oficial ni cobra bonus de velocidad', async () => {
    const { uid, profileId } = await newPlayer();
    const res = await submit(uid, profileId, cleanRun({
      assisted: true,
      assistReasons: ['checkpoint'],
      continues: 1,
      startBlock: 2,
      startTimeMs: 90000,
      breakdown: bd(0),
      attempt: { ...(cleanRun().attempt as object), achievements: { trashDeposited: 3, safeCrossings: 2, poopsDodged: 50, levelsCompleted: 1 } },
    }));
    expect([res.status, res.reasons]).toEqual(['valid', []]);
    expect(res.official).toBe(false);
    expect(res.state.levels[L1.id].completed).toBe(true);
    const cheat = await submit(uid, profileId, cleanRun({ assisted: true, continues: 1 }));
    expect(cheat.reasons).toContain('speed_bonus_mismatch');
    const hidden = await submit(uid, profileId, cleanRun({ assisted: false, continues: 2, breakdown: bd(0) }));
    expect(hidden.reasons).toContain('assist_inconsistent');
    expect(hidden.official).toBe(false);
    const runs = await db.sql<{ assisted: boolean; assist_reasons: string[] }>(`select assisted, assist_reasons from public.runs where profile_id = $1`, [profileId]);
    expect(runs.every((r) => r.assisted && r.assist_reasons.includes('checkpoint'))).toBe(true);
  });

  it('partida perdida: suma monedas y logros de lo jugado, no completa el nivel', async () => {
    const { uid, profileId } = await newPlayer();
    const res = await submit(uid, profileId, cleanRun({
      completed: false,
      timeMs: 95000,
      score: 3000,
      blocksCompleted: 2,
      shoesLeft: 0,
      breakdown: { distance: 2000, dodge: 1000, bonus: 0, penalty: 0, speed: 0 },
      counts: { dodged: 20, bestStreak: 8, closeCalls: 0, crossings: 2, carHits: 1, missions: 0 },
      attempt: { dodged: 20, crossings: 2, carHits: 1, missions: 0, coinsBanked: 12, achievements: { safeCrossings: 2, poopsDodged: 20 } },
      splits: [40000, 80000],
    }));
    expect([res.status, res.reasons]).toEqual(['valid', []]);
    expect(res.official).toBe(false);
    expect(res.state.levels).toEqual({});
    expect(res.state.stats).toMatchObject({ coins: 12, runsPlayed: 1, runsCompleted: 0 });
    expect(res.state.achievements).toEqual({ safeCrossings: 2, poopsDodged: 20 });
    // levelsCompleted no corresponde en una partida perdida: se recorta a 0 (y queda sospechosa).
    const odd = await submit(uid, profileId, cleanRun({ completed: false, timeMs: 95000, blocksCompleted: 2, attempt: { coinsBanked: 0, achievements: { levelsCompleted: 1 } } }));
    expect(odd.reasons).toContain('achievements_high');
    expect(odd.state.achievements.levelsCompleted).toBeUndefined();
  });

  it('desbloqueo de personajes por desafío (servidor) con insignia', async () => {
    const { uid, profileId } = await newPlayer();
    let last: RunResult | null = null;
    for (let i = 0; i < 7; i++) last = await submit(uid, profileId, cleanRun());
    expect(last!.state.achievements.trashDeposited).toBe(21);
    // 7 × 4 = 28 cruces seguros: también se desbloquea el policía (25).
    expect(last!.rewards.unlockedCharacters).toEqual(['player_police', 'player_portero']);
    expect(last!.state.characters.some((c) => c.id === 'player_portero' && c.source === 'challenge')).toBe(true);
    expect(last!.state.badges.map((b) => b.id)).toContain('char:player_portero');
    const portero = await submit(uid, profileId, cleanRun({ characterId: 'player_portero' }));
    expect(portero.status).toBe('valid');
  });

  it('progresión: el nivel 2 se abre al completar el 1; la contrarreloj, al completar el nivel', async () => {
    const { uid, profileId } = await newPlayer();
    await submit(uid, profileId, cleanRun());
    const l2 = await submit(uid, profileId, cleanRun({
      levelId: L2.id,
      attempt: { ...(cleanRun().attempt as object), coinsBanked: 10, achievements: { animalMissions: 1 } },
    }));
    expect(l2.reasons).not.toContain('level_locked');
    const tt = await submit(uid, profileId, cleanRun({ mode: 'timeTrial', breakdown: bd(0) }));
    expect([tt.status, tt.reasons]).toEqual(['valid', []]);
    expect(tt.official).toBe(true);
    // La contrarreloj no cambia la campaña.
    expect(tt.state.levels[L1.id].plays).toBe(1);
  });

  it('límite de envíos por minuto', async () => {
    const { uid, profileId } = await newPlayer();
    await db.sql(
      `insert into public.runs (profile_id, account_id, client_run_id, nickname, level_id, barrio_id, mode, character_id, completed, score, assisted, status, played_at)
       select $1, $2, 'flood-' || g, 'X', 'san-telmo-1', 'san-telmo', 'normal', 'player_default', false, 0, false, 'valid', now()
       from generate_series(1, 40) g`,
      [profileId, uid],
    );
    expect(await errorOf(submit(uid, profileId, cleanRun()))).toBe('rate_limited');
  });
});

describe('rankings online', () => {
  type Board = { rows: { rank: number; nickname: string; timeMs: number; score: number; characterId: string; isMe: boolean; profileId: string }[]; me: { rank: number } | null };
  const board = (uid: string | null, kind: string, viewer: string | null = null, scope = 'global') =>
    db.rpc<Board>(uid, 'get_leaderboard', { p_level: 'monserrat-2', p_mode: 'normal', p_kind: kind, p_scope: scope, p_viewer: viewer, p_limit: 10 });

  /** Jugador con el nivel monserrat-2 desbloqueado (por debajo, como lo haría el servidor). */
  async function playerOnM2(nick?: string) {
    const p = await newPlayer(nick);
    await db.sql(
      `insert into public.profile_levels (profile_id, level_id, completed, stars, best_score, plays)
       select $1, id, true, 1, 1000, 1 from public.game_levels where id in ('san-telmo-1','san-telmo-2','san-telmo-3','monserrat-1')`,
      [p.profileId],
    );
    return p;
  }
  const m2 = (timeMs: number, score: number, over: Record<string, unknown> = {}) => {
    const dodge = score - 4700 - 2500 + 200;
    return cleanRun({
      levelId: 'monserrat-2',
      timeMs,
      score,
      breakdown: { distance: 4700, dodge, bonus: 2500, penalty: 200, speed: 0 },
      attempt: { dodged: 100, crossings: 4, carHits: 0, missions: 0, coinsBanked: 10, achievements: {} },
      counts: { dodged: 100, bestStreak: 30, closeCalls: 5, crossings: 4, carHits: 0, missions: 0 },
      ...over,
    });
  };
  // Tiempos por encima del umbral "aceptable" (sin bonus de velocidad).
  const T = (s: number) => (L1.timeOkS + s) * 1000;

  let ana: Awaited<ReturnType<typeof playerOnM2>>;
  let beto: Awaited<ReturnType<typeof playerOnM2>>;
  let ceci: Awaited<ReturnType<typeof playerOnM2>>;

  beforeAll(async () => {
    ana = await playerOnM2('ANA');
    beto = await playerOnM2('BETO');
    ceci = await playerOnM2('CECI');
    await submit(ana.uid, ana.profileId, m2(T(30), 20000));
    await submit(ana.uid, ana.profileId, m2(T(10), 15000)); // mejor tiempo de ANA
    await submit(beto.uid, beto.profileId, m2(T(20), 30000, { characterId: 'player_skater' }));
    await submit(ceci.uid, ceci.profileId, m2(T(5), 25000, { continues: 1, assisted: true })); // asistida: no cuenta
    await submit(ceci.uid, ceci.profileId, m2(T(40), 10000, { breakdown: { distance: 1, dodge: 1, bonus: 1, penalty: 0, speed: 0 } })); // sospechosa
  });

  it('velocidad: una marca por perfil, sólo oficiales, de menor a mayor', async () => {
    const b = await board(null, 'speed');
    expect(b.rows.map((r) => [r.rank, r.nickname, r.timeMs])).toEqual([
      [1, 'ANA', T(10)],
      [2, 'BETO', T(20)],
    ]);
    expect(b.me).toBeNull();
  });

  it('puntuación y personajes', async () => {
    const s = await board(null, 'score');
    expect(s.rows.map((r) => [r.nickname, r.score])).toEqual([
      ['BETO', 30000],
      ['ANA', 20000],
    ]);
    const c = await board(null, 'character');
    expect(c.rows.map((r) => [r.characterId, r.nickname])).toEqual([
      ['player_default', 'ANA'],
      ['player_skater', 'BETO'],
    ]);
  });

  it('mi puesto, bloqueos y perfiles ocultos', async () => {
    const mine = await board(beto.uid, 'speed', beto.profileId);
    expect(mine.me?.rank).toBe(2);
    expect(mine.rows.find((r) => r.isMe)?.nickname).toBe('BETO');
    // Un viewer ajeno se ignora (no puede ver "como" otro perfil).
    const spoof = await board(ana.uid, 'speed', beto.profileId);
    expect(spoof.me).toBeNull();
    await db.rpc(beto.uid, 'block_profile', { p_me: beto.profileId, p_other: ana.profileId });
    const blocked = await board(beto.uid, 'speed', beto.profileId);
    expect(blocked.rows.map((r) => r.nickname)).toEqual(['BETO']);
    // Para los demás, ANA sigue apareciendo.
    expect((await board(null, 'speed')).rows).toHaveLength(2);
    await db.rpc(beto.uid, 'unblock_profile', { p_me: beto.profileId, p_other: ana.profileId });
    await db.rpc(ana.uid, 'update_profile', { p_profile: ana.profileId, p_changes: { showInRankings: false } });
    expect((await board(null, 'speed')).rows.map((r) => r.nickname)).toEqual(['BETO']);
    await db.rpc(ana.uid, 'update_profile', { p_profile: ana.profileId, p_changes: { showInRankings: true } });
  });

  it('cuentas suspendidas fuera del ranking; amigos', async () => {
    await db.rpc(null, 'set_account_ban', { p_account: beto.uid, p_banned: true, p_reason: 'prueba' }, 'service_role');
    expect((await board(null, 'speed')).rows.map((r) => r.nickname)).toEqual(['ANA']);
    expect(await errorOf(submit(beto.uid, beto.profileId, m2(T(1), 1000)))).toBe('account_banned');
    await db.rpc(null, 'set_account_ban', { p_account: beto.uid, p_banned: false }, 'service_role');

    expect((await board(ceci.uid, 'speed', ceci.profileId, 'friends')).rows).toEqual([]);
    expect(await db.rpc(ceci.uid, 'send_friend_request', { p_me: ceci.profileId, p_other: ana.profileId })).toBe('pending');
    expect(await db.rpc(ana.uid, 'respond_friend_request', { p_me: ana.profileId, p_other: ceci.profileId, p_accept: true })).toBe('friends');
    const friends = await board(ceci.uid, 'speed', ceci.profileId, 'friends');
    expect(friends.rows.map((r) => r.nickname)).toEqual(['ANA']);
  });
});

describe('privacidad del perfil público', () => {
  type Pub = { limited: boolean; stats: unknown; badges: unknown; friendStatus: string; blockedByMe: boolean };
  it('público, sólo amigos y privado; nunca datos de la cuenta', async () => {
    const owner = await newPlayer();
    const viewer = await newPlayer();
    await submit(owner.uid, owner.profileId, cleanRun());
    const pub = await db.rpc<Pub>(null, 'get_public_profile', { p_profile: owner.profileId });
    expect(pub.limited).toBe(false);
    expect(pub.stats).toBeTruthy();
    expect(JSON.stringify(pub)).not.toMatch(/@|email|account/i);

    await db.rpc(owner.uid, 'update_profile', { p_profile: owner.profileId, p_changes: { visibility: 'friends' } });
    const asStranger = await db.rpc<Pub>(viewer.uid, 'get_public_profile', { p_profile: owner.profileId, p_viewer: viewer.profileId });
    expect(asStranger).toMatchObject({ limited: true, stats: null, badges: null, friendStatus: 'none' });
    await db.rpc(viewer.uid, 'send_friend_request', { p_me: viewer.profileId, p_other: owner.profileId });
    expect((await db.rpc<Pub>(viewer.uid, 'get_public_profile', { p_profile: owner.profileId, p_viewer: viewer.profileId })).friendStatus).toBe('outgoing');
    await db.rpc(owner.uid, 'respond_friend_request', { p_me: owner.profileId, p_other: viewer.profileId, p_accept: true });
    expect((await db.rpc<Pub>(viewer.uid, 'get_public_profile', { p_profile: owner.profileId, p_viewer: viewer.profileId })).limited).toBe(false);

    await db.rpc(owner.uid, 'update_profile', { p_profile: owner.profileId, p_changes: { visibility: 'private' } });
    expect((await db.rpc<Pub>(viewer.uid, 'get_public_profile', { p_profile: owner.profileId, p_viewer: viewer.profileId })).limited).toBe(true);
    // El dueño siempre ve todo.
    expect((await db.rpc<Pub>(owner.uid, 'get_public_profile', { p_profile: owner.profileId })).limited).toBe(false);

    // Si me bloquea, no lo encuentro.
    await db.rpc(owner.uid, 'block_profile', { p_me: owner.profileId, p_other: viewer.profileId });
    expect(await errorOf(db.rpc(viewer.uid, 'get_public_profile', { p_profile: owner.profileId, p_viewer: viewer.profileId }))).toBe('profile_not_found');
  });
});

describe('importación del progreso local (no verificado)', () => {
  it('una sola vez, coherente, con topes y fuera de los rankings oficiales', async () => {
    const { uid, profileId } = await newPlayer();
    const payload = {
      levels: {
        'san-telmo-1': { completed: true, stars: 3, bestScore: 999999, plays: 4 },
        'san-telmo-2': { completed: true, stars: 2, bestScore: 20000, plays: 2 },
        // Sin san-telmo-3 completo, monserrat no está desbloqueado: se ignora.
        'monserrat-1': { completed: true, stars: 3, bestScore: 30000, plays: 1 },
      },
      coins: 1_000_000,
      achievements: { trashDeposited: 500, animalMissions: 1, poopsDodged: 3, desconocido: 4 },
      missionRewards: [`trash-to-bin@${L1.id}`, 'lost-dog@monserrat-1', 'cualquiera@x'],
      records: [
        { id: 'r-local-1', levelId: L1.id, mode: 'normal', characterId: 'player_girl', timeMs: 150000, score: 25000, date: '2026-11-01T10:00:00Z', assisted: false },
        { id: 'r-local-2', levelId: L1.id, mode: 'normal', characterId: 'player_girl', timeMs: 10, score: 1, date: '2026-11-01T10:00:00Z', assisted: false },
        { id: 'legacy-x', levelId: 'nivel-x', mode: 'normal', characterId: 'x', timeMs: null, score: 100 },
      ],
    };
    const st = await db.rpc<State & { imported: { coins: number; records: number } }>(uid, 'import_local_progress', { p_profile: profileId, p_payload: payload });
    expect(Object.keys(st.levels).sort()).toEqual(['san-telmo-1', 'san-telmo-2']);
    expect(st.levels['san-telmo-1']).toMatchObject({ completed: true, stars: 3, bestScore: L1.maxScore, source: 'import' });
    expect(st.achievements.trashDeposited).toBe(3 * 4);
    expect(st.achievements.animalMissions).toBe(1);
    expect(st.missionRewards).toEqual([`trash-to-bin@${L1.id}`]);
    expect(st.imported.records).toBe(2);
    expect(st.imported.coins).toBeLessThan(1_000_000);
    expect(st.stats.coins).toBe(st.imported.coins);
    expect(st.stats.levelsCompleted).toBe(2);

    expect(await errorOf(db.rpc(uid, 'import_local_progress', { p_profile: profileId, p_payload: payload }))).toBe('already_imported');

    // Récords importados: personales "no verificados", nunca en el ranking.
    const board = await db.rpc<{ rows: unknown[] }>(null, 'get_leaderboard', { p_level: L1.id, p_mode: 'normal', p_kind: 'score', p_scope: 'global', p_viewer: null, p_limit: 50 });
    expect(JSON.stringify(board.rows)).not.toContain(profileId);
    const recs = await db.rpc<{ levelId: string; bestTime: unknown; unverifiedTime: { timeMs: number } | null; unverifiedScore: { score: number } }[]>(uid, 'get_personal_records', { p_profile: profileId });
    const r1 = recs.find((r) => r.levelId === L1.id)!;
    expect(r1.bestTime).toBeNull();
    expect(r1.unverifiedTime?.timeMs).toBe(150000);
    expect(r1.unverifiedScore.score).toBe(25000);

    // Lo importado desbloquea la campaña: ya puede jugar el nivel 3 de verdad.
    const l3 = await submit(uid, profileId, cleanRun({ levelId: 'san-telmo-3' }));
    expect(l3.reasons).not.toContain('level_locked');
  });
});

describe('funciones sociales (etapa 2)', () => {
  it('amistades, bloqueos, desafíos y reportes', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const kid = await db.rpc<State>(a.uid, 'create_profile', { p_nickname: freshNick(), p_avatar: 'piba', p_supervised: true, p_guardian_consent: true });
    expect(await errorOf(db.rpc(b.uid, 'send_friend_request', { p_me: b.profileId, p_other: kid.profile.id }))).toBe('social_disabled');

    expect(await db.rpc(a.uid, 'send_friend_request', { p_me: a.profileId, p_other: b.profileId })).toBe('pending');
    // Si el otro también la manda, quedan amigos.
    expect(await db.rpc(b.uid, 'send_friend_request', { p_me: b.profileId, p_other: a.profileId })).toBe('friends');
    const list = await db.rpc<{ friends: { nickname: string }[] }>(a.uid, 'get_friends', { p_me: a.profileId });
    expect(list.friends).toHaveLength(1);

    // Desafío: superar mi mejor tiempo oficial.
    expect(await errorOf(db.rpc(a.uid, 'create_challenge', { p_me: a.profileId, p_other: b.profileId, p_level: L1.id, p_mode: 'normal', p_kind: 'time' }))).toBe('no_official_record');
    const own = await submit(a.uid, a.profileId, cleanRun({ timeMs: 230000, breakdown: bd(500) }));
    expect([own.status, own.reasons]).toEqual(['valid', []]);
    const ch = await db.rpc<{ challengeId: string; targetValue: number }>(a.uid, 'create_challenge', { p_me: a.profileId, p_other: b.profileId, p_level: L1.id, p_mode: 'normal', p_kind: 'time' });
    expect(ch.targetValue).toBe(230000);
    expect(await db.rpc(b.uid, 'respond_challenge', { p_me: b.profileId, p_challenge: ch.challengeId, p_accept: true })).toBe('accepted');
    await submit(b.uid, b.profileId, cleanRun());
    const chs = await db.rpc<{ status: string; incoming: boolean }[]>(b.uid, 'get_challenges', { p_me: b.profileId });
    expect(chs[0]).toMatchObject({ status: 'completed', incoming: true });

    // Bloquear corta la amistad.
    await db.rpc(b.uid, 'block_profile', { p_me: b.profileId, p_other: a.profileId });
    expect((await db.rpc<{ friends: unknown[] }>(a.uid, 'get_friends', { p_me: a.profileId })).friends).toEqual([]);
    expect(await errorOf(db.rpc(a.uid, 'send_friend_request', { p_me: a.profileId, p_other: b.profileId }))).toBe('blocked');
    expect(await db.rpc<unknown[]>(b.uid, 'get_blocked', { p_me: b.profileId })).toHaveLength(1);

    // Reportes: se guardan para moderación; un reporte abierto repetido no se duplica.
    await db.rpc(b.uid, 'report_profile', { p_me: b.profileId, p_other: a.profileId, p_reason: 'nickname', p_details: 'no me gusta' });
    await db.rpc(b.uid, 'report_profile', { p_me: b.profileId, p_other: a.profileId, p_reason: 'nickname' });
    const reports = await db.sql<{ nickname_snapshot: string }>(`select nickname_snapshot from public.reports where reported_id = $1`, [a.profileId]);
    expect(reports).toHaveLength(1);
    // Moderación (service_role): cambia el apodo y cierra los reportes.
    const newNick = await db.rpc<string>(null, 'moderate_nickname', { p_profile: a.profileId }, 'service_role');
    expect(newNick).toMatch(/^JUG [0-9A-F]{6}$/);
    const open = await db.sql(`select 1 from public.reports where reported_id = $1 and status = 'open'`, [a.profileId]);
    expect(open).toEqual([]);
  });
});

describe('apodos: la regla del juego y la del servidor coinciden', () => {
  it('mismos resultados para una lista de ejemplos', async () => {
    const samples = [
      'LUCÍA', 'LUCIA', 'TOMI 10', 'EL PUTO', 'PUT0', 'PUTOS', 'PIJAMA', 'COMPUTADORA', 'P3L0TUD0', 'ELPELOTUDO', 'MARICARMEN', 'MARICAS',
      'JUGADOR 1', 'JUGADORA', 'SORETITO', 'AB', 'ABC', '1234', ' ANA', 'ANA  B', 'ÑOQUI', 'FUCKER', 'SEXTO', 'SEX', 'NAZIS', 'NAZISMO',
      'ADMIN', 'EL ADMIN', 'CONCHITA', 'LA CONCHA', 'DISPUTA', 'ESCOGER', 'GORDO', 'ÁÉÍÓÚ',
    ];
    const sql = await db.sql<{ n: string; p: string | null }>(
      `select n, private.nickname_problem(n) as p from unnest($1::text[]) as n`,
      [samples],
    );
    const fromServer = Object.fromEntries(sql.map((r) => [r.n, r.p]));
    for (const s of samples) expect([s, nicknameProblem(s)]).toEqual([s, fromServer[s]]);
    expect(BANNED_WORDS.length).toBeGreaterThan(50);
  });
});
