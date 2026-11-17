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

/** Copia una textura con otra clave (mismos frames). Sirve para el arte propio de cada personaje. */
export function aliasTexture(textures: Phaser.Textures.TextureManager, from: string, to: string): boolean {
  if (!textures.exists(from)) return false;
  const src = textures.get(from);
  if (textures.exists(to)) textures.remove(to);
  const tex = textures.addImage(to, src.getSourceImage() as HTMLImageElement);
  if (!tex) return false;
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
    for (const a of e.anims ?? []) {
      if (anims.exists(a.key)) anims.remove(a.key);
      anims.create({ key: a.key, frames: a.frames.map((frame) => ({ key: e.key, frame })), frameRate: a.frameRate, repeat: a.repeat ?? -1 });
    }
    applied.push(e.key);
  }
  return applied;
}
