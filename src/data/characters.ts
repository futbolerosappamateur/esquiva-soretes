import { PLAYER_TUNING } from '../config/balance';
import type { AbilityId } from './abilities';
import type { AchievementId } from './achievements';

/**
 * Personajes jugables. Cada uno tiene estadísticas propias, una habilidad
 * especial, una ventaja pasiva y (a veces) una pequeña desventaja.
 *
 * Reglas de diseño:
 *  - Todos pueden completar todos los niveles: el camino garantizado nunca
 *    exige saltar ni usar un poder, y el verde peatonal alcanza al más lento.
 *  - Las diferencias son moderadas: estilos de juego distintos, no personajes
 *    muy superiores.
 *
 * La apariencia vive en graphics/characterLooks.ts (lookId): el controlador
 * del jugador no depende de los gráficos.
 */
export interface CharacterStats {
  walkSpeed: number;
  runSpeed: number;
  backSpeed: number;
  depthSpeed: number;
  accel: number;
  decel: number;
  /** Segundos manteniendo "avanzar" para empezar a correr. */
  runChargeTime: number;
  /** Velocidad inicial del salto (altura máxima = v² / 2g). */
  jumpVelocity: number;
  /** Control en el aire: multiplica la aceleración mientras salta (1 = igual que en el piso). */
  airControl: number;
}

export type CharacterUnlock =
  | { kind: 'starter' }
  | { kind: 'achievement'; counter: AchievementId; target: number }
  /** Personaje futuro: se muestra, se registra su desafío, pero todavía no se puede elegir. */
  | { kind: 'future'; counter: AchievementId; target: number };

export type CelebrationStyle = 'default' | 'hop' | 'trick' | 'champion';

/**
 * Animaciones de un personaje. Todas usan los nombres de cuadro del esqueleto
 * común: el arte definitivo de cada personaje (hojas `char-<look>-0..2`, ver
 * assets/manifest.ts) dibuja SU versión con esos mismos nombres, así cada uno
 * puede festejar o reaccionar a su manera sin tocar la lógica. Si falta un
 * cuadro, el juego usa `idle0` sin errores.
 */
export type CharacterAnimation = 'idle' | 'walk' | 'run' | 'jump' | 'special' | 'step' | 'disgust' | 'fall' | 'celebrate' | 'gameOver';

export const ANIMATION_FRAMES: Record<CharacterAnimation, string[]> = {
  idle: ['idle0', 'idle1', 'blink'],
  walk: ['walk0', 'walk1', 'walk2', 'walk3'],
  run: ['run0', 'run1', 'run2', 'run3'],
  jump: ['jumpPrep', 'jumpUp', 'jumpDown'],
  special: ['special0'],
  step: ['stepShock', 'stepLift'],
  disgust: ['stepLook', 'stepDisgust'],
  fall: ['dizzy'],
  celebrate: ['win0', 'win1'],
  gameOver: ['dizzy'],
};

export interface CharacterDef {
  id: string;
  name: string;
  /** Rol en una palabra o dos (EQUILIBRADO, VELOCIDAD...). */
  role: string;
  description: string;
  lookId: string;
  stats: CharacterStats;
  ability: AbilityId | null;
  passive: { name: string; description: string };
  drawback: string | null;
  unlock: CharacterUnlock;
  /** Si el diseño también aparece como NPC: qué look usa el NPC cuando este personaje es el jugador. */
  npcAltLook?: string;
  celebrate: CelebrationStyle;
  /** Perros que lo acompañan (paseador). */
  dogs?: number;
  /**
   * Animaciones propias (para el arte definitivo). Las que no figuran usan la
   * versión común. "(PENDIENTE)" = idea para los sprites definitivos; hoy se
   * ve la animación común.
   */
  animations: Partial<Record<CharacterAnimation, string>>;
}

/** Estadísticas base (las del pibe, el personaje equilibrado). */
const BASE: CharacterStats = {
  walkSpeed: PLAYER_TUNING.walkSpeed,
  runSpeed: PLAYER_TUNING.runSpeed,
  backSpeed: PLAYER_TUNING.backSpeed,
  depthSpeed: PLAYER_TUNING.depthSpeed,
  accel: PLAYER_TUNING.accel,
  decel: PLAYER_TUNING.decel,
  runChargeTime: PLAYER_TUNING.runChargeTime,
  jumpVelocity: PLAYER_TUNING.jumpVelocity,
  airControl: 1,
};

const stats = (o: Partial<CharacterStats> = {}): CharacterStats => ({ ...BASE, ...o });

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'player_default',
    name: 'EL PIBE DE LA GORRA',
    role: 'EQUILIBRADO',
    description: 'EL DE SIEMPRE: GORRA, REMERA RAYADA Y ZAPATILLAS NUEVAS. IDEAL PARA EMPEZAR.',
    lookId: 'pibe',
    stats: stats(),
    ability: 'dash',
    passive: { name: 'CONTROL EQUILIBRADO', description: 'BUENA ACELERACIÓN Y BUEN FRENADO. SIN PENALIZACIONES.' },
    drawback: null,
    unlock: { kind: 'starter' },
    celebrate: 'default',
    animations: { special: 'PASO RELÁMPAGO CON ESTELA' },
  },
  {
    id: 'player_girl',
    name: 'LA NENA DEL BARRIO',
    role: 'SALTOS',
    description: 'CONOCE CADA BALDOSA Y SALTA COMO NADIE.',
    lookId: 'piba',
    stats: stats({ walkSpeed: 72, runSpeed: 120, jumpVelocity: 230, airControl: 1.35 }),
    ability: 'doubleJump',
    passive: { name: 'PIERNAS DE RESORTE', description: 'SALTA UN POCO MÁS ALTO Y SE MANEJA MEJOR EN EL AIRE.' },
    drawback: 'CORRE UN POQUITO MÁS LENTO.',
    unlock: { kind: 'starter' },
    celebrate: 'hop',
    animations: { special: 'SEGUNDO SALTO CON NUBECITA', celebrate: 'FESTEJA SALTANDO' },
  },
  {
    id: 'player_skater',
    name: 'LA NENA DEL MONOPATÍN',
    role: 'VELOCIDAD',
    description: 'VA A TODOS LADOS EN SU MONOPATÍN ROSA. TAMBIÉN SALTA CON ÉL.',
    lookId: 'skater',
    stats: stats({ walkSpeed: 80, runSpeed: 136, accel: 900, decel: 760, runChargeTime: 0.4, airControl: 0.75 }),
    ability: 'turbo',
    passive: { name: 'IMPULSO', description: 'VELOCIDAD MÁXIMA UN POCO MAYOR Y CONSERVA EL IMPULSO.' },
    drawback: 'FRENA MÁS LARGO, SOBRE TODO DURANTE Y DESPUÉS DEL TURBO.',
    unlock: { kind: 'starter' },
    celebrate: 'trick',
    animations: {
      walk: 'SE DESLIZA EN EL MONOPATÍN',
      run: 'SE IMPULSA CON UN PIE',
      jump: 'SALTA CON EL MONOPATÍN',
      special: 'TURBO AGACHADA',
      celebrate: 'FESTEJA CON UN TRUQUITO',
    },
  },
  {
    id: 'player_runner',
    name: 'LA CORREDORA',
    role: 'CONTRARRELOJ',
    description: 'ENTRENA TODAS LAS MAÑANAS POR DEFENSA. LO SUYO ES EL CRONÓMETRO.',
    lookId: 'runner',
    stats: stats({ walkSpeed: 76, runSpeed: 130, accel: 1450, runChargeTime: 0.25 }),
    ability: 'sprint',
    passive: { name: 'RITMO DE CARRERA', description: 'RECUPERA LA VELOCIDAD ENSEGUIDA DESPUÉS DE FRENAR.' },
    drawback: 'DURANTE EL SPRINT NO JUNTA MONEDAS NI OBJETOS.',
    unlock: { kind: 'starter' },
    celebrate: 'champion',
    animations: { special: 'SPRINT', celebrate: 'FESTEJA COMO SI HUBIERA GANADO UNA CARRERA' },
  },
  {
    id: 'player_portero',
    name: 'EL PORTERO',
    role: 'LIMPIEZA',
    description: 'ROBERTO, EL PORTERO DEL EDIFICIO. CON LA ESCOBA NO HAY HOJA QUE LE GANE.',
    lookId: 'portero',
    stats: stats({ walkSpeed: 70, runSpeed: 116, accel: 1000 }),
    ability: 'broom',
    passive: { name: 'MANOS RÁPIDAS', description: 'JUNTA BASURA DESDE EL DOBLE DE DISTANCIA.' },
    drawback: 'SE QUEDA QUIETO UN INSTANTE MIENTRAS BARRE.',
    unlock: { kind: 'achievement', counter: 'trashDeposited', target: 20 },
    npcAltLook: 'portero-alt',
    celebrate: 'default',
    animations: { special: 'ESCOBAZO', disgust: 'REVISA LA SUELA DE SUS ZAPATOS (PENDIENTE)' },
  },
  {
    id: 'player_hose',
    name: 'LA VIEJA DE LA MANGUERA',
    role: 'AGUA',
    description: 'DOÑA MARTA RIEGA LA VEREDA DESDE 1974. AHORA LE TOCA CAMINARLA.',
    lookId: 'vieja',
    stats: stats({ walkSpeed: 66, runSpeed: 108, accel: 900, jumpVelocity: 200 }),
    ability: 'hose',
    passive: { name: 'A PRUEBA DE AGUA', description: 'LOS CHORROS DE LAS VECINAS QUE RIEGAN NO LA MOJAN.' },
    drawback: 'ES LA MÁS LENTA, SALTA MENOS Y SUS CHARCOS TAMBIÉN LA HACEN RESBALAR.',
    unlock: { kind: 'achievement', counter: 'waterJetsDodged', target: 15 },
    celebrate: 'default',
    animations: { special: 'MANGUERAZO', disgust: 'INTENTA LIMPIARSE LAS ZAPATILLAS CON AGUA (PENDIENTE)' },
  },
  {
    id: 'player_dogwalker',
    name: 'EL PASEADOR DE PERROS',
    role: 'OLFATO',
    description: 'NUNCA SALE CON MENOS DE DOS PERROS. ELLOS SABEN DÓNDE NO PISAR.',
    lookId: 'paseador',
    stats: stats({ walkSpeed: 72, runSpeed: 118 }),
    ability: 'sniff',
    passive: { name: 'NARICES AMIGAS', description: 'SUS PERROS AVISAN CUANDO HAY UN SORETE ESCONDIDO CERCA.' },
    drawback: 'A VECES SE LE ENREDAN LAS CORREAS Y VA MÁS LENTO.',
    unlock: { kind: 'achievement', counter: 'animalMissions', target: 10 },
    celebrate: 'default',
    animations: { special: 'LOS PERROS OLFATEAN', walk: 'CUANDO SE ENREDAN, INTENTA DESENREDAR LAS CORREAS (PENDIENTE)' },
    dogs: 2,
  },
  {
    id: 'player_police',
    name: 'EL POLICÍA',
    role: 'CRUCES',
    description: 'EL AGENTE DE LA ESQUINA. CON UN SILBATAZO, EL TRÁNSITO OBEDECE.',
    lookId: 'policia',
    stats: stats({ walkSpeed: 72, runSpeed: 122, decel: 1600, jumpVelocity: 205 }),
    ability: 'whistle',
    passive: { name: 'OJO DE AGENTE', description: 'LOS AUTOS LE TOCAN BOCINA DESDE MÁS LEJOS.' },
    drawback: 'CON EL UNIFORME SALTA UN POCO MENOS.',
    unlock: { kind: 'achievement', counter: 'safeCrossings', target: 25 },
    celebrate: 'default',
    animations: { special: 'SILBATAZO CON EL BRAZO EN ALTO' },
  },
  {
    id: 'player_neighbor',
    name: 'EL VECINO DESCONFIADO',
    role: 'PRÓXIMAMENTE',
    description: 'DON TITO NO LE CREE A NADIE. SU HABILIDAD TODAVÍA ESTÁ EN DISCUSIÓN.',
    lookId: 'neighbor',
    stats: stats({ walkSpeed: 68, runSpeed: 112 }),
    ability: null,
    passive: { name: 'PRÓXIMAMENTE', description: 'TODAVÍA NO ESTÁ DEFINIDA.' },
    drawback: null,
    unlock: { kind: 'future', counter: 'flawlessNightLevels', target: 1 },
    celebrate: 'default',
    animations: {},
  },
];

export const DEFAULT_CHARACTER_ID = 'player_default';
export const STARTER_CHARACTERS = CHARACTERS.filter((c) => c.unlock.kind === 'starter').map((c) => c.id);

export function getCharacter(id: string | null | undefined): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/** Personaje que ya se puede elegir (los futuros nunca, aunque cumplan el desafío). */
export function isPlayable(def: CharacterDef): boolean {
  return def.unlock.kind !== 'future' && def.ability !== null;
}

/**
 * Look que debe usar un NPC con el diseño `npcLookId` para no ser idéntico al
 * personaje que maneja el jugador.
 */
export function npcLookFor(npcLookId: string, playerCharacterId: string): string {
  const player = getCharacter(playerCharacterId);
  if (player.lookId === npcLookId && player.npcAltLook) return player.npcAltLook;
  return npcLookId;
}

/** Barras de 1 a 5 para la pantalla de selección (velocidad, salto y control). */
export function statBars(s: CharacterStats): { speed: number; jump: number; control: number } {
  const bar = (v: number, lo: number, hi: number) => Math.max(1, Math.min(5, Math.round(1 + ((v - lo) / (hi - lo)) * 4)));
  return {
    speed: bar(s.runSpeed, 104, 138),
    jump: bar(s.jumpVelocity, 196, 232),
    // Control: aceleración + manejo en el aire + frenado (más frenado = más control).
    control: bar(s.accel / 1100 + s.airControl + (s.decel / 1500) * 0.5, 1.8, 2.9),
  };
}
