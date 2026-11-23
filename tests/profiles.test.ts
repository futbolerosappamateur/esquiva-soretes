import { afterEach, describe, expect, it } from 'vitest';
import { addPending, bankAchievements, checkCharacterUnlocks, unlockProgress } from '../src/core/achievementsLogic';
import {
  applyLevelResult,
  createDefaultSave,
  createProfile,
  isTimeTrialUnlocked,
  levelProgress,
  MAX_PROFILES,
  migrateSave,
  migrateSaveFile,
  NICKNAME_MAX,
  sanitizeNickname,
} from '../src/core/progress';
import { createRun, runFromCheckpoint } from '../src/core/RunState';
import { SaveStore } from '../src/core/save';
import { getCharacter, STARTER_CHARACTERS } from '../src/data/characters';
import { ScoreSystem } from '../src/systems/ScoreSystem';

/** LocalStorage de mentira (para probar guardar y "recargar la página"). */
function installStorage(): Map<string, string> {
  const data = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  };
  return data;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** Un guardado tal como lo dejaba la v0.2 (un solo progreso, sin perfiles). */
const V2_SAVE = {
  version: 2,
  barrios: { 'san-telmo': { unlocked: true, completed: false, levels: { 'san-telmo-1': { completed: true, stars: 2, bestScore: 8450, plays: 3 } } } },
  currentBarrio: 'san-telmo',
  seenUnlocks: ['san-telmo'],
  wallet: { coins: 37, totalEarned: 90 },
  unlocks: { characters: ['player_default', 'player_girl', 'player_portero', 'player_neighbor'], cosmetics: [], rewards: [] },
  selectedCharacter: 'player_neighbor',
  missions: { completions: { 'trash-to-bin': 2 }, firstRewards: ['trash-to-bin@san-telmo-1'] },
  stats: { levelsCompleted: 1, crossings: 4, carHits: 1 },
};

describe('Perfiles locales', () => {
  it('el guardado de la v0.2 pasa a ser el perfil "JUGADOR 1" sin perder nada', () => {
    const file = migrateSaveFile(V2_SAVE);
    expect(file.version).toBe(3);
    expect(file.profiles).toHaveLength(1);
    const p = file.profiles[0];
    expect(p.nickname).toBe('JUGADOR 1');
    expect(file.activeProfileId).toBe(p.id);
    expect(levelProgress(p.data, 'san-telmo-1')).toEqual({ completed: true, stars: 2, bestScore: 8450, plays: 3 });
    expect(p.data.wallet).toEqual({ coins: 37, totalEarned: 90 });
    expect(p.data.missions.firstRewards).toEqual(['trash-to-bin@san-telmo-1']);
    // El portero comprado con monedas en la v0.2 se conserva.
    expect(p.data.unlocks.characters).toContain('player_portero');
    // Don Tito ahora es un personaje futuro: no queda desbloqueado ni elegido.
    expect(p.data.unlocks.characters).not.toContain('player_neighbor');
    expect(p.data.selectedCharacter).toBe('player_default');
    expect(p.data.achievements).toEqual({});
  });

  it('sin datos crea un perfil nuevo; con perfiles los valida', () => {
    expect(migrateSaveFile(null).profiles).toHaveLength(1);
    const a = createProfile('ana');
    const b = createProfile('beto');
    const raw = {
      version: 3,
      activeProfileId: 'no-existe',
      profiles: [a, { ...b, nickname: '$$$' }, { ...a }, 'basura', ...Array.from({ length: 10 }, (_, i) => createProfile(`X${i}`))],
    };
    const file = migrateSaveFile(JSON.parse(JSON.stringify(raw)));
    expect(file.profiles.length).toBeLessThanOrEqual(MAX_PROFILES);
    expect(new Set(file.profiles.map((p) => p.id)).size).toBe(file.profiles.length);
    expect(file.activeProfileId).toBe(a.id);
    expect(file.profiles[0].nickname).toBe('ANA');
    expect(file.profiles[1].nickname).toBe('JUGADOR 2');
  });

  it('apodos: mayúsculas, sin símbolos, espacios simples y hasta 10 letras', () => {
    expect(sanitizeNickname('  ana   maría  ')).toBe('ANA MARÍA');
    expect(sanitizeNickname('<script>')).toBe('SCRIPT');
    expect(sanitizeNickname('ñandú_2026!')).toBe('ÑANDÚ2026');
    expect(sanitizeNickname('muchisimasletras').length).toBe(NICKNAME_MAX);
    expect(sanitizeNickname(42)).toBe('');
  });

  it('cada perfil tiene su propio progreso; nunca se borra el último', () => {
    installStorage();
    const store = new SaveStore();
    const first = store.activeProfile().id;
    store.update((s) => (s.wallet.coins = 50));
    const second = store.createProfile('lu')!;
    expect(store.activeProfile().nickname).toBe('LU');
    expect(store.get().wallet.coins).toBe(0);
    store.update((s) => applyLevelResult(s, { barrioId: 'san-telmo', levelIndex: 0 }, { score: 9000, stars: 2 }));
    store.selectProfile(first);
    expect(store.get().wallet.coins).toBe(50);
    expect(levelProgress(store.get(), 'san-telmo-1').completed).toBe(false);
    expect(store.renameProfile(second, '???')).toBe(false);
    expect(store.renameProfile(second, 'lucía')).toBe(true);
    expect(store.deleteProfile(second)).toBe(true);
    expect(store.deleteProfile(first)).toBe(false);
    expect(store.profiles()).toHaveLength(1);
    while (store.canCreateProfile()) store.createProfile('X');
    expect(store.profiles()).toHaveLength(MAX_PROFILES);
    expect(store.createProfile('UNO MAS')).toBeNull();
  });

  it('todo queda guardado al recargar la página, y la v0.2 se migra desde LocalStorage', () => {
    const data = installStorage();
    data.set('esquivaSoretes:save', JSON.stringify(V2_SAVE));
    data.set('esquivaSoretes:records', JSON.stringify({ bestScore: 12345 }));
    const a = new SaveStore();
    expect(a.profiles()).toHaveLength(1);
    expect(a.get().wallet.coins).toBe(37);
    const id = a.createProfile('caro')!;
    a.update((s) => {
      s.wallet.coins = 7;
      s.achievements.safeCrossings = 3;
    });
    const b = new SaveStore(); // "recarga"
    expect(b.profiles().map((p) => p.nickname)).toEqual(['JUGADOR 1', 'CARO']);
    expect(b.activeProfile().id).toBe(id);
    expect(b.get().wallet.coins).toBe(7);
    expect(b.get().achievements.safeCrossings).toBe(3);
    // Los récords viejos (otra clave) no se tocan.
    expect(JSON.parse(data.get('esquivaSoretes:records')!)).toEqual({ bestScore: 12345 });
  });
});

describe('Logros y desbloqueos', () => {
  it('se acumulan como pendientes y se acreditan una sola vez', () => {
    const save = createDefaultSave();
    const pending = {};
    addPending(pending, 'trashDeposited', 3);
    addPending(pending, 'trashDeposited', 3);
    addPending(pending, 'poopsDodged');
    bankAchievements(save, pending);
    bankAchievements(save, pending); // acreditar dos veces no duplica
    expect(save.achievements).toEqual({ trashDeposited: 6, poopsDodged: 1 });
  });

  it('cada desafío desbloquea su personaje (sin monedas) y el futuro no se habilita', () => {
    const save = createDefaultSave();
    expect(save.unlocks.characters).toEqual(STARTER_CHARACTERS);
    save.achievements.trashDeposited = 19;
    expect(checkCharacterUnlocks(save)).toEqual([]);
    expect(unlockProgress(save, getCharacter('player_portero'))).toEqual({ current: 19, target: 20, done: false });
    save.achievements.trashDeposited = 21;
    save.achievements.waterJetsDodged = 15;
    save.achievements.animalMissions = 10;
    save.achievements.safeCrossings = 25;
    save.achievements.flawlessNightLevels = 4;
    const unlocked = checkCharacterUnlocks(save).map((c) => c.id);
    expect(unlocked).toEqual(['player_portero', 'player_hose', 'player_dogwalker', 'player_police']);
    expect(save.unlocks.characters).not.toContain('player_neighbor');
    expect(save.wallet.coins).toBe(0);
    // Ya desbloqueados: no se anuncian de nuevo.
    expect(checkCharacterUnlocks(save)).toEqual([]);
  });

  it('los logros sobreviven a la migración y se descartan los inválidos', () => {
    const s = migrateSave({ ...V2_SAVE, achievements: { safeCrossings: 12.8, inventado: 99, poopsDodged: -4 } });
    expect(s.achievements).toEqual({ safeCrossings: 12 });
  });
});

describe('Partidas, checkpoints y contrarreloj', () => {
  it('la contrarreloj se habilita al completar el nivel en modo normal', () => {
    const save = createDefaultSave();
    expect(isTimeTrialUnlocked(save, 'san-telmo-1')).toBe(false);
    applyLevelResult(save, { barrioId: 'san-telmo', levelIndex: 0 }, { score: 100, stars: 1 });
    expect(isTimeTrialUnlocked(save, 'san-telmo-1')).toBe(true);
    expect(isTimeTrialUnlocked(save, 'san-telmo-2')).toBe(false);
  });

  it('reintentar desde un checkpoint conserva personaje, modalidad y tiempo, y queda como asistida', () => {
    const run = createRun({ barrioId: 'san-telmo', levelIndex: 0 }, { mode: 'normal', characterId: 'player_runner' });
    expect(run.assisted).toBe(false);
    run.achievements = { poopsDodged: 4 };
    run.checkpoint = {
      blocksCompleted: 2,
      x: 7000,
      y: 180,
      score: new ScoreSystem(0).toSnapshot(),
      coins: 0,
      crossingsDone: 2,
      missionDone: false,
      carHits: 0,
      elapsedMs: 61000,
      splits: [30000, 61000],
      missionsDone: 1,
    };
    const retry = runFromCheckpoint(run);
    expect(retry.characterId).toBe('player_runner');
    expect(retry.mode).toBe('normal');
    expect(retry.assisted).toBe(true);
    expect(retry.startElapsedMs).toBe(61000);
    expect(retry.splits).toEqual([30000, 61000]);
    expect(retry.missionsDone).toBe(1);
    expect(retry.runId).not.toBe(run.runId);
    // Lo que no se acreditó antes de morir se vuelve a ganar en el reintento (una sola vez).
    expect(retry.achievements).toEqual({});
  });

  it('cada partida tiene un id propio (un reinicio no duplica récords)', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createRun({ barrioId: 'san-telmo', levelIndex: 0 }).runId));
    expect(ids.size).toBe(50);
  });
});

describe('Tienda (preparada)', () => {
  it('está cerrada: nada se puede comprar todavía y nada vende personajes de desafíos', async () => {
    const { SHOP_ITEMS, SHOP_OPEN, isSellable } = await import('../src/data/shop');
    expect(SHOP_OPEN).toBe(false);
    for (const item of SHOP_ITEMS) {
      expect(item.available, item.id).toBe(false);
      expect(item.price).toBeGreaterThan(0);
      expect(isSellable(item)).toBe(true);
    }
    expect(isSellable({ id: 'x', category: 'characters', name: 'PORTERO', price: 1, available: false, characterId: 'player_portero' })).toBe(false);
  });
});

describe('Récords de la v0.2', () => {
  it('los puntajes por nivel se importan una sola vez como récords de puntuación (sin tiempo)', async () => {
    const data = installStorage();
    data.set('esquivaSoretes:save', JSON.stringify(V2_SAVE));
    const { vi } = await import('vitest');
    vi.resetModules();
    const { importLegacyRecords } = await import('../src/core/migrations');
    const { recordsRepo } = await import('../src/core/recordsRepository');
    importLegacyRecords();
    importLegacyRecords();
    const score = recordsRepo.scoreRanking('san-telmo-1', 'normal');
    expect(score).toHaveLength(1);
    expect(score[0]).toMatchObject({ score: 8450, timeMs: null, legacy: true, nickname: 'JUGADOR 1' });
    expect(recordsRepo.speedRanking('san-telmo-1', 'normal')).toEqual([]);
    expect(recordsRepo.legacyImported).toBe(true);
    // "Recargar": el progreso nuevo de la v0.3 no se vuelve a importar como récord viejo.
    vi.resetModules();
    const again = await import('../src/core/migrations');
    const repo2 = (await import('../src/core/recordsRepository')).recordsRepo;
    again.importLegacyRecords();
    expect(repo2.scoreRanking('san-telmo-1', 'normal')).toHaveLength(1);
  });
});
