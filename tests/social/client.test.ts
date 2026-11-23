import { describe, expect, it } from 'vitest';
import type { RecordEntry } from '../../src/core/leaderboard';
import { createDefaultSave, migrateSaveFile, sanitizeOnlineLink } from '../../src/core/progress';
import { toSocialError } from '../../src/social/backend';
import { looksSecret, readOnlineConfig } from '../../src/social/config';
import { cleanNicknameInput, nicknameKey, nicknameProblem } from '../../src/social/nicknameRules';
import { Outbox, OUTBOX_LIMIT } from '../../src/social/outbox';
import { buildRunReport, type RunReportSource } from '../../src/social/runReport';
import { importPayloadFrom, localBestEntries, saveFromServer } from '../../src/social/stateMapping';
import type { ProfileState, RunReport } from '../../src/social/types';

/** Lógica pura del cliente online (sin navegador ni servidor). */

const jwt = (payload: object) => `xxx.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.yyy`;

describe('configuración: nunca una clave secreta en el juego', () => {
  it('detecta claves secretas nuevas y la vieja service_role', () => {
    expect(looksSecret('sb_secret_abc123')).toBe(true);
    expect(looksSecret(jwt({ role: 'service_role', iss: 'supabase' }))).toBe(true);
    expect(looksSecret(jwt({ role: 'anon', iss: 'supabase' }))).toBe(false);
    expect(looksSecret('sb_publishable_abc123')).toBe(false);
  });

  it('sin variables: modo local; con una clave secreta: tampoco arranca', () => {
    expect(readOnlineConfig({})).toMatchObject({ configured: false, problem: 'missing' });
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' })).toMatchObject({
      configured: false,
      problem: 'secret_key',
    });
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'ftp://nada', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).problem).toBe('bad_url');
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) })).toMatchObject({
      configured: true,
      url: 'https://abc.supabase.co',
    });
    expect(readOnlineConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).configured).toBe(true);
  });
});

describe('errores del servidor', () => {
  it('códigos estables, conexión y migraciones faltantes', () => {
    expect(toSocialError({ message: 'nickname_taken', code: 'P0001' }).code).toBe('nickname_taken');
    expect(toSocialError({ message: 'TypeError: Failed to fetch', code: '' })).toMatchObject({ code: 'network', retryable: true });
    expect(toSocialError({ message: 'boom' }, 503)).toMatchObject({ code: 'network', retryable: true });
    expect(toSocialError({ message: 'Could not find the function', code: 'PGRST202' }).code).toBe('server_not_ready');
    expect(toSocialError({ message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }).code).toBe('invalid_credentials');
    expect(toSocialError({ message: 'permission denied for function x', code: '42501' }).code).toBe('forbidden');
  });
});

describe('apodos', () => {
  it('limpieza al escribir y clave única', () => {
    expect(cleanNicknameInput('lucía_la-1!')).toBe('LUCÍALA1');
    expect(cleanNicknameInput('  ana   b ')).toBe('ANA B ');
    expect(cleanNicknameInput('abcdefghijklmn')).toHaveLength(10);
    expect(nicknameKey('LUCÍA  ÜBER')).toBe('LUCIA UBER');
    expect(nicknameProblem('LUCÍA')).toBeNull();
    expect(nicknameProblem('PUT0')).toBe('nickname_banned');
  });
});

describe('cola de partidas pendientes', () => {
  const memory = () => {
    let value: unknown = null;
    return { load: () => value, save: (v: unknown) => (value = JSON.parse(JSON.stringify(v))), peek: () => value };
  };
  const report = (id: string) => ({ clientRunId: id }) as RunReport;

  it('no duplica, separa por cuenta, persiste y tiene tope', () => {
    const store = memory();
    const box = new Outbox(store);
    box.add('acc-a', 'prof-1', report('r-1'));
    box.add('acc-a', 'prof-1', report('r-1'));
    box.add('acc-b', 'prof-2', report('r-2'));
    expect(box.size).toBe(2);
    expect(box.pendingFor('acc-a').map((e) => e.report.clientRunId)).toEqual(['r-1']);
    box.markAttempt('r-1');
    const reloaded = new Outbox(store);
    expect(reloaded.pendingFor('acc-a')[0].attempts).toBe(1);
    reloaded.remove('r-1');
    expect(new Outbox(store).has('r-1')).toBe(false);
    for (let i = 0; i < OUTBOX_LIMIT + 5; i++) reloaded.add('acc-a', 'prof-1', report(`x-${i}`));
    expect(reloaded.size).toBe(OUTBOX_LIMIT);
    expect(reloaded.has('x-0')).toBe(false);
  });

  it('descarta datos rotos y partidas demasiado viejas', () => {
    const now = Date.parse('2026-11-18T12:00:00Z');
    const store = {
      load: () => [
        { accountId: 'a', profileId: 'p', report: { clientRunId: 'ok' }, queuedAt: '2026-11-17T12:00:00Z', attempts: 0 },
        { accountId: 'a', profileId: 'p', report: { clientRunId: 'old' }, queuedAt: '2026-10-01T12:00:00Z', attempts: 0 },
        { basura: true },
        'texto',
      ],
      save: () => undefined,
    };
    const box = new Outbox(store, () => now);
    expect(box.pendingFor('a').map((e) => e.report.clientRunId)).toEqual(['ok']);
  });
});

describe('informe de partida', () => {
  const src: RunReportSource = {
    run: { runId: 'r-abc', parentRunId: 'r-prev', continues: 1, startElapsedMs: 90000.4, splits: [40000.2, 80000.7], crossingsDone: 3, carHits: 1, missionsDone: 1 },
    levelId: 'san-telmo-1',
    mode: 'normal',
    characterId: 'player_girl',
    completed: true,
    timeMs: 210000.6,
    score: 15000,
    assisted: true,
    assistReasons: ['checkpoint', 'checkpoint'],
    startBlock: 2,
    blocksCompleted: 5,
    shoesLeft: 3,
    distancePoints: 4700,
    dodgePoints: 9000,
    bonusPoints: 1500,
    penaltyPoints: 200,
    crossingBonus: 1200,
    speedBonus: 0,
    dodged: 80,
    bestStreak: 20,
    closeCalls: 4,
    attempt: { dodged: 30, crossings: 2, carHits: 0, missions: 0, coinsBanked: 12, achievements: { poopsDodged: 30, safeCrossings: 0 } },
  };

  it('números enteros, motivos sin repetir y sólo lo que sumó este intento', () => {
    const r = buildRunReport(src, 'web-test', new Date('2026-11-18T10:00:00Z'));
    expect(r).toMatchObject({
      clientRunId: 'r-abc',
      parentRunId: 'r-prev',
      timeMs: 210001,
      startTimeMs: 90000,
      assistReasons: ['checkpoint'],
      continues: 1,
      startBlock: 2,
      splits: [40000, 80001],
      playedAt: '2026-11-18T10:00:00.000Z',
      clientVersion: 'web-test',
    });
    expect(r.breakdown).toEqual({ distance: 4700, dodge: 9000, bonus: 1500, penalty: 200, crossing: 1200, speed: 0 });
    expect(r.counts.crossings).toBe(3);
    expect(r.attempt).toEqual({ dodged: 30, crossings: 2, carHits: 0, missions: 0, coinsBanked: 12, achievements: { poopsDodged: 30 } });
    // El desglose suma el puntaje (el servidor lo verifica).
    expect(r.breakdown.distance + r.breakdown.dodge + r.breakdown.bonus - r.breakdown.penalty).toBe(r.score);
  });
});

describe('progreso: servidor ⇄ dispositivo', () => {
  const state = (over: Partial<ProfileState> = {}): ProfileState => ({
    profile: {
      id: '11111111-1111-1111-1111-111111111111',
      nickname: 'LUCIA',
      avatarId: 'piba',
      favoriteCharacter: 'player_skater',
      supervised: false,
      visibility: 'public',
      showInRankings: true,
      socialEnabled: true,
      importedAt: null,
      nicknameChangedAt: null,
      createdAt: '2026-11-18T00:00:00Z',
    },
    stats: { coins: 120, coinsEarned: 150, runsPlayed: 9, runsCompleted: 7, levelsCompleted: 3, crossings: 20, carHits: 2, poopsDodged: 300, playTimeMs: 1, bestStreak: 30 },
    levels: {
      'san-telmo-1': { completed: true, stars: 3, bestScore: 30000, plays: 3, source: 'game' },
      'san-telmo-2': { completed: true, stars: 1, bestScore: 20000, plays: 1, source: 'game' },
      'san-telmo-3': { completed: true, stars: 2, bestScore: 25000, plays: 1, source: 'import' },
    },
    achievements: { trashDeposited: 21, safeCrossings: 10, inventado: 4 } as ProfileState['achievements'],
    characters: [
      { id: 'player_default', source: 'starter' },
      { id: 'player_portero', source: 'challenge' },
      { id: 'player_neighbor', source: 'challenge' },
      { id: 'player_inexistente', source: 'challenge' },
    ],
    badges: [],
    missionRewards: ['trash-to-bin@san-telmo-1'],
    ...over,
  });

  it('arma el guardado local: barrios, monedas, personajes y logros', () => {
    const save = saveFromServer(state(), null);
    expect(save.barrios['san-telmo']).toMatchObject({ unlocked: true, completed: true });
    expect(save.barrios['monserrat']?.unlocked).toBe(true);
    expect(save.wallet).toEqual({ coins: 120, totalEarned: 150 });
    expect(save.unlocks.characters).toContain('player_portero');
    // Sólo personajes jugables y existentes.
    expect(save.unlocks.characters).not.toContain('player_neighbor');
    expect(save.unlocks.characters).not.toContain('player_inexistente');
    expect(save.achievements).toEqual({ trashDeposited: 21, safeCrossings: 10 });
    expect(save.missions.firstRewards).toEqual(['trash-to-bin@san-telmo-1']);
    expect(save.selectedCharacter).toBe('player_skater');
    // En un dispositivo nuevo no se repiten avisos de desbloqueos viejos.
    expect(save.seenUnlocks).toEqual(expect.arrayContaining(['san-telmo', 'monserrat']));
    expect(save.seenCharacters).toContain('player_portero');
  });

  it('conserva las preferencias del dispositivo y reemplaza el progreso', () => {
    const local = createDefaultSave();
    local.selectedCharacter = 'player_portero';
    local.currentBarrio = 'monserrat';
    local.wallet.coins = 9999;
    local.seenCharacters = ['player_default'];
    const save = saveFromServer(state(), local);
    expect(save.selectedCharacter).toBe('player_portero');
    expect(save.currentBarrio).toBe('monserrat');
    expect(save.wallet.coins).toBe(120);
    expect(save.seenCharacters).toEqual(expect.arrayContaining(['player_default']));
  });

  it('importación: niveles completos, monedas, logros y mejores marcas sin repetir', () => {
    const save = createDefaultSave();
    save.barrios['san-telmo'].levels['san-telmo-1'] = { completed: true, stars: 2, bestScore: 9000, plays: 3 };
    save.barrios['san-telmo'].levels['san-telmo-2'] = { completed: false, stars: 0, bestScore: 0, plays: 0 };
    save.wallet.coins = 37;
    save.achievements.trashDeposited = 6;
    const entry = (id: string, timeMs: number | null, score: number): RecordEntry => ({
      id,
      levelId: 'san-telmo-1',
      mode: 'normal',
      profileId: 'p',
      nickname: 'X',
      characterId: 'player_girl',
      timeMs,
      score,
      date: '2026-11-01T00:00:00Z',
      shoesLeft: 3,
      assisted: false,
      continues: 0,
    });
    const best = localBestEntries((levelId, mode) =>
      levelId === 'san-telmo-1' && mode === 'normal' ? { time: entry('r-1', 150000, 8000), score: entry('legacy-p-san-telmo-1', null, 9000) } : { time: null, score: null },
    );
    const payload = importPayloadFrom(save, best);
    expect(payload.levels).toEqual({ 'san-telmo-1': { completed: true, stars: 2, bestScore: 9000, plays: 3 } });
    expect(payload.coins).toBe(37);
    expect(payload.achievements).toEqual({ trashDeposited: 6 });
    expect(payload.records.map((r) => r.id)).toEqual(['r-1', 'legacy-p-san-telmo-1']);
  });
});

describe('guardado local con perfiles vinculados', () => {
  const link = { profileId: '11111111-1111-1111-1111-111111111111', accountId: '22222222-2222-2222-2222-222222222222' };
  it('conserva el vínculo, descarta vínculos rotos y duplicados', () => {
    expect(sanitizeOnlineLink(link)).toEqual(link);
    expect(sanitizeOnlineLink({ profileId: 'x', accountId: 'y' })).toBeUndefined();
    const file = migrateSaveFile({
      version: 3,
      activeProfileId: 'a',
      profiles: [
        { id: 'a', nickname: 'LUCIA', createdAt: '2026-01-01', data: {}, online: link },
        { id: 'b', nickname: 'COPIA', createdAt: '2026-01-01', data: {}, online: link },
        { id: 'c', nickname: 'LOCAL', createdAt: '2026-01-01', data: {}, online: { profileId: 'roto' } },
      ],
    });
    expect(file.profiles.map((p) => [p.id, !!p.online])).toEqual([
      ['a', true],
      ['c', false],
    ]);
  });
});
