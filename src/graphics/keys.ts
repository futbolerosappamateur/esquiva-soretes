/**
 * Claves de texturas y frames. Mantenerlas centralizadas permite reemplazar
 * los gráficos provisionales por sprites definitivos sin tocar la lógica:
 * basta con cargar imágenes con estas mismas claves y nombres de frame.
 */
export const TEX = {
  /** Hoja del protagonista según cuántas zapatillas están sucias (0, 1 o 2). */
  player: (dirt: number) => `player-${dirt}`,
  playerHead: 'player-head',

  poops: 'poops',
  looseTile: 'loose-tile',
  leafPile: 'leaf-pile',
  leafCover: 'leaf-cover',

  sky: 'sky',
  clouds: 'clouds',
  skyline: 'skyline',
  sidewalk: 'sidewalk',
  wallShadow: 'wall-shadow',
  curb: 'curb',
  street: 'street',
  crossStreet: 'cross-street',
  decals: 'decals',

  facade: (id: string) => `facade-${id}`,

  props: 'props',
  tree: (n: number) => `tree-${n}`,
  lamp: 'lamp',
  newsKiosk: 'news-kiosk',
  cornerSign: (street: string) => `corner-sign-${street}`,
  car: (n: number) => `car-${n}`,
  container: 'container',

  pigeon: 'pigeon',
  npcWalker: 'npc-walker',
  npcDog: (n: number) => `npc-dog-${n}`,
  npcLady: 'npc-lady',
  npcTourist: 'npc-tourist',

  fx: 'fx',
  stink: 'fx-stink',
  fly: 'fx-fly',
  plaf: 'fx-plaf',

  ui: 'ui',
  logo: 'logo',
  mascot: 'mascot',
} as const;

/** Nombres de frames dentro de la hoja de soretes. */
export const POOP_FRAMES = {
  pile: 'pile',
  log: 'log',
  nuggets: 'nuggets',
  squash: 'squash',
  giant: 'giant',
  giantSquash: 'giant-squash',
  camo: 'camo',
} as const;

/** Frames de la hoja de efectos. */
export const FX_FRAMES = {
  dust: 'dust',
  dustSmall: 'dust-small',
  drop: 'drop',
  chunk: 'chunk',
  spark: 'spark',
  confetti: 'confetti',
  shadow: 'shadow',
  exclaim: 'exclaim',
  leaf: 'leaf',
} as const;

/** Frames de la hoja de interfaz. */
export const UI_FRAMES = {
  sneakerClean: 'sneaker-clean',
  sneakerDirty: 'sneaker-dirty',
  joyBase: 'joy-base',
  joyKnob: 'joy-knob',
  jump: 'jump',
  jumpDown: 'jump-down',
  pause: 'pause',
  cursor: 'cursor',
  flag: 'flag',
  fullscreen: 'fullscreen',
} as const;

/** Frames de la hoja de props de vereda. */
export const PROP_FRAMES = {
  bin: 'bin',
  busStop: 'bus-stop',
  cafeTable: 'cafe-table',
  treePit: 'tree-pit',
  rootTiles: 'root-tiles',
  bags: 'bags',
} as const;
