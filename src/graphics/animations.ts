import Phaser from 'phaser';
import { TEX } from './keys';
import { DOG_KINDS } from './textures/npcTextures';

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
} as const;

export type PlayerAnim = 'idle' | 'walk' | 'run' | 'win';

export function createAnimations(anims: Phaser.Animations.AnimationManager): void {
  const make = (key: string, texture: string, frames: string[], frameRate: number, repeat = -1) => {
    if (anims.exists(key)) anims.remove(key);
    anims.create({ key, frames: frames.map((frame) => ({ key: texture, frame })), frameRate, repeat });
  };

  for (let dirt = 0; dirt < 3; dirt++) {
    const tex = TEX.player(dirt);
    make(ANIM.player(dirt, 'idle'), tex, ['idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'blink', 'idle0', 'idle1', 'idle1', 'idle0'], 4);
    make(ANIM.player(dirt, 'walk'), tex, ['walk0', 'walk1', 'walk2', 'walk3'], 8);
    make(ANIM.player(dirt, 'run'), tex, ['run0', 'run1', 'run2', 'run3'], 13);
    make(ANIM.player(dirt, 'win'), tex, ['win0', 'win1'], 5);
  }

  make(ANIM.pigeonPeck, TEX.pigeon, ['peck0', 'peck0', 'peck1', 'peck0', 'peck1', 'peck0', 'peck0', 'peck0'], 5);
  make(ANIM.pigeonFly, TEX.pigeon, ['fly0', 'fly1'], 14);
  make(ANIM.walker, TEX.npcWalker, ['walk0', 'walk1'], 4);
  make(ANIM.lady, TEX.npcLady, ['walk0', 'walk1'], 3);
  make(ANIM.tourist, TEX.npcTourist, ['walk0', 'walk1'], 4);
  DOG_KINDS.forEach((_, i) => make(ANIM.dog(i), TEX.npcDog(i), ['walk0', 'walk1'], 7));
  make(ANIM.stink, TEX.stink, ['stink0', 'stink1', 'stink2'], 8);
  make(ANIM.fly, TEX.fly, ['fly0', 'fly1'], 20);
  make(ANIM.mascot, TEX.mascot, ['idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'blink', 'idle', 'idle', 'idle'], 6);
}
