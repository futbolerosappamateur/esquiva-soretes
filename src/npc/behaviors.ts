import type { NpcActor, NpcAnim, NpcBehavior, NpcContext } from './NpcActor';

/**
 * Comportamientos reutilizables. Un NPC se arma combinándolos desde los datos
 * (data/npcs.ts). Todos son independientes de la apariencia gráfica.
 */
export type BehaviorSpec =
  | { kind: 'idle' }
  | { kind: 'patrol'; speed: number; range: number }
  | { kind: 'loopAction'; anim: NpcAnim; drift?: number }
  | { kind: 'react'; radius: number; phrases: string[]; emote?: 'alert' | 'happy' | 'angry'; cooldown?: number }
  | { kind: 'missionGiver'; missionId: string; radius: number; offer: string; reminder: string; thanks: string }
  | { kind: 'obstacleSpawner'; obstacle: string; interval: number; offsetX: number };

/** Se queda quieto. */
class IdleBehavior implements NpcBehavior {
  readonly id = 'idle';
  update(actor: NpcActor): void {
    if (actor.busy <= 0) actor.anim = 'idle';
  }
}

/** Camina de un lado a otro alrededor de su punto de partida. */
class PatrolBehavior implements NpcBehavior {
  readonly id = 'patrol';
  private origin: number | null = null;
  constructor(private readonly speed: number, private readonly range: number) {}
  update(actor: NpcActor, _ctx: NpcContext, dt: number): void {
    this.origin ??= actor.x;
    if (actor.busy > 0) return;
    actor.anim = 'walk';
    actor.x += actor.dir * this.speed * dt;
    if (actor.x > this.origin + this.range) actor.dir = -1;
    if (actor.x < this.origin - this.range) actor.dir = 1;
  }
}

/** Repite una acción (barrer, regar...) moviéndose apenas. */
class LoopActionBehavior implements NpcBehavior {
  readonly id = 'loopAction';
  private t = 0;
  private origin: number | null = null;
  constructor(private readonly anim: NpcAnim, private readonly drift = 0) {}
  update(actor: NpcActor, _ctx: NpcContext, dt: number): void {
    this.origin ??= actor.x;
    if (actor.busy > 0) return;
    this.t += dt;
    actor.anim = this.anim;
    if (this.drift > 0) {
      actor.x = this.origin + Math.sin(this.t * 0.4) * this.drift;
      actor.dir = Math.cos(this.t * 0.4) >= 0 ? 1 : -1;
    }
  }
}

/** Reacciona cuando el jugador pasa cerca (frase graciosa, una vez por pasada). */
class ReactBehavior implements NpcBehavior {
  readonly id = 'react';
  private cooldown = 0;
  private inside = false;
  constructor(private readonly spec: Extract<BehaviorSpec, { kind: 'react' }>) {}
  update(actor: NpcActor, ctx: NpcContext, dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const { dx, dy } = actor.distanceTo(ctx.player);
    const near = Math.abs(dx) < this.spec.radius && Math.abs(dy) < this.spec.radius;
    if (near && !this.inside && this.cooldown <= 0 && actor.memory.get('talked') !== true) {
      ctx.emit({ type: 'say', actor, text: this.spec.phrases[Math.floor(Math.random() * this.spec.phrases.length)] });
      if (this.spec.emote) ctx.emit({ type: 'emote', actor, emote: this.spec.emote });
      actor.dir = dx >= 0 ? 1 : -1;
      this.cooldown = this.spec.cooldown ?? 4;
    }
    this.inside = near;
  }
}

/** Ofrece una misión cuando el jugador se acerca; después recuerda o agradece. */
class MissionGiverBehavior implements NpcBehavior {
  readonly id = 'missionGiver';
  private lastState: string | null = null;
  private inside = false;
  constructor(private readonly spec: Extract<BehaviorSpec, { kind: 'missionGiver' }>) {}
  update(actor: NpcActor, ctx: NpcContext): void {
    const state = ctx.missionState(this.spec.missionId);
    const { dx, dy } = actor.distanceTo(ctx.player);
    // Grita desde lejos: alcanza con pasar por su tramo de vereda.
    const near = Math.abs(dx) < this.spec.radius && Math.abs(dy) < 80 && ctx.player.active;
    if (near && !this.inside) {
      actor.memory.set('talked', true);
      actor.dir = dx >= 0 ? 1 : -1;
      actor.busy = 1.6;
      actor.anim = 'wave';
      if (state === 'available') {
        ctx.emit({ type: 'offerMission', actor, missionId: this.spec.missionId });
        ctx.emit({ type: 'say', actor, text: this.spec.offer });
      } else if (state === 'active') {
        ctx.emit({ type: 'say', actor, text: this.spec.reminder });
      }
    }
    if (state === 'done' && this.lastState === 'active') {
      ctx.emit({ type: 'say', actor, text: this.spec.thanks });
      ctx.emit({ type: 'emote', actor, emote: 'happy' });
      actor.busy = 1.6;
      actor.anim = 'wave';
    }
    this.lastState = state;
    this.inside = near;
  }
}

/**
 * Genera obstáculos cada cierto tiempo (por ejemplo, el perro del paseador).
 * Preparado para próximas versiones: quien escucha el evento valida que el
 * camino siga siendo posible antes de agregarlo.
 */
class ObstacleSpawnerBehavior implements NpcBehavior {
  readonly id = 'obstacleSpawner';
  private t = 0;
  constructor(private readonly spec: Extract<BehaviorSpec, { kind: 'obstacleSpawner' }>) {}
  update(actor: NpcActor, ctx: NpcContext, dt: number): void {
    this.t += dt;
    if (this.t < this.spec.interval) return;
    this.t = 0;
    ctx.emit({ type: 'spawnObstacle', actor, x: actor.x - actor.dir * this.spec.offsetX, y: actor.y, obstacle: this.spec.obstacle });
  }
}

export function createBehavior(spec: BehaviorSpec): NpcBehavior {
  switch (spec.kind) {
    case 'idle':
      return new IdleBehavior();
    case 'patrol':
      return new PatrolBehavior(spec.speed, spec.range);
    case 'loopAction':
      return new LoopActionBehavior(spec.anim, spec.drift);
    case 'react':
      return new ReactBehavior(spec);
    case 'missionGiver':
      return new MissionGiverBehavior(spec);
    case 'obstacleSpawner':
      return new ObstacleSpawnerBehavior(spec);
  }
}
