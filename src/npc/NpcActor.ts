/**
 * Arquitectura de NPCs: la lógica (NpcActor + comportamientos) no sabe nada
 * de gráficos. La vista (NpcView) lee el estado del actor y lo dibuja, así
 * los sprites definitivos se pueden enchufar después sin tocar la lógica.
 */

/** Animación lógica: la vista la traduce a la animación concreta de cada look. */
export type NpcAnim = 'idle' | 'walk' | 'sweep' | 'wave' | 'water' | 'sit';

export interface NpcPlayerView {
  x: number;
  y: number;
  /** El jugador tiene el control (no está en medio de un tropiezo). */
  active: boolean;
}

/** Lo que un NPC puede provocar en el juego. */
export type NpcEvent =
  | { type: 'say'; actor: NpcActor; text: string }
  | { type: 'emote'; actor: NpcActor; emote: 'alert' | 'happy' | 'angry' }
  | { type: 'offerMission'; actor: NpcActor; missionId: string }
  | { type: 'spawnObstacle'; actor: NpcActor; x: number; y: number; obstacle: string };

export interface NpcContext {
  player: NpcPlayerView;
  /** Estado de misiones que el NPC necesita saber (por ejemplo, si ya se completó). */
  missionState: (missionId: string) => 'available' | 'active' | 'done';
  emit: (event: NpcEvent) => void;
}

export interface NpcBehavior {
  readonly id: string;
  update(actor: NpcActor, ctx: NpcContext, dt: number): void;
}

export class NpcActor {
  x: number;
  y: number;
  dir: 1 | -1;
  anim: NpcAnim = 'idle';
  /** Mientras habla o saluda, los comportamientos de movimiento esperan. */
  busy = 0;
  readonly memory = new Map<string, number | boolean | string>();

  constructor(
    readonly id: string,
    readonly defId: string,
    x: number,
    y: number,
    dir: 1 | -1,
    readonly behaviors: NpcBehavior[],
  ) {
    this.x = x;
    this.y = y;
    this.dir = dir;
  }

  update(ctx: NpcContext, dt: number): void {
    this.busy = Math.max(0, this.busy - dt);
    for (const b of this.behaviors) b.update(this, ctx, dt);
  }

  distanceTo(p: { x: number; y: number }): { dx: number; dy: number } {
    return { dx: p.x - this.x, dy: p.y - this.y };
  }
}
