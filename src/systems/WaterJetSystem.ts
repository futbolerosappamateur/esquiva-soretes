import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import { ANIM } from '../graphics/animations';
import { FX_FRAMES, TEX } from '../graphics/keys';
import { PLAYER_FRAME } from '../graphics/textures/playerTextures';
import { SpeechBubble } from '../ui/speechBubble';
import type { WaterLadyPlacement } from '../world/LevelLayout';
import { Sprinkler, type SprinklerPlayer } from '../world/sprinkler';

export interface WaterJetEvents {
  /** El chorro mojó al jugador. */
  onHit: (x: number, y: number) => void;
  /** Pasó al lado de una vecina regando sin mojarse. */
  onDodged: (x: number, y: number) => void;
  /** Le tiraron agua a alguien a prueba de agua. */
  onImmune: () => void;
  /** Empieza un chorro (para el sonido). */
  onSpray?: (x: number) => void;
}

const LADY_PHRASES = ['¡CUIDADO QUE MOJA!', '¡NO PISES LO MOJADO, NENE!', '¡PERMISO QUE RIEGO!'];
const SORRY_PHRASES = ['¡AY, PERDÓN!', '¡UY! ¡NO TE VI!'];

interface Lady {
  logic: Sprinkler;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  /** Franja del piso que se moja (aviso y charco). */
  ground: Phaser.GameObjects.Graphics;
  /** El chorro en el aire. */
  jet: Phaser.GameObjects.Graphics;
  bubble?: SpeechBubble;
  greeted: boolean;
  anim: string;
}

/**
 * Vecinas que riegan la vereda. La lógica (ciclo, zona que moja y si se
 * esquivó) está en world/sprinkler.ts; acá se dibuja: la vecina, el aviso
 * en el piso antes del chorro y el agua.
 */
export class WaterJetSystem {
  private readonly ladies: Lady[] = [];
  private clock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    placements: WaterLadyPlacement[],
    startX: number,
    tint: number,
    private readonly events: WaterJetEvents,
  ) {
    for (const p of placements) {
      const logic = new Sprinkler(p.x, p.y, p.offset, startX);
      const shadow = scene.add.image(p.x, p.y, TEX.fx, FX_FRAMES.shadow).setAlpha(0.3).setDepth(DEPTH.shadow);
      const sprite = scene.add
        .sprite(p.x, p.y, TEX.npc('senora'), 'idle')
        .setOrigin(PLAYER_FRAME.originX, PLAYER_FRAME.originY)
        .setDepth(p.y + 0.4);
      if (tint !== 0xffffff) sprite.setTint(tint);
      const ground = scene.add.graphics().setDepth(DEPTH.groundDecal + 2);
      const jet = scene.add.graphics().setDepth(logic.reachY + 0.6);
      this.ladies.push({ logic, sprite, shadow, ground, jet, greeted: false, anim: '' });
    }
  }

  get count(): number {
    return this.ladies.length;
  }

  update(dt: number, player: SprinklerPlayer, opts: { vulnerable: boolean; immune: boolean }, left: number, right: number): void {
    this.clock += dt;
    for (const lady of this.ladies) {
      const l = lady.logic;
      const step = l.update(dt, player, opts);
      if (step.changed && step.phase === 'spray') this.events.onSpray?.(l.x);
      if (step.hit) {
        this.events.onHit(player.x, player.y);
        this.say(lady, SORRY_PHRASES[Math.floor(Math.random() * SORRY_PHRASES.length)]);
      }
      if (step.splashedImmune) this.events.onImmune();
      if (step.dodged) this.events.onDodged(player.x, player.y);
      if (!lady.greeted && !l.passed && Math.abs(player.x - l.x) < 170) {
        lady.greeted = true;
        this.say(lady, LADY_PHRASES[Math.floor(l.x) % LADY_PHRASES.length]);
      }

      const onScreen = l.x > left - 80 && l.x < right + 80;
      lady.sprite.setVisible(onScreen);
      lady.shadow.setVisible(onScreen);
      lady.ground.setVisible(onScreen);
      lady.jet.setVisible(onScreen);
      if (!onScreen) continue;
      this.draw(lady);
    }
  }

  private say(lady: Lady, text: string): void {
    lady.bubble?.destroy();
    lady.bubble = new SpeechBubble(this.scene, lady.logic.x, lady.logic.y - 52, text, 2200);
  }

  private setAnim(lady: Lady, key: string): void {
    if (lady.anim === key) return;
    lady.anim = key;
    if (key === 'idle') {
      lady.sprite.stop();
      lady.sprite.setFrame('idle');
    } else if (this.scene.anims.exists(key)) {
      lady.sprite.play(key);
    }
  }

  private draw(lady: Lady): void {
    const l = lady.logic;
    const z = l.zone();
    const g = lady.ground;
    const jet = lady.jet;
    g.clear();
    jet.clear();
    const cx = (z.x0 + z.x1) / 2;
    const w = z.x1 - z.x0;
    if (l.phase === 'idle') {
      this.setAnim(lady, 'idle');
      // Queda la vereda mojada un ratito después del chorro.
      if (l.progress < 0.5) g.fillStyle(0x3d6f9a, 0.25 * (1 - l.progress * 2)).fillRect(z.x0, l.y, w, z.y1 - l.y);
      return;
    }
    if (l.phase === 'telegraph') {
      // Aviso: la franja que se va a mojar titila en el piso y caen unas gotas.
      this.setAnim(lady, ANIM.npcWave('senora'));
      const blink = Math.floor(this.clock * 10) % 2 === 0;
      g.fillStyle(0x8fd6ff, blink ? 0.32 : 0.16).fillRect(z.x0, l.y, w, z.y1 - l.y);
      g.lineStyle(1, 0x8fd6ff, blink ? 0.9 : 0.4).strokeRect(z.x0 + 0.5, l.y + 0.5, w - 1, z.y1 - l.y - 1);
      jet.fillStyle(0x8fd6ff, 1);
      for (let k = 0; k < 3; k++) jet.fillRect(Math.round(l.x + 8 + k * 2), Math.round(l.y - 22 + ((this.clock * 40 + k * 5) % 14)), 1, 2);
      return;
    }
    // Chorro: tres arcos hasta distintas profundidades de la franja, y salpicaduras.
    this.setAnim(lady, ANIM.npcWater('senora'));
    g.fillStyle(0x3d6f9a, 0.35).fillRect(z.x0, l.y, w, z.y1 - l.y);
    jet.setDepth(z.y1 + 0.6);
    const nx = l.x + 12;
    const ny = l.y - 23;
    const wob = Math.sin(this.clock * 18) * 2;
    for (const f of [0.35, 0.7, 1]) {
      const tx = cx + wob * f;
      const ty = l.y + (z.y1 - l.y) * f;
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(nx, ny), new Phaser.Math.Vector2(cx + 8, ny - 6), new Phaser.Math.Vector2(tx, ty));
      jet.lineStyle(2, 0x8fd6ff, 0.85);
      curve.draw(jet, 12);
      jet.fillStyle(0xe8f8ff, 1).fillRect(Math.round(tx - 2 + ((this.clock * 37 * f) % 4)), Math.round(ty - 2), 2, 2);
    }
    jet.fillStyle(0xe8f8ff, 0.9);
    for (let k = 0; k < 5; k++) {
      const px = z.x0 + ((k * 7 + this.clock * 60) % w);
      const py = l.y + ((k * 13 + this.clock * 45) % Math.max(1, z.y1 - l.y));
      jet.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }

  destroy(): void {
    for (const lady of this.ladies) {
      lady.bubble?.destroy();
      lady.sprite.destroy();
      lady.shadow.destroy();
      lady.ground.destroy();
      lady.jet.destroy();
    }
    this.ladies.length = 0;
  }
}
