import type Phaser from 'phaser';

/**
 * Luz según la hora y la estación (prototipo de "jugar en la hora real": se
 * prueba con ?hora=19:30 o ?hora=real). Un filtro de color sobre la escena
 * acompaña al sol de Buenos Aires: amanecer rosado, mañana neutra, mediodía
 * luminoso, tarde dorada, atardecer naranja y noche. En verano el sol sale
 * cerca de las 5:40 y se pone pasadas las 20; en invierno sale a las 8 y se
 * pone antes de las 18 (aproximado con un coseno; Buenos Aires no cambia la
 * hora en el año).
 */
export type Season = 'verano' | 'otoño' | 'invierno' | 'primavera';

export interface Daylight {
  /** Multiplicadores de rojo, verde y azul (1 = sin cambio). */
  r: number;
  g: number;
  b: number;
  /** Saturación y brillo (1 = sin cambio). */
  saturation: number;
  brightness: number;
}

export interface DayInfo {
  hour: number;
  season: Season;
  sunrise: number;
  sunset: number;
  /** Es de noche: se usa la ambientación de noche (ventanas prendidas, faroles). */
  night: boolean;
  /** Momento del día, para mostrar. */
  phase: 'NOCHE' | 'AMANECER' | 'MAÑANA' | 'MEDIODÍA' | 'TARDE' | 'ATARDECER';
  light: Daylight;
}

// De noche el filtro es suave: la ambientación de noche ya oscurece todo.
const NIGHT: Daylight = { r: 0.92, g: 0.95, b: 1.06, saturation: 0.88, brightness: 0.94 };
const DAWN: Daylight = { r: 1.08, g: 0.86, b: 0.9, saturation: 0.92, brightness: 0.86 };
const MORNING: Daylight = { r: 0.99, g: 1, b: 1.02, saturation: 1, brightness: 1 };
const NOON: Daylight = { r: 1.02, g: 1.02, b: 1, saturation: 1.06, brightness: 1.06 };
const GOLDEN: Daylight = { r: 1.09, g: 0.97, b: 0.82, saturation: 1.1, brightness: 1.02 };
const DUSK: Daylight = { r: 1.14, g: 0.8, b: 0.74, saturation: 1.05, brightness: 0.82 };

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000) + 1;
}

/** Hora (decimal) a la que sale y se pone el sol en Buenos Aires ese día. */
export function sunTimes(date: Date): { sunrise: number; sunset: number } {
  // Pico del invierno cerca del 21 de junio (día 172).
  const c = Math.cos((2 * Math.PI * (dayOfYear(date) - 172)) / 365);
  return { sunrise: 6.85 + 1.15 * c, sunset: 19 - 1.1 * c };
}

/** Estación en el hemisferio sur (el 21 de septiembre empieza la primavera). */
export function seasonOf(date: Date): Season {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const md = m * 100 + d;
  if (md >= 1221 || md < 321) return 'verano';
  if (md < 621) return 'otoño';
  if (md < 921) return 'invierno';
  return 'primavera';
}

const mix = (a: Daylight, b: Daylight, t: number): Daylight => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
  saturation: a.saturation + (b.saturation - a.saturation) * t,
  brightness: a.brightness + (b.brightness - a.brightness) * t,
});

/** La luz, el momento del día y la estación para una hora (decimal) de una fecha. */
export function dayInfo(hour: number, date: Date): DayInfo {
  const { sunrise, sunset } = sunTimes(date);
  const noon = (sunrise + sunset) / 2;
  const keys: [number, Daylight][] = [
    [sunrise - 0.75, NIGHT],
    [sunrise, DAWN],
    [sunrise + 1.5, MORNING],
    [noon, NOON],
    [sunset - 2, GOLDEN],
    [sunset, DUSK],
    [sunset + 0.75, NIGHT],
  ];
  let light = NIGHT;
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, l0] = keys[i];
    const [h1, l1] = keys[i + 1];
    if (hour >= h0 && hour < h1) {
      light = mix(l0, l1, (hour - h0) / (h1 - h0));
      break;
    }
  }
  const night = hour < sunrise - 0.25 || hour > sunset + 0.4;
  const phase: DayInfo['phase'] = night
    ? 'NOCHE'
    : hour < sunrise + 1
      ? 'AMANECER'
      : hour < noon - 1.5
        ? 'MAÑANA'
        : hour < noon + 1.5
          ? 'MEDIODÍA'
          : hour < sunset - 0.75
            ? 'TARDE'
            : 'ATARDECER';
  return { hour, season: seasonOf(date), sunrise, sunset, night, phase, light };
}

/** ?hora=19:30 (hoy a esa hora) o ?hora=real (la hora de la compu). null si no se pidió o no se entiende. */
export function parseHourParam(value: string | null, now: Date = new Date()): DayInfo | null {
  if (!value) return null;
  if (value === 'real') return dayInfo(now.getHours() + now.getMinutes() / 60, now);
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return dayInfo(h + min / 60, now);
}

/** Pone el filtro de luz sobre una cámara (sólo con placa de video; si no, no hace nada). */
export function applyDaylight(camera: Phaser.Cameras.Scene2D.Camera, light: Daylight): void {
  const fx = camera.postFX?.addColorMatrix();
  if (!fx) return;
  fx.set([light.r, 0, 0, 0, 0, 0, light.g, 0, 0, 0, 0, 0, light.b, 0, 0, 0, 0, 0, 1, 0]);
  fx.saturate(light.saturation - 1, true);
  fx.brightness(light.brightness, true);
}
