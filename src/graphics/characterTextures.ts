import Phaser from 'phaser';
import { aliasTexture, applySmoothFilter } from '../assets/AssetLoader';
import { getCharacter } from '../data/characters';
import { ANIM, createPlayerAnimations } from './animations';
import { getLook } from './characterLooks';
import { TEX } from './keys';
import { buildSheet, PixelCanvas } from './PixelCanvas';
import { displayScaleOf } from './renderScale';
import { generatePlayerTextures, PLAYER_POSES, renderPose } from './textures/playerTextures';

/**
 * Gráficos del personaje elegido. Las hojas del jugador ('player-0..2') se
 * regeneran sólo cuando cambia el personaje, y las animaciones se recrean
 * porque apuntan a esas hojas.
 *
 * Si el look tiene arte definitivo (hojas char-<look>-0..2 declaradas en
 * assets/manifest.ts) se usa ese; si no, el provisional dibujado por código.
 */
let applied: { look: string; definitive: boolean } | null = null;

/** ¿Hay arte definitivo cargado para este look (las tres hojas de suciedad)? */
export function hasDefinitiveArt(textures: Phaser.Textures.TextureManager, lookId: string): boolean {
  return [0, 1, 2].every((d) => textures.exists(`char-${lookId}-${d}`));
}

export function applyPlayerCharacter(scene: Phaser.Scene, characterId: string): void {
  const look = getLook(getCharacter(characterId).lookId);
  const definitive = hasDefinitiveArt(scene.textures, look.id);
  if (applied?.look === look.id && applied.definitive === definitive && scene.textures.exists(TEX.player(0))) return;
  if (definitive) {
    [0, 1, 2].forEach((d) => aliasTexture(scene.textures, `char-${look.id}-${d}`, TEX.player(d)));
    buildHeadFromArt(scene.textures, `char-${look.id}-0`);
  } else {
    generatePlayerTextures(scene.textures, look);
  }
  createPlayerAnimations(scene.anims, scene.textures);
  applied = { look: look.id, definitive };
}

/** Copia un cuadro de una textura cargada a un lienzo (para recortarlo o analizarlo). */
export function frameCanvas(textures: Phaser.Textures.TextureManager, key: string, frame: string): PixelCanvas | null {
  if (!textures.exists(key)) return null;
  const tex = textures.get(key);
  if (!tex.has(frame)) return null;
  const f = tex.get(frame);
  const pc = new PixelCanvas(f.cutWidth, f.cutHeight);
  pc.ctx.drawImage(tex.getSourceImage() as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
  return pc;
}

/** Parte de arriba del dibujo que se toma como cabeza (gorra y cara; en los personajes cabezones, casi la mitad). */
const HEAD_FRACTION = 0.47;
/** Lado de la cabecita en unidades del juego. */
const HEAD_UNITS = 18;

/**
 * Cabecita de la barra de progreso (y del mapa) recortada del arte definitivo:
 * busca la cabeza en el cuadro de reposo, la encuadra entera (con visera y
 * todo, sea cual sea la proporción del dibujo) y difumina el corte del cuello.
 */
function buildHeadFromArt(textures: Phaser.Textures.TextureManager, key: string): void {
  const src = frameCanvas(textures, key, 'idle0');
  if (!src) return;
  // Un dibujo con más detalle da una cabecita con más detalle (que se muestra más chica).
  const scale = displayScaleOf(textures.get(key));
  const size = Math.round(HEAD_UNITS / scale);
  const { width: w, height: h } = src;
  const px = src.ctx.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) => px[(y * w + x) * 4 + 3] > 40;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (top < 0) top = y;
      bottom = y;
      break;
    }
  }
  if (top < 0) return;
  // Caja de la cabeza: lo dibujado en la parte de arriba de la figura.
  const headBottom = top + Math.round((bottom - top + 1) * HEAD_FRACTION);
  let x0 = w;
  let x1 = -1;
  for (let y = top; y <= headBottom; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  const side = Math.max(x1 - x0 + 1, headBottom - top + 1) * 1.06;
  const sx = (x0 + x1 + 1) / 2 - side / 2;
  const sy = top - side * 0.03;
  const head = new PixelCanvas(size, size);
  const ctx = head.ctx;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.canvas, sx, sy, side, side, 0, 0, size, size);
  // El corte de abajo (cuello, hombros) se desvanece en vez de quedar recto.
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createLinearGradient(0, size * 0.76, 0, size);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  const tex = head.addTo(textures, TEX.playerHead);
  tex.customData = { meta: { displayScale: scale, smooth: (textures.get(key).customData as { meta?: { smooth?: unknown } }).meta?.smooth === true } };
  applySmoothFilter(tex);
}

/** Hoja chiquita con algunas poses de un personaje (para la pantalla de selección). */
export function ensureCharacterPreview(scene: Phaser.Scene, characterId: string): string {
  const key = TEX.characterPreview(characterId);
  if (!scene.textures.exists(key)) {
    const look = getLook(getCharacter(characterId).lookId);
    if (hasDefinitiveArt(scene.textures, look.id)) {
      aliasTexture(scene.textures, `char-${look.id}-0`, key);
    } else {
      const names = ['idle0', 'idle1', 'blink', 'walk0', 'walk1', 'walk2', 'walk3', 'win0', 'win1'];
      buildSheet(
        scene.textures,
        key,
        names.map((name) => ({ name, canvas: renderPose(PLAYER_POSES[name], look) })),
        9,
      );
    }
  }
  const anim = ANIM.preview(characterId);
  if (!scene.anims.exists(anim)) {
    scene.anims.create({
      key: anim,
      frames: ['idle0', 'idle0', 'idle1', 'idle1', 'blink', 'idle0', 'idle1'].map((frame) => ({ key, frame })),
      frameRate: 4,
      repeat: -1,
    });
  }
  return key;
}
