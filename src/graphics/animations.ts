import Phaser from 'phaser';
import { DOG_KINDS, TEX } from './keys';
import { WAVING_NPC_LOOKS } from './textures/npcActorTextures';

/** Claves de animación. */
export const ANIM = {
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
export function createPlayerAnimations(anims: Phaser.Animations.AnimationManager): void {
  const make = maker(anims);
  for (let dirt = 0; dirt < 3; dirt++) {
    const tex = TEX.player(dirt);
    make(ANIM.player(dirt, 'idle'), tex, ['idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'blink', 'idle0', 'idle1', 'idle1', 'idle0'], 4);
    make(ANIM.player(dirt, 'walk'), tex, ['walk0', 'walk1', 'walk2', 'walk3'], 8);
    make(ANIM.player(dirt, 'run'), tex, ['run0', 'run1', 'run2', 'run3'], 13);
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
