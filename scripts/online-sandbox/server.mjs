// Servidor online de PRUEBA (sandbox) para desarrollar sin un proyecto de Supabase.
//
//   npm run online:sandbox              → base en memoria (se borra al cerrar)
//   npm run online:sandbox -- --persist → guarda los datos en .online-sandbox/
//   npm run dev:sandbox                 → (otra terminal) el juego usando este servidor
//
// Imita sólo lo que usa el juego: las cuentas (Supabase Auth: crear cuenta,
// entrar, renovar la sesión, salir) y las llamadas a funciones RPC (PostgREST).
// Las funciones son las REALES: corre las migraciones de supabase/migrations
// en un PostgreSQL local (PGlite), con los mismos roles y permisos.
//
// No es para producción: no manda correos (las cuentas se confirman solas),
// guarda las contraseñas en esta base local y acepta cualquier clave pública.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const PORT = Number(argValue('--port') ?? process.env.SANDBOX_PORT ?? 54321);
const PERSIST = args.includes('--persist');
const QUIET = args.includes('--quiet');
const JWT_SECRET = 'esquiva-soretes-sandbox';
const log = (...m) => {
  if (!QUIET) console.log('[sandbox]', ...m);
};

// ------------------------------------------------------------------ base

const db = new PGlite(PERSIST ? path.join(root, '.online-sandbox') : undefined);
let queue = Promise.resolve();
/** PGlite tiene una sola conexión: todo pasa en orden. */
const serial = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

async function setup() {
  const [{ exists }] = (await db.query(`select exists (select 1 from pg_namespace where nspname = 'auth') as exists`)).rows;
  if (!exists) await db.exec(fs.readFileSync(path.join(here, 'supabase-shim.sql'), 'utf8'));
  await db.exec(`
    create schema if not exists sandbox;
    create table if not exists sandbox.migrations (name text primary key, applied_at timestamptz not null default now());
    create table if not exists sandbox.credentials (user_id uuid primary key references auth.users (id) on delete cascade, salt text not null, hash text not null);
    create table if not exists sandbox.refresh_tokens (token text primary key, user_id uuid not null references auth.users (id) on delete cascade, created_at timestamptz not null default now());
  `);
  const dir = path.join(root, 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
  for (const f of files) {
    const done = (await db.query('select 1 from sandbox.migrations where name = $1', [f])).rows.length > 0;
    if (done) continue;
    await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    await db.query('insert into sandbox.migrations (name) values ($1)', [f]);
    log(`migración aplicada: ${f}`);
  }
}

// ------------------------------------------------------------------ JWT

const b64url = (buf) => Buffer.from(buf).toString('base64url');
function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (sig !== parts[2]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- cuentas

const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 32).toString('hex');

function userJson(u) {
  const created = new Date(u.created_at).toISOString();
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: created,
    confirmed_at: created,
    phone: '',
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: created,
    updated_at: created,
    is_anonymous: false,
  };
}

async function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const access = signJwt({
    aud: 'authenticated',
    exp,
    iat: now,
    iss: `http://127.0.0.1:${PORT}/auth/v1`,
    sub: user.id,
    email: user.email,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: now }],
    session_id: crypto.randomUUID(),
    is_anonymous: false,
  });
  const refresh = crypto.randomBytes(24).toString('base64url');
  await serial(() => db.query('insert into sandbox.refresh_tokens (token, user_id) values ($1, $2)', [refresh, user.id]));
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh, user: userJson(user) };
}

const authError = (status, code, msg) => ({ status, body: { code: status, error_code: code, msg } });
const findUserByEmail = async (email) => (await serial(() => db.query('select * from auth.users where email = $1', [email]))).rows[0];
const findUserById = async (id) => (await serial(() => db.query('select * from auth.users where id = $1', [id]))).rows[0];

async function handleAuth(method, route, query, body, bearer) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (method === 'POST' && route === 'signup') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError(400, 'email_address_invalid', 'Unable to validate email address: invalid format');
    if (typeof body.password !== 'string' || body.password.length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters.');
    if (await findUserByEmail(email)) return authError(422, 'user_already_exists', 'User already registered');
    const salt = crypto.randomBytes(12).toString('hex');
    const user = (
      await serial(async () => {
        const u = (await db.query('insert into auth.users (id, email) values (gen_random_uuid(), $1) returning *', [email])).rows[0];
        await db.query('insert into sandbox.credentials (user_id, salt, hash) values ($1, $2, $3)', [u.id, salt, hashPassword(body.password, salt)]);
        return u;
      })
    );
    log(`cuenta creada: ${email}`);
    return { status: 200, body: await sessionFor(user) };
  }
  if (method === 'POST' && route === 'token' && query.get('grant_type') === 'password') {
    const user = await findUserByEmail(email);
    const cred = user && (await serial(() => db.query('select * from sandbox.credentials where user_id = $1', [user.id]))).rows[0];
    if (!cred || hashPassword(String(body.password ?? ''), cred.salt) !== cred.hash) return authError(400, 'invalid_credentials', 'Invalid login credentials');
    return { status: 200, body: await sessionFor(user) };
  }
  if (method === 'POST' && route === 'token' && query.get('grant_type') === 'refresh_token') {
    const row = (await serial(() => db.query('delete from sandbox.refresh_tokens where token = $1 returning user_id', [String(body.refresh_token ?? '')]))).rows[0];
    const user = row && (await findUserById(row.user_id));
    if (!user) return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
    return { status: 200, body: await sessionFor(user) };
  }
  if (route === 'user' && (method === 'GET' || method === 'PUT')) {
    const claims = verifyJwt(bearer);
    const user = claims && (await findUserById(claims.sub));
    if (!user) return authError(401, 'bad_jwt', 'invalid JWT');
    if (method === 'PUT' && typeof body.password === 'string') {
      if (body.password.length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters.');
      const salt = crypto.randomBytes(12).toString('hex');
      await serial(() => db.query('update sandbox.credentials set salt = $2, hash = $3 where user_id = $1', [user.id, salt, hashPassword(body.password, salt)]));
    }
    return { status: 200, body: userJson(user) };
  }
  if (method === 'POST' && route === 'logout') return { status: 204, body: null };
  if (method === 'POST' && route === 'recover') {
    log(`(no se manda ningún correo) pedido de contraseña nueva para ${email}`);
    return { status: 200, body: {} };
  }
  if (method === 'GET' && (route === 'settings' || route === 'health')) return { status: 200, body: { external: { email: true }, mailer_autoconfirm: true } };
  return authError(404, 'not_found', 'not found');
}

// ------------------------------------------------------------- RPC

const IDENT = /^[a-z_][a-z0-9_]*$/;
async function handleRpc(fn, body, bearer, apikey) {
  if (!apikey) return { status: 401, body: { message: 'No API key found in request' } };
  if (!IDENT.test(fn)) return { status: 404, body: { code: 'PGRST202', message: 'function not found' } };
  const claims = bearer && bearer !== apikey ? verifyJwt(bearer) : null;
  if (bearer && bearer !== apikey && !claims) return { status: 401, body: { code: 'PGRST301', message: 'JWT expired or invalid' } };
  const role = claims ? 'authenticated' : 'anon';
  const keys = Object.keys(body ?? {}).filter((k) => IDENT.test(k));
  const params = keys.map((k) => {
    const v = body[k];
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v;
  });
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as result`;
  return serial(async () => {
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims ?? { role: 'anon' })]);
    await db.exec(`set role ${role}`);
    try {
      const res = await db.query(sql, params);
      return { status: 200, body: res.rows[0]?.result ?? null };
    } catch (e) {
      const status = e.code === '42501' ? 403 : e.code === '42883' ? 404 : 400;
      return { status, body: { code: e.code === '42883' ? 'PGRST202' : e.code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null } };
    } finally {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claims', '', false)`);
    }
  });
}

// ------------------------------------------------------------- HTTP

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, accept-profile, content-profile, prefer, x-supabase-api-version, range',
  'Access-Control-Expose-Headers': 'content-range, x-supabase-api-version',
  'Access-Control-Max-Age': '600',
};

const server = http.createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { ...CORS, ...(body === null ? {} : { 'Content-Type': 'application/json' }) });
    res.end(body === null ? undefined : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204, null);
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
      const raw = Buffer.concat(chunks).toString('utf8');
      let body = {};
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          return send(400, { message: 'JSON inválido' });
        }
      }
      const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null;
      const apikey = req.headers.apikey ?? null;
      let out;
      if (url.pathname.startsWith('/auth/v1/')) out = await handleAuth(req.method, url.pathname.slice('/auth/v1/'.length), url.searchParams, body, bearer);
      else if (url.pathname.startsWith('/rest/v1/rpc/')) out = await handleRpc(url.pathname.slice('/rest/v1/rpc/'.length), body, bearer, apikey);
      else out = { status: 404, body: { message: 'Sólo se simulan /auth/v1 y /rest/v1/rpc' } };
      send(out.status, out.body);
    } catch (e) {
      console.error('[sandbox] error', e);
      send(500, { message: String(e?.message ?? e) });
    }
  });
});

await setup();
server.listen(PORT, '127.0.0.1', () => {
  log(`servidor online de PRUEBA listo en http://127.0.0.1:${PORT}`);
  log(PERSIST ? 'datos guardados en .online-sandbox/ (borrá la carpeta para empezar de cero)' : 'datos en memoria: se borran al cerrar (usá --persist para guardarlos)');
  log('para jugar contra este servidor: npm run dev:sandbox (en otra terminal) y abrí http://localhost:5174');
});
