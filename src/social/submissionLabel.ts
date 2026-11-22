import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { online } from './onlineSession';

/**
 * Línea de estado online para las pantallas de resultados: enviando, sin
 * conexión, verificado con su puesto, en revisión... null = no mostrar nada
 * (modo online sin configurar, o partida perdida de un perfil local).
 */
export function submissionLabel(onlineRunId: string | null, completed: boolean): { text: string; color: number } | null {
  const o = TEXTS2.online;
  if (!online.configured) return null;
  if (!onlineRunId) {
    if (!completed) return null;
    if (online.status === 'signedIn') return { text: o.localProfileHint, color: UI_COLORS.gray };
    if (online.status === 'signedOut') return { text: o.guestHint, color: UI_COLORS.gray };
    return null;
  }
  const s = online.submission(onlineRunId);
  switch (s?.state ?? 'sending') {
    case 'sending':
      return { text: o.sending, color: UI_COLORS.gray };
    case 'queued':
      return { text: o.queued, color: UI_COLORS.orange };
    case 'waitingLogin':
      return { text: o.waitingLogin, color: UI_COLORS.orange };
    case 'error':
      return { text: o.error, color: UI_COLORS.red };
  }
  const r = s!.result!;
  if (r.status === 'rejected') return { text: o.rejected, color: UI_COLORS.red };
  if (r.status === 'suspicious') return { text: o.suspicious, color: UI_COLORS.orange };
  if (!completed) return { text: o.savedNotRanked, color: UI_COLORS.cream };
  if (!r.official) return { text: o.assisted, color: UI_COLORS.cream };
  if (r.ranks.speed === null) return { text: o.hiddenProfile, color: UI_COLORS.cream };
  return { text: `${o.verified} · ${o.rank} ${r.ranks.speed} ${o.globalWord} EN VELOCIDAD`, color: UI_COLORS.green };
}
