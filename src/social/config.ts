/**
 * Configuración del modo online (Supabase). Sale de variables de entorno de
 * Vite (archivo .env.local, ver .env.example y docs/ONLINE.md):
 *
 *   VITE_SUPABASE_URL              URL del proyecto (https://xxxx.supabase.co)
 *   VITE_SUPABASE_PUBLISHABLE_KEY  clave PUBLICABLE (sb_publishable_…) o la
 *                                  "anon public" de los proyectos viejos
 *
 * Sin estas variables el juego funciona en MODO LOCAL, como siempre.
 *
 * NUNCA va acá la clave secreta (sb_secret_…) ni la "service_role": todo lo
 * que empieza con VITE_ termina dentro del juego publicado y cualquiera la
 * puede leer. Si alguien la pone por error, el modo online no arranca.
 */

export interface OnlineConfig {
  configured: boolean;
  url: string;
  key: string;
  /** Por qué no se activó el modo online (para la consola y la documentación). */
  problem: 'missing' | 'bad_url' | 'secret_key' | null;
}

type EnvLike = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_ANON_KEY', string | undefined>>;

/** ¿Es una clave secreta (que jamás debe estar en el navegador)? */
export function looksSecret(key: string): boolean {
  if (/^sb_secret_/i.test(key)) return true;
  // Claves viejas con formato JWT: la de servicio declara role "service_role".
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role === 'service_role';
  } catch {
    return false;
  }
}

export function readOnlineConfig(env: EnvLike): OnlineConfig {
  const url = (env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
  const off = (problem: OnlineConfig['problem']): OnlineConfig => ({ configured: false, url: '', key: '', problem });
  if (!url || !key) return off('missing');
  if (!/^https:\/\/[^\s/]+$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return off('bad_url');
  if (looksSecret(key)) return off('secret_key');
  return { configured: true, url, key, problem: null };
}

export const ONLINE_CONFIG: OnlineConfig = readOnlineConfig(import.meta.env as EnvLike);

if (ONLINE_CONFIG.problem === 'secret_key') {
  console.error('[online] La clave configurada es SECRETA: no se usa. Poné la clave publicable (sb_publishable_…). Ver docs/ONLINE.md.');
} else if (ONLINE_CONFIG.problem === 'bad_url') {
  console.error('[online] VITE_SUPABASE_URL no es una URL válida (https://xxxx.supabase.co). Ver docs/ONLINE.md.');
}

/** Versión de las condiciones que acepta el adulto al crear la cuenta. */
export const TERMS_VERSION = '1';

/** Versión del juego que se manda con cada partida (diagnóstico). */
export const CLIENT_VERSION = `web-${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`;
