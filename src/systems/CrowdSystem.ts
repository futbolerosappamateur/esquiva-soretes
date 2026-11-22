import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { ANIM } from '../graphics/animations';
import { FX_FRAMES, TEX } from '../graphics/keys';
import { NPC_FRAME } from '../graphics/textures/npcTextures';
import { SpeechBubble } from '../ui/speechBubble';
import { Pedestrian, type CrowdBlocker, type CrowdPlayer } from '../world/crowd';
import type { CrowdPlacement, NpcKind } from '../world/LevelLayout';

export interface CrowdEvents {
  /** Alguien chocó al pibe (o el pibe se lo llevó puesto). */
  onBump: (x: number, y: number, kind: NpcKind) => void;
}

const COMPLAINTS = ['¡EPA, NENE!', '¡MIRÁ POR DÓNDE ANDÁS!', '¡QUÉ APURO!', '¡ESTOS PIBES!', '¡PERMISO, EH!'];
const TEXTURES: Record<NpcKind, string> = { walker: TEX.npcWalker, lady: TEX.npcLady, tourist: TEX.npcTourist };
const ANIMS: Record<NpcKind, string> = { walker: ANIM.walker, lady: ANIM.lady, tourist: ANIM.tourist };
/** Distancia (px) a la cámara desde la que la gente esquiva con cuidado; más lejos sólo camina. */
const ACTIVE_MARGIN = 220;

interface Person {
  logic: Pedestrian;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  bubble?: SpeechBubble;
  walking: boolean;
}

/**
 * La gente que camina por la vereda (rasgo `crowd` del barrio). La lógica de
 * cada persona está en world/crowd.ts; acá se dibujan y se les pasa lo que
 * tienen que esquivar (soretes, árboles y las otras personas).
 */
export class CrowdSystem {
  private readonly people: Person[] = [];
  /** Soretes, baldosas y árboles, ordenados por x para buscar sólo los cercanos. */
  private readonly blockers: CrowdBlocker[];

  constructor(
    private readonly scene: Phaser.Scene,
    placements: CrowdPlacement[],
    blockers: CrowdBlocker[],
    tint: number,
    private readonly events: CrowdEvents,
  ) {
    this.blockers = [...blockers].sort((a, b) => a.x - b.x);
    for (const p of placements) {
      const logic = new Pedestrian(p);
      const shadow = scene.add.image(p.x, p.y, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3).setDepth(DEPTH.shadow);
      const sprite = scene.add
        .sprite(p.x, p.y, TEXTURES[p.kind], 'walk0')
        .setOrigin(0.5, (NPC_FRAME.groundY + 1) / NPC_FRAME.h)
        .setDepth(p.y)
        .setFlipX(p.dir < 0);
      sprite.play({ key: ANIMS[p.kind], startFrame: Math.floor(p.x) % 2 });
      if (tint !== 0xffffff) sprite.setTint(tint);
      this.people.push({ logic, sprite, shadow, walking: true });
    }
  }

  get count(): number {
    return this.people.length;
  }

  /** Posición de cada persona (para pruebas y depuración). */
  positions(): { x: number; y: number; dir: number; distracted: boolean }[] {
    return this.people.map((p) => ({ x: p.logic.x, y: p.logic.y, dir: p.logic.dir, distracted: p.logic.placement.distracted }));
  }

  update(dt: number, player: CrowdPlayer, vulnerable: boolean, left: number, right: number): void {
    for (const person of this.people) {
      const l = person.logic;
      const active = l.x > left - ACTIVE_MARGIN && l.x < right + ACTIVE_MARGIN;
      if (active) {
        const step = l.update(dt, this.nearby(person), player, vulnerable);
        if (step.bumped) {
          this.events.onBump(l.x, l.y, l.placement.kind);
          this.say(person, COMPLAINTS[Math.floor(l.x + l.y) % COMPLAINTS.length]);
        }
      } else {
        // Lejos de la cámara nadie la ve: camina derecho (sin buscar qué esquivar).
        l.update(dt, [], null, false);
      }
      const onScreen = l.x > left - 40 && l.x < right + 40;
      person.sprite.setVisible(onScreen);
      person.shadow.setVisible(onScreen);
      if (!onScreen) continue;
      const x = Math.round(l.x);
      const y = Math.round(l.y);
      person.sprite.setPosition(x, y).setDepth(l.y).setFlipX(l.dir < 0);
      person.shadow.setPosition(x, y);
      person.bubble?.setPosition(x, y - 46);
      if (l.walking !== person.walking) {
        person.walking = l.walking;
        if (l.walking) person.sprite.play({ key: ANIMS[l.placement.kind], startFrame: 1 });
        else person.sprite.stop().setFrame('walk0');
      }
    }
  }

  /** Lo que una persona tiene cerca para esquivar: soretes, árboles y las otras personas. */
  private nearby(person: Person): CrowdBlocker[] {
    const x = person.logic.x;
    const out: CrowdBlocker[] = [];
    // Búsqueda binaria del primer bloqueo a menos de 50 px.
    let lo = 0;
    let hi = this.blockers.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.blockers[mid].x < x - 50) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < this.blockers.length && this.blockers[i].x <= x + 50; i++) out.push(this.blockers[i]);
    for (const other of this.people) {
      if (other === person || Math.abs(other.logic.x - x) > 50) continue;
      out.push({ x: other.logic.x, y: other.logic.y, fp: other.logic.footprint });
    }
    return out;
  }

  private say(person: Person, text: string): void {
    person.bubble?.destroy();
    person.bubble = new SpeechBubble(this.scene, person.logic.x, person.logic.y - 46, text, 1800);
  }

  destroy(): void {
    for (const p of this.people) {
      p.bubble?.destroy();
      p.sprite.destroy();
      p.shadow.destroy();
    }
    this.people.length = 0;
  }
}
