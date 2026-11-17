/**
 * Constantes estructurales del juego: resolución interna, claves de escenas,
 * distribución vertical de la calle y capas de profundidad.
 */

/** Resolución interna (16:9). Se escala sin deformar para cualquier pantalla. */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

export const SCENES = {
  BOOT: 'Boot',
  MENU: 'Menu',
  HOW_TO: 'HowToPlay',
  OPTIONS: 'Options',
  GAME: 'Game',
  HUD: 'Hud',
  PAUSE: 'Pause',
  GAME_OVER: 'GameOver',
  LEVEL_COMPLETE: 'LevelComplete',
  WORLD_MAP: 'WorldMap',
  BARRIO: 'Barrio',
  CHARACTER: 'CharacterSelect',
  BARRIO_COMPLETE: 'BarrioComplete',
  RECORDS: 'Records',
} as const;

/**
 * Distribución vertical de la calle (en píxeles internos).
 *
 * El eje Y del suelo representa PROFUNDIDAD dentro de la vereda:
 * valores chicos = cerca de las fachadas (fondo), valores grandes = cerca del cordón.
 * El salto es una altura (z) independiente que sólo desplaza el dibujo hacia arriba.
 */
export const LAYOUT = {
  facadeBaseY: 128,
  sidewalkTop: 128,
  sidewalkBottom: 214,
  /** Límite de los pies hacia el fondo de la vereda. */
  walkMinY: 140,
  /** Límite de los pies hacia el cordón. */
  walkMaxY: 208,
  curbTop: 214,
  curbHeight: 6,
  streetTop: 220,
  /** Base de las ruedas de los autos estacionados. */
  carBaseY: 262,
  /** Carril de los peatones decorativos (detrás de la zona jugable). */
  npcLaneY: 135,
  /** Línea donde se plantan árboles, faroles y carteles (junto al cordón). */
  propFrontY: 209,
  /** Tamaño de cada baldosa en perspectiva. */
  tileW: 16,
  tileH: 8,
} as const;

/** Capas de dibujo. Las entidades usan su Y de suelo como profundidad (≈128..270). */
export const DEPTH = {
  sky: -1000,
  clouds: -990,
  skyline: -980,
  facades: -900,
  facadeDecor: -890,
  ground: -800,
  groundOverlay: -790,
  groundDecal: -700,
  shadow: -600,
  foreground: 900,
  effects: 1000,
  floatingText: 1100,
  overlay: 2000,
} as const;
