import { describe, expect, it } from 'vitest';
import { RECORD_RULES } from '../../src/config/balance';
import { CHARACTERS, isPlayable } from '../../src/data/characters';
import { AVATARS } from '../../src/social/avatars';
import { computeGameRules, computeLevelRules, renderRulesSql } from '../../src/social/rules/gameRules';
import { migrations } from './pgliteSupabase';

/**
 * Las reglas que usa el servidor para validar partidas salen del código del
 * juego. Si se cambia un nivel (o un personaje, un logro, un avatar), esta
 * prueba avisa que hay que generar la migración nueva.
 */
describe('reglas del servidor', () => {
  it('la última migración de reglas coincide con el juego actual', () => {
    const rules = migrations().filter(([name]) => name.endsWith('_game_rules.sql'));
    expect(rules.length).toBeGreaterThan(0);
    const latest = rules[rules.length - 1][1].replace(/\r\n/g, '\n');
    // Si falla: correr `npm run online:rules` y aplicar la migración nueva en Supabase.
    expect(latest).toBe(renderRulesSql());
  });

  it('límites razonables: un nivel no se puede terminar más rápido que a la velocidad máxima', () => {
    for (const l of computeLevelRules()) {
      expect(l.minTimeMs).toBeGreaterThan(30_000);
      // El tiempo "excelente" del bonus siempre es alcanzable (más lento que el mínimo).
      expect(l.timeExcellentS * 1000).toBeGreaterThan(l.minTimeMs);
      expect(l.maxScore).toBe(l.maxDistancePoints + l.maxDodgePoints + l.maxBonusPoints);
      // Las estrellas se pueden conseguir sin pasar el máximo.
      expect(l.starsThree).toBeLessThan(l.maxScore);
    }
    expect(RECORD_RULES.maxPlausibleSpeed).toBeGreaterThan(200);
  });

  it('personajes, avatares y versión estable', () => {
    const data = computeGameRules();
    expect(data.characters.filter((c) => c.playable).map((c) => c.id)).toEqual(CHARACTERS.filter(isPlayable).map((c) => c.id));
    expect(data.avatars.map((a) => a.id)).toEqual(AVATARS.map((a) => a.id));
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length);
    expect(computeGameRules().version).toBe(data.version);
  });
});
