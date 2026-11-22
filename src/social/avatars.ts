/**
 * Avatares del perfil online: personajes y vecinos del juego dibujados con
 * los mismos gráficos (nada de fotos personales). Sólo datos: el dibujo vive
 * en social/ui/avatarImages.ts. Los ids se exportan a la base de datos con
 * `npm run online:rules` (no cambiarlos: quedan guardados en los perfiles).
 */
export interface AvatarDef {
  id: string;
  label: string;
  /** Apariencia de graphics/characterLooks.ts, o null para la mascota. */
  lookId: string | null;
}

export const AVATARS: AvatarDef[] = [
  { id: 'pibe', label: 'EL PIBE', lookId: 'pibe' },
  { id: 'piba', label: 'LA NENA', lookId: 'piba' },
  { id: 'skater', label: 'MONOPATÍN', lookId: 'skater' },
  { id: 'runner', label: 'CORREDORA', lookId: 'runner' },
  { id: 'portero', label: 'PORTERO', lookId: 'portero' },
  { id: 'vieja', label: 'LA VIEJA', lookId: 'vieja' },
  { id: 'paseador', label: 'PASEADOR', lookId: 'paseador' },
  { id: 'policia', label: 'POLICÍA', lookId: 'policia' },
  { id: 'vecino', label: 'VECINO', lookId: 'neighbor' },
  { id: 'senora', label: 'SEÑORA', lookId: 'senora' },
  { id: 'duena', label: 'DUEÑA', lookId: 'duena' },
  { id: 'soretito', label: 'SORETITO', lookId: null },
];

export const DEFAULT_AVATAR_ID = 'pibe';

export function getAvatar(id: string | null | undefined): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
