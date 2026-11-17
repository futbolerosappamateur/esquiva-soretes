import { ABILITY_TUNING } from '../config/balance';
import { UI_COLORS } from '../config/palette';
import { abilityCooldown, abilityDuration, type AbilityId } from '../data/abilities';
import type { MotorMods } from '../entities/PlayerMotor';
import { Ability, type AbilityHost } from './Ability';

/** Dirección del poder: la que se está pidiendo o, si no, la última usada. */
function aimOf(host: AbilityHost): { x: number; y: number } {
  const { moveX, moveY } = host.input;
  if (Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1) return { x: moveX, y: moveY };
  const m = host.motor;
  return { x: m.lastDir.x || m.facing, y: m.lastDir.y };
}

/** EL PIBE: paso relámpago con una breve protección contra soretes. */
export class DashAbility extends Ability {
  constructor() {
    super('dash', abilityCooldown('dash'), ABILITY_TUNING.dash.protection);
  }
  protected onActivate(host: AbilityHost): boolean {
    const t = ABILITY_TUNING.dash;
    const m = host.motor;
    const aim = aimOf(host);
    const fromX = m.x;
    const fromY = m.y;
    const moved = m.dash(aim.x, aim.y, t.distance, t.step, host.isBlocked, host.bounds());
    if (moved < 6) return false; // contra una pared: no se gasta
    host.fx.dashTrail(fromX, fromY, m.x, m.y);
    host.fx.sfx('dash');
    return true;
  }
  poopShield(): boolean {
    return this.active;
  }
}

/** LA NENA DEL BARRIO: un segundo salto en el aire (no infinitos: después recarga). */
export class DoubleJumpAbility extends Ability {
  constructor() {
    super('doubleJump', abilityCooldown('doubleJump'), 0);
  }
  protected onActivate(host: AbilityHost): boolean {
    const m = host.motor;
    if (m.onGround) return false;
    m.airJump(m.stats.jumpVelocity * ABILITY_TUNING.doubleJump.velocityFactor);
    host.fx.airPuff();
    host.fx.sfx('doubleJump');
    return true;
  }
  onAirJump(host: AbilityHost): boolean {
    return this.tryActivate(host) === 'ok';
  }
}

/** LA NENA DEL MONOPATÍN: mucha velocidad; frena largo durante y después. */
export class TurboAbility extends Ability {
  private brakeAfter = 0;
  constructor() {
    super('turbo', abilityCooldown('turbo'), abilityDuration('turbo'));
  }
  protected onActivate(host: AbilityHost): boolean {
    host.fx.speedLines(true, 0xff7ac8);
    host.fx.sfx('turbo');
    return true;
  }
  protected onEnd(host: AbilityHost | null): void {
    this.brakeAfter = ABILITY_TUNING.turbo.brakeAfter;
    host?.fx.speedLines(false, 0xff7ac8);
  }
  protected onCooldownUpdate(dt: number): void {
    this.brakeAfter = Math.max(0, this.brakeAfter - dt);
  }
  protected onReset(): void {
    this.brakeAfter = 0;
  }
  mods(): Partial<MotorMods> {
    const t = ABILITY_TUNING.turbo;
    if (this.active) return { speed: t.speed, accel: t.accel, decel: t.decel };
    if (this.brakeAfter > 0) return { decel: t.decel };
    return {};
  }
}

/** LA CORREDORA: más velocidad sin perder el control; no junta monedas mientras corre. */
export class SprintAbility extends Ability {
  constructor() {
    super('sprint', abilityCooldown('sprint'), abilityDuration('sprint'));
  }
  protected onActivate(host: AbilityHost): boolean {
    host.fx.speedLines(true, 0xffd23f);
    host.fx.sfx('sprint');
    return true;
  }
  protected onEnd(host: AbilityHost | null): void {
    host?.fx.speedLines(false, 0xffd23f);
  }
  mods(): Partial<MotorMods> {
    const t = ABILITY_TUNING.sprint;
    return this.active ? { speed: t.speed, accel: t.accel, depth: t.depth } : {};
  }
  blocksPickups(): boolean {
    return this.active;
  }
}

/** EL PORTERO: barre adelante (hojas, soretes escondidos y basura); se queda quieto un instante. */
export class BroomAbility extends Ability {
  constructor() {
    super('broom', abilityCooldown('broom'), abilityDuration('broom'));
  }
  protected onActivate(host: AbilityHost): boolean {
    const t = ABILITY_TUNING.broom;
    const m = host.motor;
    const dir = m.facing;
    const x0 = dir > 0 ? m.x - 6 : m.x - t.reach;
    const x1 = dir > 0 ? m.x + t.reach : m.x + 6;
    const y0 = m.y - t.halfDepth;
    const y1 = m.y + t.halfDepth;
    const revealed = host.world.revealHidden(x0, x1, y0, y1);
    host.world.clearLeaves(x0, x1, y0, y1);
    const trash = host.world.collectTrash(x0, x1, y0, y1);
    host.fx.sweep(dir);
    host.fx.sfx('sweep');
    if (revealed > 0) host.fx.say(`¡TE ENCONTRÉ! (${revealed})`, UI_COLORS.orange);
    else if (trash > 0) host.fx.say('¡A LA BOLSA!', UI_COLORS.celeste);
    m.halt();
    return true;
  }
  mods(): Partial<MotorMods> {
    return this.active ? { frozen: true } : {};
  }
}

/** LA VIEJA DE LA MANGUERA: chorro de agua adelante que lava hojas y deja charcos. */
export class HoseAbility extends Ability {
  private puddleTimer = 0;
  private dir: 1 | -1 = 1;
  private found = 0;
  constructor() {
    super('hose', abilityCooldown('hose'), abilityDuration('hose'));
  }
  protected onActivate(host: AbilityHost): boolean {
    this.dir = host.motor.facing;
    this.puddleTimer = 0;
    this.found = 0;
    host.fx.water(this.dir, true);
    host.fx.sfx('water');
    this.wash(host);
    return true;
  }
  private wash(host: AbilityHost): void {
    const t = ABILITY_TUNING.hose;
    const m = host.motor;
    const x0 = this.dir > 0 ? m.x : m.x - t.reach;
    const x1 = this.dir > 0 ? m.x + t.reach : m.x;
    const found = host.world.revealHidden(x0, x1, m.y - t.halfDepth, m.y + t.halfDepth);
    host.world.clearLeaves(x0, x1, m.y - t.halfDepth, m.y + t.halfDepth);
    if (found > 0) {
      this.found += found;
      host.fx.say(`¡AJÁ! (${this.found})`, UI_COLORS.celeste);
    }
  }
  protected onActiveUpdate(dt: number, host: AbilityHost): void {
    const t = ABILITY_TUNING.hose;
    this.wash(host);
    this.puddleTimer -= dt;
    if (this.puddleTimer <= 0) {
      this.puddleTimer = t.puddleEvery;
      const m = host.motor;
      host.world.addPuddle(m.x + this.dir * (24 + Math.random() * (t.reach - 30)), m.y + (Math.random() * 2 - 1) * t.halfDepth);
    }
  }
  protected onEnd(host: AbilityHost | null): void {
    host?.fx.water(this.dir, false);
  }
  mods(): Partial<MotorMods> {
    return this.active ? { speed: 0.7 } : {};
  }
}

/** EL PASEADOR: los perros marcan los soretes que vienen, aunque estén escondidos. */
export class SniffAbility extends Ability {
  private refresh = 0;
  constructor() {
    super('sniff', abilityCooldown('sniff'), abilityDuration('sniff'));
  }
  protected onActivate(host: AbilityHost): boolean {
    const m = host.motor;
    const count = host.world.markHazards(m.x - 20, m.x + ABILITY_TUNING.sniff.range, this.duration);
    this.refresh = 0.5;
    host.fx.sniff(count);
    host.fx.sfx('woof');
    host.fx.say(count > 0 ? `¡GUAU! ¡CUIDADO! (${count})` : '¡GUAU! TODO LIMPIO', UI_COLORS.orange);
    return true;
  }
  protected onActiveUpdate(dt: number, host: AbilityHost): void {
    // Mientras dura, también avisan de los que aparecen más adelante.
    this.refresh -= dt;
    if (this.refresh > 0) return;
    this.refresh = 0.5;
    const m = host.motor;
    host.world.markHazards(m.x - 20, m.x + ABILITY_TUNING.sniff.range, this.activeLeft);
  }
}

/** EL POLICÍA: en una esquina, frena el tránsito y habilita el paso cuando la senda queda libre. */
export class WhistleAbility extends Ability {
  constructor() {
    super('whistle', abilityCooldown('whistle'), abilityDuration('whistle'));
  }
  protected onActivate(host: AbilityHost): boolean {
    const crossing = host.world.crossingAhead();
    if (!crossing) {
      host.fx.say('¡ACERCATE A UNA ESQUINA!', UI_COLORS.gray);
      return false;
    }
    if (!crossing.forceWalk(this.duration)) return false;
    host.fx.whistle();
    host.fx.sfx('whistle');
    host.fx.say('¡ALTO EL TRÁNSITO!', UI_COLORS.celeste);
    return true;
  }
}

export function createAbility(id: AbilityId | null): Ability | null {
  switch (id) {
    case 'dash':
      return new DashAbility();
    case 'doubleJump':
      return new DoubleJumpAbility();
    case 'turbo':
      return new TurboAbility();
    case 'sprint':
      return new SprintAbility();
    case 'broom':
      return new BroomAbility();
    case 'hose':
      return new HoseAbility();
    case 'sniff':
      return new SniffAbility();
    case 'whistle':
      return new WhistleAbility();
    default:
      return null;
  }
}

/** Combina los modificadores de varias fuentes (multiplican; "quieto" gana). */
export function combineMods(...parts: Partial<MotorMods>[]): MotorMods {
  const out: MotorMods = { speed: 1, accel: 1, decel: 1, depth: 1, frozen: false };
  for (const p of parts) {
    if (p.speed !== undefined) out.speed *= p.speed;
    if (p.accel !== undefined) out.accel *= p.accel;
    if (p.decel !== undefined) out.decel *= p.decel;
    if (p.depth !== undefined) out.depth *= p.depth;
    if (p.frozen) out.frozen = true;
  }
  return out;
}
