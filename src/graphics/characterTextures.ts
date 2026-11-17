import Phaser from 'phaser';
import { aliasTexture } from '../assets/AssetLoader';
import { getCharacter } from '../data/characters';
import { ANIM, createPlayerAnimations } from './animations';
import { getLook } from './characterLooks';
import { TEX } from './keys';
import { buildSheet } from './PixelCanvas';
import { generatePlayerTextures, PLAYER_POSES, renderPose } from './textures/playerTextures';

/**
 * Gráficos del personaje elegido. Las hojas del jugador ('player-0..2') se
 * regeneran sólo cuando cambia el personaje, y las animaciones se recrean
 * porque apuntan a esas hojas.
 */
let appliedLook: string | null = 'pibe';

export function applyPlayerCharacter(scene: Phaser.Scene, characterId: string): void {
  const look = getLook(getCharacter(characterId).lookId);
  if (appliedLook === look.id && scene.textures.exists(TEX.player(0))) return;
  // Arte definitivo (declarado en assets/manifest.ts como char-<look>-0..2) o, si no hay, el provisional.
  const definitive = [0, 1, 2].every((d) => scene.textures.exists(`char-${look.id}-${d}`));
  if (definitive) [0, 1, 2].forEach((d) => aliasTexture(scene.textures, `char-${look.id}-${d}`, TEX.player(d)));
  else generatePlayerTextures(scene.textures, look);
  createPlayerAnimations(scene.anims);
  appliedLook = look.id;
}

/** Hoja chiquita con algunas poses de un personaje (para la pantalla de selección). */
export function ensureCharacterPreview(scene: Phaser.Scene, characterId: string): string {
  const key = TEX.characterPreview(characterId);
  if (!scene.textures.exists(key)) {
    const look = getLook(getCharacter(characterId).lookId);
    const names = ['idle0', 'idle1', 'blink', 'walk0', 'walk1', 'walk2', 'walk3', 'win0', 'win1'];
    buildSheet(
      scene.textures,
      key,
      names.map((name) => ({ name, canvas: renderPose(PLAYER_POSES[name], look) })),
      9,
    );
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
