/**
 * Manifiesto de gráficos definitivos.
 *
 * Hoy está vacío: todos los gráficos son provisionales y se generan por
 * código. Cuando lleguen las ilustraciones, alcanza con agregar entradas acá
 * (con la MISMA clave de textura y los mismos nombres de frame que usa el
 * juego, ver graphics/keys.ts) y copiar los archivos a /public/assets.
 * BootScene los carga y reemplaza al gráfico provisional; la lógica no cambia.
 *
 * Formatos admitidos (PNG con fondo transparente):
 *  - image:       una imagen suelta (fachadas, autos, etc.).
 *  - spritesheet: grilla de cuadros iguales; `frames` les pone nombre en orden
 *                 ('idle0', 'idle1', 'walk0'...) para que coincidan con el juego.
 *  - atlas:       atlas de TexturePacker/Aseprite (JSON hash) con frames con nombre.
 *
 * `origin` es el punto de apoyo del sprite (fracción del cuadro): para los
 * personajes es el punto entre los pies, así todos se paran en el mismo lugar.
 *
 * Personajes: para dar arte propio a un look (ver graphics/characterLooks.ts)
 * se cargan sus hojas con las claves `char-<look>-0`, `char-<look>-1` y
 * `char-<look>-2` (zapatillas limpias, una sucia, dos sucias). Opcionalmente,
 * `char-<look>-portrait`: la ilustración grande para la selección de personaje.
 */
import { detectArtScale } from '../graphics/renderScaleDetect';

export interface Origin {
  x: number;
  y: number;
}

export interface AnimDef {
  key: string;
  frames: string[];
  frameRate: number;
  repeat?: number;
}

interface BaseEntry {
  key: string;
  url: string;
  origin?: Origin;
  /** Dibujo con sombreado suave (ilustración): se filtra suave en vez de por píxeles. */
  smooth?: boolean;
  /**
   * Dibujo en alta resolución: cuántas unidades del juego ocupa cada píxel de
   * la imagen (por ejemplo, 0,25 para un dibujo hecho a 4 píxeles por unidad).
   * Quien lo muestre usa fitToTexture (ver graphics/renderScale.ts).
   */
  displayScale?: number;
  /** Animaciones extra (o reemplazos) definidas sobre esta textura. */
  anims?: AnimDef[];
}

export type AssetEntry =
  | (BaseEntry & { kind: 'image' })
  | (BaseEntry & { kind: 'spritesheet'; frameWidth: number; frameHeight: number; frames?: string[] })
  | (BaseEntry & { kind: 'atlas'; atlasUrl: string });

/**
 * Hojas de un personaje convertidas con scripts/sprites/convert-sheet.mjs (atlas
 * con los nombres de cuadro del juego). Si se generaron en varios detalles
 * ("renderScales" en la configuración), se descarga el que necesita este
 * equipo: `scales` dice cuáles hay.
 */
const characterArt = (look: string, scales?: number[]): AssetEntry[] => {
  const suffix = scales ? `@${detectArtScale(scales)}` : '';
  return [0, 1, 2].map((d) => ({
    kind: 'atlas' as const,
    key: `char-${look}-${d}`,
    url: `assets/characters/${look}-${d}${suffix}.png`,
    atlasUrl: `assets/characters/${look}-${d}${suffix}.json`,
    origin: { x: 0.5, y: 47 / 48 },
  }));
};

/** Retrato de un personaje (ilustración grande, a su resolución original): ver portraitKey. */
const characterPortrait = (look: string): AssetEntry => ({
  kind: 'image',
  key: portraitKey(look),
  url: `assets/characters/${look}-portrait.png`,
  origin: { x: 0.5, y: 1 },
  smooth: true,
});

/** Clave de la textura del retrato de un look. */
export function portraitKey(look: string): string {
  return `char-${look}-portrait`;
}

/** Alto (unidades del juego) del logo animado de la portada; cada cuadro mide 418 px. */
const LOGO_UNITS = 104;
const LOGO_FRAMES = Array.from({ length: 9 }, (_, i) => 'f' + i);

export const ASSET_MANIFEST: AssetEntry[] = [
  // Logo de la portada, de plastilina y animado (art/source/logo.gif → npm run logo).
  {
    kind: 'spritesheet',
    key: 'logo-art',
    url: 'assets/ui/logo.png',
    frameWidth: 418,
    frameHeight: 418,
    frames: LOGO_FRAMES,
    smooth: true,
    displayScale: LOGO_UNITS / 418,
    // 9 cuadros de 140 ms, como el GIF original.
    anims: [{ key: 'logo-art-anim', frames: LOGO_FRAMES, frameRate: 1000 / 140, repeat: -1 }],
  },
  // El Pibe de la Gorra, de plastilina (estética definitiva): art/source/pibe-plastilina-*.png.
  ...characterArt('pibe', [4, 6]),
  characterPortrait('pibe'),
  // Ejemplos (descomentar cuando existan los archivos):
  // { kind: 'atlas', key: 'char-pibe-0', url: 'assets/characters/pibe-0.png', atlasUrl: 'assets/characters/pibe-0.json', origin: { x: 0.5, y: 47 / 48 } },
  // { kind: 'image', key: 'facade-casa-rosa', url: 'assets/facades/casa-rosa.png', origin: { x: 0, y: 1 } },
  // { kind: 'spritesheet', key: 'poops', url: 'assets/poops.png', frameWidth: 32, frameHeight: 32, frames: ['pile', 'log', 'nuggets', 'squash', 'giant', 'giant-squash', 'camo'] },
];

/** Prefijo temporal con el que se cargan los archivos antes de reemplazar al provisional. */
export const MANIFEST_PREFIX = 'manifest:';

const origins = new Map<string, Origin>(ASSET_MANIFEST.filter((e) => e.origin).map((e) => [e.key, e.origin!]));

/** Origen declarado para una textura (o el que use el gráfico provisional). */
export function originFor(key: string, fallback: Origin): Origin {
  return origins.get(key) ?? fallback;
}
