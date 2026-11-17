import { describe, expect, it } from 'vitest';
import { RECORD_RULES, SPEED_BONUS } from '../src/config/balance';
import { formatDelta, formatTime, LevelClock } from '../src/core/LevelClock';
import { addEntry, bestByCharacter, compareScore, compareSpeed, isOfficialTime, personalBest, profileCharacterBest, sanitizeEntries, scoreRanking, speedRanking, type RecordEntry } from '../src/core/leaderboard';
import { BARRIOS } from '../src/data/campaign';
import { buildLevel, estimatedDuration, speedTargets } from '../src/world/levelBuilder';

/** Reloj de prueba controlable. */
function fakeNow() {
  let t = 1000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

let counter = 0;
function entry(over: Partial<RecordEntry> = {}): RecordEntry {
  counter++;
  return {
    id: `r${counter}`,
    levelId: 'san-telmo-1',
    mode: 'normal',
    profileId: 'p1',
    nickname: 'ANA',
    characterId: 'player_default',
    timeMs: 150000,
    score: 10000,
    date: `2026-01-${String(10 + (counter % 15)).padStart(2, '0')}T10:00:00.000Z`,
    shoesLeft: 3,
    assisted: false,
    continues: 0,
    ...over,
  };
}

describe('Cronómetro del nivel', () => {
  it('cuenta sólo mientras está en marcha: la pausa y el cambio de pestaña no suman', () => {
    const t = fakeNow();
    const c = new LevelClock(t.now);
    expect(c.elapsedMs).toBe(0);
    t.advance(5000); // antes de tener el control: no cuenta
    c.start();
    t.advance(10000);
    expect(c.elapsedMs).toBe(10000);
    c.pause(); // pausa o pestaña oculta
    t.advance(60000);
    expect(c.elapsedMs).toBe(10000);
    c.resume();
    t.advance(2500);
    expect(c.elapsedMs).toBe(12500);
    expect(c.stop()).toBe(12500);
    // Terminado: ni resultados ni transiciones suman tiempo.
    t.advance(9000);
    c.start();
    expect(c.elapsedMs).toBe(12500);
    expect(c.finished).toBe(true);
  });

  it('nunca da tiempos negativos y retoma desde un checkpoint', () => {
    const t = fakeNow();
    const c = new LevelClock(t.now);
    c.restore(-50);
    expect(c.elapsedMs).toBe(0);
    c.restore(42000);
    c.start();
    t.advance(1000);
    expect(c.elapsedMs).toBe(43000);
    // Un reloj que "vuelve atrás" no resta.
    t.advance(-5000);
    expect(c.elapsedMs).toBeGreaterThanOrEqual(42000);
  });

  it('formatea MM:SS.d y diferencias con signo', () => {
    expect(formatTime(155400)).toBe('02:35.4');
    expect(formatTime(0)).toBe('00:00.0');
    expect(formatTime(59999)).toBe('00:59.9');
    expect(formatTime(3600000)).toBe('60:00.0');
    expect(formatTime(null)).toBe('--:--.-');
    expect(formatTime(Number.NaN)).toBe('--:--.-');
    expect(formatDelta(-4200)).toBe('-4.2');
    expect(formatDelta(1300)).toBe('+1.3');
  });
});

describe('Rankings', () => {
  it('velocidad: menor tiempo; empate → más puntos → más antiguo', () => {
    const a = entry({ timeMs: 100000, score: 5000, date: '2026-01-02T00:00:00.000Z' });
    const b = entry({ timeMs: 100000, score: 6000, date: '2026-01-03T00:00:00.000Z' });
    const c = entry({ timeMs: 100000, score: 6000, date: '2026-01-01T00:00:00.000Z' });
    const d = entry({ timeMs: 90000, score: 100 });
    expect([a, b, c, d].sort(compareSpeed).map((e) => e.id)).toEqual([d.id, c.id, b.id, a.id]);
  });

  it('puntuación: mayor puntaje; empate → menor tiempo (sin tiempo al final) → más antiguo', () => {
    const a = entry({ score: 9000, timeMs: null, legacy: true });
    const b = entry({ score: 9000, timeMs: 120000 });
    const c = entry({ score: 12000, timeMs: 200000 });
    expect([a, b, c].sort(compareScore).map((e) => e.id)).toEqual([c.id, b.id, a.id]);
  });

  it('las partidas asistidas (checkpoint) y los récords viejos no entran al ranking de velocidad', () => {
    const list: RecordEntry[] = [];
    addEntry(list, entry({ id: 'oficial', timeMs: 150000 }), 1000);
    addEntry(list, entry({ id: 'asistida', timeMs: 90000, assisted: true, continues: 1 }), 1000);
    addEntry(list, entry({ id: 'vieja', timeMs: null, legacy: true, score: 99999 }), 1000);
    expect(speedRanking(list, 'san-telmo-1', 'normal').map((e) => e.id)).toEqual(['oficial']);
    // Pero sí aparecen en el de puntuación (la asistida marcada).
    expect(scoreRanking(list, 'san-telmo-1', 'normal').map((e) => e.id)).toEqual(['vieja', 'oficial', 'asistida']);
    expect(isOfficialTime(list.find((e) => e.id === 'asistida')!)).toBe(false);
  });

  it('rechaza duplicados (reinicios de escena) y tiempos imposibles o negativos', () => {
    const list: RecordEntry[] = [];
    const e = entry({ id: 'x1' });
    expect(addEntry(list, e, 1000).added).toBe(true);
    expect(addEntry(list, { ...e }, 1000)).toEqual({ added: false, reason: 'duplicate' });
    expect(addEntry(list, entry({ timeMs: -5 }), 1000).reason).toBe('invalid');
    expect(addEntry(list, entry({ timeMs: 500 }), 1000).reason).toBe('invalid');
    expect(addEntry(list, entry({ timeMs: Number.NaN }), 1000).reason).toBe('invalid');
    expect(addEntry(list, entry({ score: -1 }), 1000).reason).toBe('invalid');
    expect(list).toHaveLength(1);
  });

  it('muestra el top 10, separa modalidades y personajes', () => {
    const list: RecordEntry[] = [];
    for (let i = 0; i < 14; i++) addEntry(list, entry({ timeMs: 100000 + i * 1000, characterId: i % 2 ? 'player_girl' : 'player_runner' }), 1000);
    addEntry(list, entry({ id: 'tt', mode: 'timeTrial', timeMs: 50000 }), 1000);
    const top = speedRanking(list, 'san-telmo-1', 'normal');
    expect(top).toHaveLength(RECORD_RULES.rankingSize);
    expect(top[0].timeMs).toBe(100000);
    expect(speedRanking(list, 'san-telmo-1', 'timeTrial').map((e) => e.id)).toEqual(['tt']);
    const byChar = bestByCharacter(list, 'san-telmo-1', 'normal');
    expect(byChar.map((e) => e.characterId)).toEqual(['player_runner', 'player_girl']);
  });

  it('récords personales por perfil y por personaje', () => {
    const list: RecordEntry[] = [];
    addEntry(list, entry({ profileId: 'p1', timeMs: 130000, score: 8000 }), 1000);
    addEntry(list, entry({ profileId: 'p1', timeMs: 140000, score: 12000, characterId: 'player_girl' }), 1000);
    addEntry(list, entry({ profileId: 'p2', timeMs: 100000, score: 20000 }), 1000);
    const pb = personalBest(list, 'san-telmo-1', 'normal', 'p1');
    expect(pb.time?.timeMs).toBe(130000);
    expect(pb.score?.score).toBe(12000);
    const girl = profileCharacterBest(list, 'san-telmo-1', 'normal', 'p1', 'player_girl');
    expect(girl.time?.timeMs).toBe(140000);
    expect(profileCharacterBest(list, 'san-telmo-1', 'normal', 'p2', 'player_girl').time).toBeNull();
  });

  it('acota cada tabla sin perder los récords personales', () => {
    const list: RecordEntry[] = [];
    addEntry(list, entry({ profileId: 'lento', timeMs: 900000, score: 1 }), 1000);
    for (let i = 0; i < RECORD_RULES.keepPerBoard + 20; i++) addEntry(list, entry({ profileId: 'rapido', timeMs: 100000 + i, score: 5000 + i }), 1000);
    expect(list.length).toBeLessThanOrEqual(RECORD_RULES.keepPerBoard + 4);
    expect(personalBest(list, 'san-telmo-1', 'normal', 'lento').time?.timeMs).toBe(900000);
  });

  it('descarta datos corruptos al cargar', () => {
    const ok = entry();
    const negative = { ...entry(), timeMs: -9 };
    const loaded = sanitizeEntries([ok, { id: 3 }, null, { ...entry(), mode: 'raro' }, negative, 'x', { ...ok }]);
    expect(loaded.map((e) => e.id)).toEqual([ok.id, negative.id]);
    // Un tiempo imposible no se conserva: queda como partida sin tiempo (sólo puntaje).
    expect(loaded[1].timeMs).toBeNull();
    expect(sanitizeEntries('no')).toEqual([]);
  });
});

describe('Bonus de velocidad', () => {
  const levels = BARRIOS.filter((b) => b.levels.length).flatMap((b) => b.levels.map((_, i) => ({ barrioId: b.id, levelIndex: i })));

  it('cada nivel tiene tiempos excelente < bueno < aceptable, dentro de lo posible', () => {
    for (const ref of levels) {
      const built = buildLevel(ref);
      const t = built.level.timeTargets ?? speedTargets(built.layout);
      expect(t.excellent).toBeLessThan(t.good);
      expect(t.good).toBeLessThan(t.ok);
      expect(t.ok).toBeLessThanOrEqual(Math.round(estimatedDuration(built.layout)));
      // Ni siquiera el "excelente" exige ir más rápido de lo que se puede.
      const fastest = (built.layout.length - built.layout.startX) / 160;
      expect(t.excellent).toBeGreaterThan(fastest);
    }
  });

  it('premios configurados: excelente 2000, bueno 1000, aceptable 500', () => {
    expect(SPEED_BONUS.points).toEqual({ excellent: 2000, good: 1000, ok: 500 });
  });
});
