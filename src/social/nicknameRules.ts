/**
 * Reglas de los apodos públicos del modo online.
 *
 * El servidor aplica exactamente la misma regla (private.nickname_problem en
 * supabase/migrations): esta copia sirve para avisar al instante mientras se
 * escribe. La lista de palabras se exporta a la base con `npm run
 * online:rules` y las pruebas comparan las dos implementaciones.
 *
 * Es un filtro básico: siempre puede colarse algo, por eso existe la opción
 * de reportar apodos inapropiados.
 */

export const ONLINE_NICK_MIN = 3;
export const ONLINE_NICK_MAX = 10;
const PATTERN = /^[A-Z0-9ÑÁÉÍÓÚÜ ]{3,10}$/;
const HAS_LETTER = /[A-ZÑÁÉÍÓÚÜ]/;

export type NicknameProblem = 'nickname_invalid' | 'nickname_banned';

export interface BannedWord {
  word: string;
  /**
   * exact: una palabra del apodo (o el apodo entero sin espacios) es igual a
   * la palabra o a su plural con S. contains: aparece en cualquier parte del
   * apodo sin espacios.
   */
  match: 'exact' | 'contains';
}

const exact = (...words: string[]): BannedWord[] => words.map((word) => ({ word, match: 'exact' }));
const contains = (...words: string[]): BannedWord[] => words.map((word) => ({ word, match: 'contains' }));

/** Palabras normalizadas: mayúsculas, sin acentos (la Ñ se mantiene). */
export const BANNED_WORDS: BannedWord[] = [
  // Insultos y groserías (castellano rioplatense).
  ...exact('PUTO', 'PUTA', 'PIJA', 'ORTO', 'CULO', 'CULON', 'TETA', 'PENE', 'SEXO', 'SEXY', 'MARICA', 'NAZI'),
  ...contains(
    'PUTITO', 'PUTITA', 'PUTAZO', 'PUTAMADRE', 'TROLO', 'TROLA', 'MARICON', 'CONCHA', 'CHOTA', 'VERGA', 'CULIAO', 'CULEAR',
    'FORRO', 'FORRA', 'PELOTUDO', 'PELOTUDA', 'BOLUDO', 'BOLUDA', 'TARADO', 'TARADA', 'MOGOLICO', 'MOGOLICA', 'RETRASADO',
    'RETRASADA', 'IDIOTA', 'ESTUPIDO', 'ESTUPIDA', 'IMBECIL', 'PENDEJO', 'PENDEJA', 'CABRON', 'MIERDA', 'PAJERO', 'PAJERA',
    'GARCHA', 'COGER', 'COGIENDO', 'PORNO', 'VIOLAR', 'VIOLADOR', 'VIOLACION', 'HITLER', 'SIDOSO', 'VILLERO', 'VAGINA',
  ),
  // Inglés.
  ...exact('SEX', 'DICK', 'COCK', 'CUNT', 'SLUT', 'RAPE', 'PORN', 'FAG'),
  ...contains('FUCK', 'SHIT', 'BITCH', 'PUSSY', 'NIGGER', 'NIGGA', 'FAGGOT', 'WHORE'),
  // Nombres reservados (evitan confusiones o hacerse pasar por el equipo).
  ...exact('ADMIN', 'MODERADOR', 'MODERADORA', 'SOPORTE', 'OFICIAL', 'STAFF', 'INVITADO', 'INVITADA', 'JUGADOR', 'JUGADORA', 'ANONIMO'),
];

/** Clave de unicidad: sin acentos (salvo la Ñ) y con espacios simples. */
export function nicknameKey(nick: string): string {
  return nick
    .trim()
    .replace(/[ÁÉÍÓÚÜ]/g, (c) => ({ Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ü: 'U' })[c] ?? c)
    .replace(/\s+/g, ' ');
}

const LEET: Record<string, string> = { '0': 'O', '1': 'I', '3': 'E', '4': 'A', '5': 'S', '7': 'T' };

/** null si el apodo se puede usar; si no, el motivo (los mismos códigos que el servidor). */
export function nicknameProblem(nick: string, banned: readonly BannedWord[] = BANNED_WORDS): NicknameProblem | null {
  if (!PATTERN.test(nick) || nick !== nick.trim() || nick.includes('  ') || !HAS_LETTER.test(nick)) return 'nickname_invalid';
  const norm = nicknameKey(nick).replace(/[013457]/g, (c) => LEET[c]);
  const compact = norm.replace(/ /g, '');
  const tokens = norm.split(' ');
  for (const { word, match } of banned) {
    if (match === 'contains') {
      if (compact.includes(word)) return 'nickname_banned';
    } else if ([compact, ...tokens].some((t) => t === word || t === `${word}S`)) {
      return 'nickname_banned';
    }
  }
  return null;
}

/** Limpia lo que se escribe en el campo del apodo (mayúsculas, caracteres válidos). */
export function cleanNicknameInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9ÑÁÉÍÓÚÜ ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^ /, '')
    .slice(0, ONLINE_NICK_MAX);
}
