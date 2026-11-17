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

  // --- v0.2 ---------------------------------------------------------------
  /** Calzada transversal de los cruces (con senda peatonal). */
  crossingRoad: 'crossing-road',
  signals: 'signals',
  hudSignal: 'hud-signal',
  glow: 'fx-glow',
  /** Íconos de interfaz (monedas, estrellas, candados, etc.). */
  icons: 'icons',
  coin: 'coin',
  litter: 'litter',
  /** Variantes de ambientación. */
  skyNight: 'sky-night',
  skyDusk: 'sky-dusk',
  skyOvercast: 'sky-overcast',
  skylineNight: 'skyline-night',
  treeAutumn: (n: number) => `tree-autumn-${n}`,
  treeBare: (n: number) => `tree-bare-${n}`,
  facadeNight: (id: string) => `facade-night-${id}`,
  lampLit: 'lamp-lit',
  /** NPC con comportamientos (portero, señora regando...). */
  npc: (id: string) => `npc-${id}`,
  /** Vista previa de cada personaje para la pantalla de selección. */
  characterPreview: (id: string) => `character-preview-${id}`,
  mapBase: 'world-map',
  mapToken: 'map-token',
} as const;

/** Frames de la hoja de íconos de interfaz. */
export const ICON_FRAMES = {
  coin: 'coin',
  star: 'star',
  starEmpty: 'star-empty',
  starSmall: 'star-small',
  starSmallEmpty: 'star-small-empty',
  lock: 'lock',
  check: 'check',
  badge: 'badge',
  trash: 'trash',
  arrowDown: 'arrow-down',
  sneakerFlat: 'sneaker-flat',
  sun: 'sun',
  moon: 'moon',
  leaf: 'leaf',
  plus: 'plus',
  minus: 'minus',
  back: 'back',
  flag: 'flag',
  paw: 'paw',
  puddle: 'puddle',
  clock: 'clock',
  trophy: 'trophy',
  abDash: 'ab-dash',
  abDoubleJump: 'ab-double-jump',
  abTurbo: 'ab-turbo',
  abSprint: 'ab-sprint',
  abBroom: 'ab-broom',
  abHose: 'ab-hose',
  abSniff: 'ab-sniff',
  abWhistle: 'ab-whistle',
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

/** Calcomanías decorativas del piso. */
export const DECAL_FRAMES = ['crack1', 'crack2', 'stain1', 'stain2', 'gum', 'cover', 'patch', 'paper', 'butt'] as const;

/** Razas de los perros del paseador. */
export type DogKind = 'small' | 'medium' | 'big' | 'sausage';
export const DOG_KINDS: DogKind[] = ['small', 'medium', 'big', 'sausage'];
