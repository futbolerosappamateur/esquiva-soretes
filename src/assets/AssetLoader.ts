import Phaser from 'phaser';
import { ASSET_MANIFEST, MANIFEST_PREFIX, type AssetEntry } from './manifest';

/**
 * Carga de los gráficos definitivos declarados en el manifiesto. Se cargan
 * con una clave temporal y, después de generar los provisionales, reemplazan
 * a la textura con la clave real (así el juego no nota la diferencia).
 */
export function queueManifest(loader: Phaser.Loader.LoaderPlugin): void {
  for (const e of ASSET_MANIFEST) {
    const key = MANIFEST_PREFIX + e.key;
    if (e.kind === 'image') loader.image(key, e.url);
    else if (e.kind === 'spritesheet') loader.spritesheet(key, e.url, { frameWidth: e.frameWidth, frameHeight: e.frameHeight });
    else loader.atlas(key, e.url, e.atlasUrl);
  }
}

/**
 * Dibujos con sombreado suave (personajes definitivos, atlas con meta.smooth):
 * se filtran suave en vez de por píxeles, para que se vean prolijos al
 * achicarlos (dibujo sin placa de video) o agrandarlos (vista previa grande).
 */
export function applySmoothFilter(tex: Phaser.Textures.Texture): void {
  const meta = (tex.customData as { meta?: { smooth?: unknown } } | undefined)?.meta;
  if (meta?.smooth === true) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Copia una textura con otra clave (mismos frames). Sirve para el arte propio de cada personaje. */
export function aliasTexture(textures: Phaser.Textures.TextureManager, from: string, to: string): boolean {
  if (!textures.exists(from)) return false;
  const src = textures.get(from);
  if (textures.exists(to)) textures.remove(to);
  const tex = textures.addImage(to, src.getSourceImage() as HTMLImageElement);
  if (!tex) return false;
  // Datos del atlas (por ejemplo, la escala con la que se muestra un dibujo hecho al doble).
  tex.customData = { ...src.customData };
  applySmoothFilter(tex);
  for (const name of src.getFrameNames()) {
    const f = src.get(name);
    tex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  }
  return true;
}

function nameFrames(textures: Phaser.Textures.TextureManager, e: AssetEntry): void {
  if (e.kind !== 'spritesheet' || !e.frames) return;
  const tex = textures.get(e.key);
  e.frames.forEach((name, i) => {
    const f = tex.get(i);
    if (f) tex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  });
}

/**
 * Reemplaza los gráficos provisionales por los cargados. Devuelve las claves
 * reemplazadas (para no volver a generarlas).
 */
export function applyManifest(textures: Phaser.Textures.TextureManager, anims: Phaser.Animations.AnimationManager): string[] {
  const applied: string[] = [];
  for (const e of ASSET_MANIFEST) {
    const tmp = MANIFEST_PREFIX + e.key;
    if (!textures.exists(tmp)) continue; // el archivo no se pudo cargar: queda el provisional
    if (textures.exists(e.key)) textures.remove(e.key);
    textures.renameTexture(tmp, e.key);
    nameFrames(textures, e);
    applySmoothFilter(textures.get(e.key));
    if (e.smooth) textures.get(e.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (e.displayScale) {
      // Dibujo en alta resolución: fitToTexture lo muestra a su tamaño en el juego.
      const tex = textures.get(e.key);
      const data = (tex.customData ?? {}) as { meta?: Record<string, unknown> };
      tex.customData = { ...data, meta: { ...data.meta, displayScale: e.displayScale, smooth: e.smooth === true || data.meta?.smooth === true } };
    }
    for (const a of e.anims ?? []) {
      if (anims.exists(a.key)) anims.remove(a.key);
      anims.create({ key: a.key, frames: a.frames.map((frame) => ({ key: e.key, frame })), frameRate: a.frameRate, repeat: a.repeat ?? -1 });
    }
    applied.push(e.key);
  }
  return applied;
}
