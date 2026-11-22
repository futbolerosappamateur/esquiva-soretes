import { PGlite } from '@electric-sql/pglite';
import SUPABASE_SHIM from '../../scripts/online-sandbox/supabase-shim.sql?raw';

/**
 * Base de datos de prueba: PostgreSQL real (PGlite, en memoria) con lo
 * mínimo de Supabase que usan las migraciones (ver supabase-shim.sql) y
 * todas las migraciones del proyecto, en orden.
 */
export { SUPABASE_SHIM };

const MIGRATIONS = import.meta.glob('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Migraciones en orden: [nombre de archivo, SQL]. */
export function migrations(): [string, string][] {
  return Object.keys(MIGRATIONS)
    .sort()
    .map((k) => [k.split('/').pop()!, MIGRATIONS[k]]);
}

type Role = 'anon' | 'authenticated' | 'service_role';

export class SupabaseTestDb {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly pg: PGlite) {}

  static async create(): Promise<SupabaseTestDb> {
    const pg = new PGlite();
    await pg.exec(SUPABASE_SHIM);
    for (const [, sql] of migrations()) await pg.exec(sql);
    return new SupabaseTestDb(pg);
  }

  /** Ejecuta en orden (PGlite tiene una sola conexión). */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Consulta como superusuario (preparación y verificación de las pruebas). */
  sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
    return this.serial(async () => (await this.pg.query<T>(query, params)).rows);
  }

  async createUser(email = `u${Math.random().toString(36).slice(2)}@test.local`): Promise<string> {
    const [row] = await this.sql<{ id: string }>('insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id', [email]);
    return row.id;
  }

  /** Consulta con el rol y la identidad de un cliente de Supabase. */
  as<T = Record<string, unknown>>(role: Role, uid: string | null, query: string, params: unknown[] = []): Promise<T[]> {
    return this.serial(async () => {
      const claims = uid ? JSON.stringify({ sub: uid, role }) : JSON.stringify({ role });
      await this.pg.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
      await this.pg.exec(`set role ${role}`);
      try {
        return (await this.pg.query<T>(query, params)).rows;
      } finally {
        await this.pg.exec('reset role');
        await this.pg.query(`select set_config('request.jwt.claims', '', false)`);
      }
    });
  }

  /** Llama a una función RPC como lo haría PostgREST (parámetros con nombre). */
  async rpc<T = unknown>(uid: string | null, fn: string, args: Record<string, unknown> = {}, role?: Role): Promise<T> {
    const keys = Object.keys(args);
    const params = keys.map((k) => {
      const v = args[k];
      return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v;
    });
    const call = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as result`;
    const rows = await this.as<{ result: T }>(role ?? (uid ? 'authenticated' : 'anon'), uid, call, params);
    return rows[0].result;
  }

  close(): Promise<void> {
    return this.pg.close();
  }
}

/** Mensaje del error de una promesa (o '' si no falló). */
export async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}
