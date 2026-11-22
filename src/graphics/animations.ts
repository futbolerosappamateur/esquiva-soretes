import Phaser from 'phaser';
import { DOG_KINDS, TEX } from './keys';
import { WAVING_NPC_LOOKS } from './textures/npcActorTextures';

/** Claves de animación. */
export const ANIM = {
  /** Logo definitivo de la portada (la crea el manifiesto si el archivo está). */
  logoArt: 'logo-art-anim',
  player: (dirt: number, name: PlayerAnim) => `player-${dirt}-${name}`,
  pigeonPeck: 'pigeon-peck',
  pigeonFly: 'pigeon-fly',
  walker: 'npc-walker-walk',
  lady: 'npc-lady-walk',
  tourist: 'npc-tourist-walk',
  dog: (n: number) => `npc-dog-${n}-walk`,
  stink: 'fx-stink',
  fly: 'fx-fly',
  mascot: 'mascot-idle',
  coin: 'coin-spin',
  npcSweep: (look: string) => `npc-${look}-sweep`,
  npcWave: (look: string) => `npc-${look}-wave`,
  npcWater: (look: string) => `npc-${look}-water`,
  preview: (characterId: string) => `preview-${characterId}`,
} as const;

export type PlayerAnim = 'idle' | 'walk' | 'run' | 'win';

type Make = (key: string, texture: string, frames: string[], frameRate: number, repeat?: number) => void;

function maker(anims: Phaser.Animations.AnimationManager): Make {
  return (key, texture, frames, frameRate, repeat = -1) => {
    if (anims.exists(key)) anims.remove(key);
    anims.create({ key, frames: frames.map((frame) => ({ key: texture, frame })), frameRate, repeat });
  };
}

/**
 * Animaciones del protagonista. Se vuelven a crear cada vez que cambia el
 * personaje elegido, porque sus hojas de sprites se regeneran.
 */
export function createPlayerAnimations(anims: Phaser.Animations.AnimationManager, textures?: Phaser.Textures.TextureManager): void {
  const make = maker(anims);
  // Ciclos de caminar y correr: 4 cuadros en el arte provisional; el definitivo puede traer
  // más (walk0..walk7). Con más cuadros sube la velocidad para que el paso dure lo mismo.
  const cycle = (tex: string, base: string): string[] => {
    const t = textures?.exists(tex) ? textures.get(tex) : null;
    const out: string[] = [];
    for (let i = 0; t?.has(`${base}${i}`); i++) out.push(`${base}${i}`);
    return out.length ? out : [0, 1, 2, 3].map((i) => `${base}${i}`);
  };
  for (let dirt = 0; dirt < 3; dirt++) {
    const tex = TEX.player(dirt);
    const walk = cycle(tex, 'walk');
    const run = cycle(tex, 'run');
    make(ANIM.player(dirt, 'idle'), tex, ['idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'blink', 'idle0', 'idle1', 'idle1', 'idle0'], 4);
    make(ANIM.player(dirt, 'walk'), tex, walk, (8 * walk.length) / 4);
    make(ANIM.player(dirt, 'run'), tex, run, (13 * run.length) / 4);
    make(ANIM.player(dirt, 'win'), tex, ['win0', 'win1'], 5);
  }
}

export function createAnimations(anims: Phaser.Animations.AnimationManager): void {
  const make = maker(anims);
  createPlayerAnimations(anims);

  make(ANIM.pigeonPeck, TEX.pigeon, ['peck0', 'peck0', 'peck1', 'peck0', 'peck1', 'peck0', 'peck0', 'peck0'], 5);
  make(ANIM.pigeonFly, TEX.pigeon, ['fly0', 'fly1'], 14);
  make(ANIM.walker, TEX.npcWalker, ['walk0', 'walk1'], 4);
  make(ANIM.lady, TEX.npcLady, ['walk0', 'walk1'], 3);
  make(ANIM.tourist, TEX.npcTourist, ['walk0', 'walk1'], 4);
  DOG_KINDS.forEach((_, i) => make(ANIM.dog(i), TEX.npcDog(i), ['walk0', 'walk1'], 7));
  make(ANIM.stink, TEX.stink, ['stink0', 'stink1', 'stink2'], 8);
  make(ANIM.fly, TEX.fly, ['fly0', 'fly1'], 20);
  make(ANIM.mascot, TEX.mascot, ['idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'blink', 'idle', 'idle', 'idle'], 6);
  make(ANIM.coin, TEX.coin, ['c0', 'c1', 'c2', 'c3'], 8);
  for (const look of ['portero', 'portero-alt']) make(ANIM.npcSweep(look), TEX.npc(look), ['sweep0', 'sweep1', 'sweep2', 'sweep1'], 5);
  for (const look of WAVING_NPC_LOOKS) make(ANIM.npcWave(look), TEX.npc(look), ['wave', 'idle', 'wave', 'idle'], 4, 0);
  make(ANIM.npcWater('senora'), TEX.npc('senora'), ['water0', 'water1'], 8);
}
