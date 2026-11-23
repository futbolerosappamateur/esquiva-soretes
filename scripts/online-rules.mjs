// Genera la migración con las reglas del juego para el servidor online
// (niveles, personajes, logros, avatares y palabras prohibidas en apodos).
//
//   npm run online:rules           → crea una migración nueva si las reglas cambiaron
//   npm run online:rules -- --check → sólo verifica (sale con error si quedó vieja)
//
// Las migraciones ya aplicadas no se modifican: cada cambio de reglas genera
// un archivo nuevo en supabase/migrations/ (se aplica con `supabase db push`
// o pegándolo en el editor SQL de Supabase).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform === 'win32' && /^[a-z]:/.test(root)) root = root.charAt(0).toUpperCase() + root.slice(1);
const dir = path.join(root, 'supabase', 'migrations');
const check = process.argv.includes('--check');

const { module } = await runnerImport(path.join(root, 'src', 'social', 'rules', 'gameRules.ts'), {
  root,
  configFile: false,
  logLevel: 'error',
});
const sql = module.renderRulesSql();

const files = fs.readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
const rulesFiles = files.filter((f) => f.endsWith('_game_rules.sql'));
const latest = rulesFiles.at(-1);
const current = latest ? fs.readFileSync(path.join(dir, latest), 'utf8').replace(/\r\n/g, '\n') : null;

if (current === sql) {
  console.log(`Reglas al día (${latest}).`);
  process.exit(0);
}
if (check) {
  console.error('Las reglas del servidor quedaron viejas: corré `npm run online:rules` y aplicá la migración nueva.');
  process.exit(1);
}

// Marca de tiempo posterior a todas las migraciones existentes.
const stamp = (d) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
let next = stamp(new Date());
const last = files.at(-1)?.slice(0, 14);
if (last && next <= last) next = String(BigInt(last) + 100n);
const name = `${next}_game_rules.sql`;
fs.writeFileSync(path.join(dir, name), sql);
console.log(`Migración creada: supabase/migrations/${name}`);
