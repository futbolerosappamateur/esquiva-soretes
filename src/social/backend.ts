import type { OnlineConfig } from './config';

/**
 * Conexión con el servidor online. El resto del juego no conoce Supabase:
 * habla con esta interfaz (así se puede probar con un servidor falso o
 * cambiar de proveedor sin tocar las escenas).
 *
 * La librería de Supabase se carga recién cuando hace falta (import
 * dinámico): en modo local no se descarga.
 */

/** Error con un código estable (los mismos que lanzan las funciones SQL). */
export class SocialError extends Error {
  constructor(
    readonly code: string,
    message?: string,
    /** true = problema de conexión: vale la pena reintentar más tarde. */
    readonly retryable = false,
  ) {
    super(message ?? code);
    this.name = 'SocialError';
  }
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthEventName = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'MFA_CHALLENGE_VERIFIED';

export interface SocialBackend {
  currentUser(): Promise<AuthUser | null>;
  onAuthChange(listener: (event: AuthEventName, user: AuthUser | null) => void): () => void;
  /** needsConfirmation: hay que confirmar el correo antes de poder entrar. */
  signUp(email: string, password: string, redirectTo: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>;
}

const NETWORK_RE = /fetch|network|load failed|timeout|abort|ECONN|ENOTFOUND|socket/i;

/** Convierte cualquier error (Supabase, red, etc.) en un SocialError. */
export function toSocialError(e: unknown, status?: number): SocialError {
  if (e instanceof SocialError) return e;
  const err = (e ?? {}) as { message?: string; code?: string; status?: number; name?: string };
  const message = String(err.message ?? e ?? 'error');
  const st = status ?? err.status;
  if (st === 0 || (st !== undefined && st >= 500) || (!err.code && NETWORK_RE.test(message)) || err.name === 'AuthRetryableFetchError') {
    return new SocialError('network', message, true);
  }
  // Las funciones SQL lanzan códigos como 'nickname_taken' o 'invalid_payload'.
  if (/^[a-z_]+$/.test(message)) return new SocialError(message, message);
  // Errores de PostgREST: función inexistente = faltan las migraciones.
  if (err.code === 'PGRST202' || err.code === '42883') return new SocialError('server_not_ready', message);
  if (err.code === '42501' || st === 401 || st === 403) return new SocialError('forbidden', message);
  // Errores de Supabase Auth (traen un código: invalid_credentials, user_already_exists...).
  if (err.code && /^[a-z_]+$/.test(err.code)) return new SocialError(err.code, message);
  return new SocialError('unknown', message);
}

export async function createSupabaseBackend(config: OnlineConfig): Promise<SocialBackend> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Los enlaces de confirmación y de nueva contraseña vuelven al juego con la sesión.
      detectSessionInUrl: true,
      storageKey: 'esquivaSoretes:auth',
    },
  });
  const userOf = (u: { id: string; email?: string | null } | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email ?? null } : null);
  /** Ejecuta una llamada de Supabase y convierte cualquier falla en SocialError. */
  const call = async <R extends { error: unknown }>(task: () => PromiseLike<R>): Promise<R> => {
    let res: R;
    try {
      res = await task();
    } catch (e) {
      throw toSocialError(e);
    }
    if (res.error) throw toSocialError(res.error, (res as { status?: number }).status);
    return res;
  };

  return {
    async currentUser() {
      const { data } = await client.auth.getSession();
      return userOf(data.session?.user);
    },
    onAuthChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => listener(event as AuthEventName, userOf(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password, redirectTo) {
      const res = await call(() => client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } }));
      // Sin sesión = falta confirmar el correo (o el correo ya existía: Supabase no lo revela).
      return { needsConfirmation: !res.data.session };
    },
    async signIn(email, password) {
      await call(() => client.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      await call(() => client.auth.signOut());
    },
    async requestPasswordReset(email, redirectTo) {
      await call(() => client.auth.resetPasswordForEmail(email, { redirectTo }));
    },
    async updatePassword(password) {
      await call(() => client.auth.updateUser({ password }));
    },
    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      const res = await call(() => client.rpc(fn, args));
      return res.data as T;
    },
  };
}
