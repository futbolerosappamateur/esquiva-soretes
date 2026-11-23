import { describe, expect, it } from 'vitest';
import { dayInfo, parseHourParam, seasonOf, sunTimes } from '../src/graphics/daylight';

const day = (m: number, d: number) => new Date(2026, m - 1, d, 12, 0);

describe('Luz según la hora (prototipo)', () => {
  it('las estaciones son las del hemisferio sur (el 21 de septiembre empieza la primavera)', () => {
    expect(seasonOf(day(9, 20))).toBe('invierno');
    expect(seasonOf(day(9, 21))).toBe('primavera');
    expect(seasonOf(day(12, 21))).toBe('verano');
    expect(seasonOf(day(1, 15))).toBe('verano');
    expect(seasonOf(day(3, 21))).toBe('otoño');
    expect(seasonOf(day(6, 21))).toBe('invierno');
  });

  it('en verano el sol se pone pasadas las 20 y en invierno antes de las 18', () => {
    const summer = sunTimes(day(12, 21));
    const winter = sunTimes(day(6, 21));
    expect(summer.sunset).toBeGreaterThan(20);
    expect(summer.sunrise).toBeLessThan(6);
    expect(winter.sunset).toBeLessThan(18.1);
    expect(winter.sunrise).toBeGreaterThan(7.8);
    const equinox = sunTimes(day(3, 21));
    expect(Math.abs(equinox.sunrise - 6.9)).toBeLessThan(0.4);
  });

  it('a las 19:30 en verano todavía es de día; en invierno ya es de noche', () => {
    expect(dayInfo(19.5, day(1, 10)).night).toBe(false);
    expect(dayInfo(19.5, day(7, 10)).night).toBe(true);
    expect(dayInfo(3, day(1, 10)).night).toBe(true);
    expect(dayInfo(23, day(1, 10)).phase).toBe('NOCHE');
  });

  it('el mediodía es luminoso y sin tinte; el atardecer, naranja y más oscuro', () => {
    const noon = dayInfo(13, day(10, 1)).light;
    expect(noon.brightness).toBeGreaterThanOrEqual(1);
    expect(Math.abs(noon.r - noon.b)).toBeLessThan(0.05);
    const info = dayInfo(sunTimes(day(10, 1)).sunset, day(10, 1));
    expect(info.phase).toBe('ATARDECER');
    expect(info.light.r).toBeGreaterThan(info.light.b + 0.3);
    expect(info.light.brightness).toBeLessThan(0.9);
  });

  it('la luz cambia de a poco: sin saltos en todo el día', () => {
    for (const date of [day(1, 10), day(4, 10), day(7, 10), day(10, 10)]) {
      let prev = dayInfo(0, date).light;
      for (let h = 0.01; h < 24; h += 0.01) {
        const l = dayInfo(h, date).light;
        for (const k of ['r', 'g', 'b', 'saturation', 'brightness'] as const) expect(Math.abs(l[k] - prev[k])).toBeLessThan(0.02);
        prev = l;
      }
    }
  });

  it('?hora= entiende 19:30, 7 y real; lo demás se ignora', () => {
    const now = new Date(2026, 10, 22, 18, 45);
    expect(parseHourParam('19:30', now)?.hour).toBe(19.5);
    expect(parseHourParam('7', now)?.hour).toBe(7);
    expect(parseHourParam('real', now)?.hour).toBe(18.75);
    expect(parseHourParam('25:00', now)).toBeNull();
    expect(parseHourParam('tarde', now)).toBeNull();
    expect(parseHourParam(null, now)).toBeNull();
  });
});
