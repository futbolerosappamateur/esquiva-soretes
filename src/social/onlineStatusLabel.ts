import { UI_COLORS } from '../config/palette';
import { TEXTS2 } from '../config/texts';
import { saveStore } from '../core/save';
import { online } from './onlineSession';

/** Estado online para mostrar en el menú: modo local, invitado, conectado, sin conexión... */
export function onlineStatusLabel(): { text: string; color: number } {
  const t = TEXTS2.online;
  const link = saveStore.activeProfile().online;
  switch (online.status) {
    case 'disabled':
      return { text: t.local, color: UI_COLORS.gray };
    case 'starting':
      return { text: t.connecting, color: UI_COLORS.gray };
    case 'offline':
      return link ? { text: t.offline, color: UI_COLORS.orange } : { text: t.local, color: UI_COLORS.gray };
    case 'signedOut':
      return link ? { text: t.noSession, color: UI_COLORS.orange } : { text: t.guest, color: UI_COLORS.cream };
    case 'signedIn':
      if (!link) return { text: t.localProfile, color: UI_COLORS.orange };
      if (link.accountId !== online.user?.id) return { text: t.otherAccount, color: UI_COLORS.orange };
      return { text: t.connected, color: UI_COLORS.green };
  }
}
