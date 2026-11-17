/**
 * Paleta base del juego (estilo 16 bits, colores cálidos).
 * Los valores son strings CSS para dibujar en canvas; para tintes de Phaser
 * usar `hexToInt` de graphics/color.ts o las constantes de UI_COLORS.
 */
export const PAL = {
  outline: '#21142b',
  outlineSoft: '#3b2741',
  black: '#120c18',
  white: '#ffffff',
  cream: '#fff4d6',

  // Interfaz
  uiYellow: '#ffd23f',
  uiOrange: '#ff8a1f',
  uiRed: '#e8433a',
  uiGreen: '#5fd068',
  uiCeleste: '#7ccaf2',
  uiBlue: '#3c7fd9',
  uiPurple: '#3b2741',
  uiPanel: '#2a1d33',
  uiPanelLight: '#4a3657',

  // Soretes
  poopDark: '#3a200f',
  poop: '#663a1b',
  poopMid: '#87501f',
  poopLight: '#a86d34',
  poopShine: '#dcae78',

  // Vereda y calle
  tile: '#d4c7a4',
  tileLight: '#e2d7b8',
  tileDark: '#b9ab87',
  grout: '#9d8f71',
  curbTop: '#cfcac0',
  curbFace: '#8f8a82',
  curbShadow: '#5d5852',
  cobble: '#8a8178',
  cobbleLight: '#a39a8f',
  cobbleDark: '#5f5750',
  cobbleGap: '#3f3934',

  // Vegetación
  leafDark: '#2f6b35',
  leaf: '#46913f',
  leafLight: '#71b84e',
  leafShine: '#a7d96a',
  bark: '#7d6b52',
  barkLight: '#a8977a',
  barkDark: '#4f4232',
  soil: '#4b3626',
  soilDark: '#33241a',

  // Hojas secas
  dryLeaf1: '#c9772b',
  dryLeaf2: '#e3a13a',
  dryLeaf3: '#9e4f22',
  dryLeaf4: '#d9b14a',

  // Cielo
  skyTop: '#62b4ec',
  skyMid: '#86c8f1',
  skyLow: '#b2ddf5',
  skyHorizon: '#d8eef7',
  skylineFar: '#a9c2d8',
  skylineNear: '#8ea9c4',
  skylineWindow: '#c4d6e6',
} as const;

/** Colores numéricos para tintes de texto e interfaz en Phaser. */
export const UI_COLORS = {
  white: 0xffffff,
  cream: 0xfff4d6,
  yellow: 0xffd23f,
  orange: 0xff8a1f,
  red: 0xff5a4e,
  green: 0x6fe07a,
  celeste: 0x8fd6ff,
  brown: 0xc98a4b,
  gray: 0xa99cb3,
  dark: 0x21142b,
  panel: 0x2a1d33,
} as const;
