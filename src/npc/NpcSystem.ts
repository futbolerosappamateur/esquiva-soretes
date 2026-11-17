import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { npcLookFor } from '../data/characters';
import { NPC_DEFS } from '../data/npcs';
import { ANIM } from '../graphics/animations';
import { FX_FRAMES, TEX } from '../graphics/keys';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { SpeechBubble } from '../ui/speechBubble';
import { createBehavior } from './behaviors';
import { NpcActor, type NpcContext, type NpcEvent, type NpcPlayerView } from './NpcActor';

export interface NpcPlacementSpec {
  defId: string;
  x: number;
  y: number;
  dir?: 1 | -1;
}

/** Representación visual de un NPC (sprite, sombra y globito de diálogo). */
class NpcView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private bubble?: SpeechBubble;
  private current = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actor: NpcActor,
    private readonly look: string,
  ) {
    this.shadow = scene.add.image(actor.x, actor.y, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3).setDepth(DEPTH.shadow);
    this.sprite = scene.add.sprite(actor.x, actor.y, TEX.npc(look), 'idle').setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY);
  }

  sync(): void {
    const a = this.actor;
    this.sprite.setPosition(Math.round(a.x), Math.round(a.y)).setDepth(a.y + 0.4).setFlipX(a.dir < 0);
    this.shadow.setPosition(Math.round(a.x), Math.round(a.y));
    const key = a.anim === 'sweep' ? ANIM.npcSweep(this.look) : a.anim === 'wave' ? ANIM.npcWave(this.look) : '';
    if (key && key !== this.current && this.scene.anims.exists(key)) {
      this.current = key;
      this.sprite.play(key);
    } else if (!key && this.current !== 'idle') {
      this.current = 'idle';
      this.sprite.stop();
      this.sprite.setFrame('idle');
    }
    this.bubble?.setPosition(Math.round(a.x), Math.round(a.y - 52));
  }

  say(text: string): void {
    this.bubble?.destroy();
    this.bubble = new SpeechBubble(this.scene, this.actor.x, this.actor.y - 52, text);
  }

  emote(): void {
    const ex = this.scene.add.image(this.actor.x + 6, this.actor.y - 50, TEX.fx, FX_FRAMES.exclaim).setDepth(DEPTH.floatingText);
    this.scene.tweens.add({ targets: ex, y: ex.y - 8, alpha: 0, duration: 700, onComplete: () => ex.destroy() });
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
  }

  setTint(tint: number): void {
    this.sprite.setTint(tint);
  }

  destroy(): void {
    this.bubble?.destroy();
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

/**
 * Administra los NPC con comportamientos de un nivel. Traduce los eventos de
 * los actores a la vista (globitos) y los reenvía al juego (misiones, etc.).
 */
export class NpcSystem {
  readonly actors: NpcActor[] = [];
  private readonly views = new Map<NpcActor, NpcView>();

  constructor(
    scene: Phaser.Scene,
    placements: NpcPlacementSpec[],
    playerCharacterId: string,
    private readonly onEvent: (ev: NpcEvent) => void,
  ) {
    placements.forEach((p, i) => {
      const def = NPC_DEFS[p.defId];
      if (!def || !def.ready) return;
      const actor = new NpcActor(`${p.defId}-${i}`, p.defId, p.x, p.y, p.dir ?? 1, def.behaviors.map(createBehavior));
      this.actors.push(actor);
      // Si el jugador eligió el mismo diseño, el NPC usa una variante de vestuario.
      this.views.set(actor, new NpcView(scene, actor, npcLookFor(def.look, playerCharacterId)));
    });
  }

  update(dt: number, player: NpcPlayerView, missionState: NpcContext['missionState'], left: number, right: number): void {
    const ctx: NpcContext = {
      player,
      missionState,
      emit: (ev) => {
        const view = this.views.get(ev.actor);
        if (ev.type === 'say') view?.say(ev.text);
        else if (ev.type === 'emote') view?.emote();
        this.onEvent(ev);
      },
    };
    for (const actor of this.actors) {
      const view = this.views.get(actor);
      const onScreen = actor.x > left - 120 && actor.x < right + 120;
      view?.setVisible(onScreen);
      if (!onScreen) continue;
      actor.update(ctx, dt);
      view?.sync();
    }
  }

  setTint(tint: number): void {
    this.views.forEach((v) => v.setTint(tint));
  }

  destroy(): void {
    this.views.forEach((v) => v.destroy());
    this.views.clear();
  }
}
