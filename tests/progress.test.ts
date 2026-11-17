import { describe, expect, it } from 'vitest';
import {
  applyLevelResult,
  barrioProgressPercent,
  createDefaultSave,
  creditCoins,
  isBarrioUnlocked,
  isLevelUnlocked,
  levelProgress,
  migrateSave,
  pendingUnlocks,
  spendCoins,
} from '../src/core/progress';
import { createRun, runFromCheckpoint, takeUnbankedCoins } from '../src/core/RunState';
import { BARRIOS, getBarrio } from '../src/data/campaign';
import { STARTER_CHARACTERS } from '../src/data/characters';
import { ScoreSystem } from '../src/systems/ScoreSystem';

const ST = { barrioId: 'san-telmo', levelIndex: 0 };

describe('Progreso de la campaña', () => {
  it('arranca con San Telmo desbloqueado y Monserrat bloqueado', () => {
    const s = createDefaultSave();
    expect(isBarrioUnlocked(s, 'san-telmo')).toBe(true);
    expect(isBarrioUnlocked(s, 'monserrat')).toBe(false);
    expect(isLevelUnlocked(s, ST)).toBe(true);
    expect(isLevelUnlocked(s, { barrioId: 'san-telmo', levelIndex: 1 })).toBe(false);
    expect(s.unlocks.characters).toEqual(STARTER_CHARACTERS);
  });

  it('completar los tres niveles de San Telmo desbloquea Monserrat (con una estrella alcanza)', () => {
    const s = createDefaultSave();
    const r1 = applyLevelResult(s, ST, { score: 1000, stars: 1 });
    expect(r1.firstCompletion).toBe(true);
    expect(isLevelUnlocked(s, { barrioId: 'san-telmo', levelIndex: 1 })).toBe(true);
    applyLevelResult(s, { barrioId: 'san-telmo', levelIndex: 1 }, { score: 1000, stars: 1 });
    expect(isBarrioUnlocked(s, 'monserrat')).toBe(false);
    const r3 = applyLevelResult(s, { barrioId: 'san-telmo', levelIndex: 2 }, { score: 1000, stars: 1 });
    expect(r3.barrioCompleted).toBe(true);
    expect(r3.unlockedBarrio).toBe('monserrat');
    expect(isBarrioUnlocked(s, 'monserrat')).toBe(true);
    expect(pendingUnlocks(s)).toEqual(['monserrat']);
    // Repetir un nivel no vuelve a "desbloquear" ni baja las estrellas.
    const again = applyLevelResult(s, ST, { score: 500, stars: 1 });
    expect(again.unlockedBarrio).toBeNull();
    expect(again.barrioCompleted).toBe(false);
  });

  it('las estrellas y el récord del nivel nunca bajan', () => {
    const s = createDefaultSave();
    applyLevelResult(s, ST, { score: 9000, stars: 3 });
    const r = applyLevelResult(s, ST, { score: 4000, stars: 1 });
    expect(r.newStars).toBe(0);
    expect(r.newRecord).toBe(false);
    const lp = levelProgress(s, 'san-telmo-1');
    expect(lp.stars).toBe(3);
    expect(lp.bestScore).toBe(9000);
    expect(lp.plays).toBe(2);
    expect(barrioProgressPercent(s, getBarrio('san-telmo')!)).toBe(33);
  });

  it('monedas: se acreditan y se gastan sin quedar en negativo', () => {
    const s = createDefaultSave();
    creditCoins(s, 30);
    expect(spendCoins(s, 50)).toBe(false);
    expect(spendCoins(s, 20)).toBe(true);
    expect(s.wallet).toEqual({ coins: 10, totalEarned: 30 });
  });
});

describe('Migración del guardado', () => {
  it('sin datos (o datos de la v0.1) crea un progreso nuevo', () => {
    expect(migrateSave(null)).toEqual(createDefaultSave());
    expect(migrateSave({ bestScore: 999 })).toEqual(createDefaultSave());
  });

  it('rescata datos válidos y descarta los corruptos', () => {
    const raw = {
      version: 2,
      barrios: {
        'san-telmo': { unlocked: true, completed: true, levels: { 'san-telmo-1': { completed: true, stars: 7, bestScore: -5, plays: 'x' } } },
        inventado: { unlocked: true },
      },
      wallet: { coins: 42.7, totalEarned: 'muchas' },
      selectedCharacter: 'player_portero',
      seenUnlocks: ['san-telmo', 'barrio-falso'],
    };
    const s = migrateSave(raw);
    expect(s.barrios.inventado).toBeUndefined();
    expect(levelProgress(s, 'san-telmo-1')).toEqual({ completed: true, stars: 3, bestScore: 0, plays: 0 });
    // Un barrio completo desbloquea el siguiente aunque ese dato se haya perdido.
    expect(isBarrioUnlocked(s, 'monserrat')).toBe(true);
    expect(s.wallet.coins).toBe(42);
    expect(s.wallet.totalEarned).toBe(0);
    // No se puede elegir un personaje que no está desbloqueado.
    expect(s.selectedCharacter).toBe('player_default');
    expect(s.seenUnlocks).toEqual(['san-telmo']);
  });

  it('la campaña tiene San Telmo y Monserrat jugables con 3 niveles de 5 cuadras', () => {
    for (const id of ['san-telmo', 'monserrat']) {
      const b = getBarrio(id)!;
      expect(b.levels).toHaveLength(3);
      for (const l of b.levels) expect(l.blocks).toHaveLength(5);
    }
    expect(BARRIOS.filter((b) => b.levels.length > 0).map((b) => b.id)).toEqual(['san-telmo', 'monserrat']);
  });
});

describe('Checkpoints y monedas', () => {
  it('reintentar desde el checkpoint restaura puntaje y monedas sin duplicar nada', () => {
    const run = createRun(ST);
    const score = new ScoreSystem(0);
    score.updateDistance(4000);
    score.addBonus(1000);
    run.coins = 12;
    expect(takeUnbankedCoins(run)).toBe(12); // se acreditan al llegar a la esquina
    run.checkpoint = { blocksCompleted: 1, x: 3700, y: 180, score: score.toSnapshot(), coins: run.coins, crossingsDone: 0, missionDone: false, carHits: 0 };
    // Después del checkpoint juega un poco más y pierde.
    run.coins = 20;
    run.lives = 0;
    run.lifeMarks = ['poop', 'car', 'poop'];
    const retry = runFromCheckpoint(run);
    expect(retry.lives).toBe(3);
    expect(retry.lifeMarks).toEqual([]);
    expect(retry.coins).toBe(12);
    // Las monedas perdidas después del checkpoint no se acreditan; las de antes ya estaban acreditadas.
    expect(takeUnbankedCoins(retry)).toBe(0);
    expect(retry.continues).toBe(1);
    // El puntaje retoma exactamente desde la esquina (con los metros ya cobrados).
    const restored = new ScoreSystem(retry.checkpoint!.score);
    expect(restored.score).toBe(score.score);
    expect(restored.updateDistance(4000)).toBe(0);
  });

  it('repetir una misión desde el checkpoint no da monedas infinitas', () => {
    const run = createRun(ST);
    run.checkpoint = { blocksCompleted: 1, x: 3700, y: 180, score: new ScoreSystem(0).toSnapshot(), coins: 0, crossingsDone: 0, missionDone: false, carHits: 0 };
    let wallet = 0;
    // Tres intentos: en cada uno completa la misión (+21 monedas) y pierde antes de la siguiente esquina.
    let current = run;
    for (let attempt = 0; attempt < 3; attempt++) {
      current = runFromCheckpoint(current);
      current.coins += 21;
      current.lives = 0;
    }
    // Sólo se acredita al llegar a una esquina: el intento final que sí llega acredita una vez.
    current = runFromCheckpoint(current);
    current.coins += 21;
    wallet += takeUnbankedCoins(current);
    expect(wallet).toBe(21);
  });
});
