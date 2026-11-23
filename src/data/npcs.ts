import type { BehaviorSpec } from '../npc/behaviors';

/**
 * Personajes secundarios y animales. Cada uno combina comportamientos y una
 * apariencia (look). Los que tienen `ready: false` están definidos pero
 * todavía no tienen sprites: se suman cuando lleguen las ilustraciones.
 */
export interface NpcDef {
  id: string;
  name: string;
  kind: 'person' | 'animal';
  /** Apariencia (para personas, un look de graphics/characterLooks.ts). */
  look: string;
  behaviors: BehaviorSpec[];
  /** Si su lógica y sus gráficos ya están listos para aparecer en los niveles. */
  ready: boolean;
  /** Personaje jugable que comparte este diseño (si lo hay). */
  playableAs?: string;
}

export const NPC_DEFS: Record<string, NpcDef> = {
  portero: {
    id: 'portero',
    name: 'ROBERTO, EL PORTERO',
    kind: 'person',
    look: 'portero',
    ready: true,
    playableAs: 'player_portero',
    behaviors: [
      { kind: 'loopAction', anim: 'sweep', drift: 14 },
      {
        kind: 'missionGiver',
        missionId: 'trash-to-bin',
        radius: 70,
        offer: '¡EH, PIBE! ¿ME DAS UNA MANO? JUNTÁ ESA BASURA Y TIRALA EN EL TACHO.',
        reminder: '¡EL TACHO ESTÁ ANTES DE LA ESQUINA!',
        thanks: '¡GRACIAS! ¡ASÍ DA GUSTO BARRER!',
      },
    ],
  },
  duenaPerro: {
    id: 'duenaPerro',
    name: 'LA DUEÑA DE TOBY',
    kind: 'person',
    look: 'duena',
    ready: true,
    behaviors: [
      { kind: 'idle' },
      { kind: 'react', radius: 190, phrases: ['¡TOBYYY! ¿DÓNDE TE METISTE?', '¡TOBY! ¡VENÍ, TOBY!'], cooldown: 6 },
      {
        kind: 'missionGiver',
        missionId: 'lost-dog',
        radius: 80,
        offer: '¿VISTE A MI PERRITO? ¡SE ME ESCAPÓ!',
        reminder: '¡ESE ES MI TOBY! ¡TRAÉMELO!',
        thanks: '¡TOBY! ¡GRACIAS, GRACIAS!',
      },
    ],
  },
  // La vecina que riega: su chorro lo maneja systems/WaterJetSystem.ts
  // (lógica pura en world/sprinkler.ts); estos datos quedan como ficha.
  senoraRegando: {
    id: 'senoraRegando',
    name: 'LA SEÑORA QUE RIEGA LA VEREDA',
    kind: 'person',
    look: 'senora',
    ready: false,
    behaviors: [
      { kind: 'loopAction', anim: 'water' },
      { kind: 'react', radius: 30, phrases: ['¡CUIDADO QUE MOJA!', '¡NO PISES LO MOJADO, NENE!'], emote: 'alert' },
    ],
  },
  paseador: {
    id: 'paseador',
    name: 'EL PASEADOR DE PERROS',
    kind: 'person',
    look: 'paseador',
    ready: false,
    behaviors: [
      { kind: 'patrol', speed: 22, range: 160 },
      { kind: 'obstacleSpawner', obstacle: 'poop', interval: 9, offsetX: 26 },
    ],
  },
  policia: { id: 'policia', name: 'EL POLICÍA DE LA ESQUINA', kind: 'person', look: 'policia', ready: false, behaviors: [{ kind: 'idle' }, { kind: 'react', radius: 36, phrases: ['¡CRUCE POR LA SENDA, JOVEN!'] }] },
  vecinoDesconfiado: {
    id: 'vecinoDesconfiado',
    name: 'EL VECINO DESCONFIADO',
    kind: 'person',
    look: 'vecino',
    ready: false,
    behaviors: [{ kind: 'idle' }, { kind: 'react', radius: 34, phrases: ['¿Y VOS QUIÉN SOS?', 'TE ESTOY MIRANDO, ¿EH?'], emote: 'angry' }],
  },
  barrendero: { id: 'barrendero', name: 'EL BARRENDERO', kind: 'person', look: 'barrendero', ready: false, behaviors: [{ kind: 'loopAction', anim: 'sweep', drift: 40 }] },
  peaton: { id: 'peaton', name: 'PEATÓN', kind: 'person', look: 'peaton', ready: false, behaviors: [{ kind: 'patrol', speed: 18, range: 200 }] },
  perro: { id: 'perro', name: 'PERRO', kind: 'animal', look: 'perro', ready: false, behaviors: [{ kind: 'patrol', speed: 30, range: 80 }] },
  gato: { id: 'gato', name: 'GATO', kind: 'animal', look: 'gato', ready: false, behaviors: [{ kind: 'idle' }] },
  rata: { id: 'rata', name: 'RATA', kind: 'animal', look: 'rata', ready: false, behaviors: [{ kind: 'patrol', speed: 60, range: 40 }] },
  paloma: { id: 'paloma', name: 'PALOMA', kind: 'animal', look: 'paloma', ready: false, behaviors: [{ kind: 'idle' }] },
  cucaracha: { id: 'cucaracha', name: 'CUCARACHA', kind: 'animal', look: 'cucaracha', ready: false, behaviors: [{ kind: 'patrol', speed: 40, range: 20 }] },
};
