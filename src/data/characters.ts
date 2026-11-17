/**
 * Personajes seleccionables. Por ahora todos comparten las mismas capacidades
 * físicas (velocidad, salto y resistencia): la diferencia es sólo visual.
 *
 * Cada personaje se identifica por su id y apunta a un "look" (su apariencia
 * en graphics/characterLooks.ts). El controlador del jugador no sabe nada de
 * la apariencia, así que el mismo diseño puede usarse como NPC en el
 * escenario (con `npcLook`, una variante de vestuario para no confundirlo con
 * el jugador cuando se lo elige).
 */
export type CharacterUnlock = { kind: 'starter' } | { kind: 'coins'; cost: number };

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  lookId: string;
  unlock: CharacterUnlock;
  /** Si el diseño también aparece como NPC: qué look usa el NPC cuando este personaje es el jugador. */
  npcAltLook?: string;
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'player_default', name: 'EL PIBE', description: 'REMERA RAYADA Y ZAPATILLAS NUEVAS.', lookId: 'pibe', unlock: { kind: 'starter' } },
  { id: 'player_girl', name: 'LA PIBA', description: 'COLITA, CAMPERA VIOLETA Y CERO MIEDO.', lookId: 'piba', unlock: { kind: 'starter' } },
  { id: 'player_runner', name: 'LA CORREDORA', description: 'VINCHA, CALZAS Y RITMO DE MARATÓN.', lookId: 'runner', unlock: { kind: 'starter' } },
  { id: 'player_neighbor', name: 'DON TITO', description: 'EL VECINO DE TODA LA VIDA. BIGOTE Y CÁRDIGAN.', lookId: 'neighbor', unlock: { kind: 'starter' } },
  {
    id: 'player_portero',
    name: 'ROBERTO',
    description: 'EL PORTERO DEL EDIFICIO. CONOCE CADA BALDOSA.',
    lookId: 'portero',
    unlock: { kind: 'coins', cost: 120 },
    npcAltLook: 'portero-alt',
  },
];

export const DEFAULT_CHARACTER_ID = 'player_default';
export const STARTER_CHARACTERS = CHARACTERS.filter((c) => c.unlock.kind === 'starter').map((c) => c.id);

export function getCharacter(id: string | null | undefined): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
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
