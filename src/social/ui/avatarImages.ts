import { frameCanvas } from '../../graphics/characterTextures';
import { getLook } from '../../graphics/characterLooks';
import { TEX } from '../../graphics/keys';
import { PLAYER_POSES, renderPose } from '../../graphics/textures/playerTextures';
import { getAvatar } from '../avatars';
import { overlayGame } from './overlay';

/**
 * Imágenes de los avatares para la interfaz HTML: se dibujan con los mismos
 * gráficos del juego (busto del personaje) y se guardan en memoria.
 */
const cache = new Map<string, string>();

const FALLBACK =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='80'>%F0%9F%92%A9</text></svg>";

export function avatarUrl(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = getAvatar(id);
  let url = '';
  try {
    if (def.lookId) {
      // Si el personaje ya tiene su dibujo definitivo, el avatar sale de ahí.
      const g = overlayGame();
      const art = g ? frameCanvas(g.textures, `char-${def.lookId}-0`, 'idle0') : null;
      url = bust((art ?? renderPose(PLAYER_POSES.idle0, getLook(def.lookId))).canvas);
    } else {
      const g = overlayGame();
      if (g?.textures.exists(TEX.mascot)) url = g.textures.getBase64(TEX.mascot, 'idle');
    }
  } catch {
    url = '';
  }
  if (!url) url = FALLBACK;
  cache.set(def.id, url);
  return url;
}

/** Recorta cabeza y hombros del personaje (cuadrado desde lo más alto del dibujo). */
function bust(src: HTMLCanvasElement): string {
  const ctx = src.getContext('2d');
  if (!ctx) return '';
  const { width: w, height: hgt } = src;
  const px = ctx.getImageData(0, 0, w, hgt).data;
  let minX = w;
  let minY = hgt;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return src.toDataURL();
  const side = Math.min(w, Math.max(maxX - minX + 1, Math.round((maxY - minY + 1) * 0.62)) + 4);
  const x0 = Math.max(0, Math.min(w - side, Math.round((minX + maxX + 1) / 2 - side / 2)));
  const y0 = Math.max(0, minY - 2);
  const out = document.createElement('canvas');
  out.width = side;
  out.height = side;
  const octx = out.getContext('2d');
  if (!octx) return src.toDataURL();
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, x0, y0, side, side, 0, 0, side, side);
  return out.toDataURL();
}
