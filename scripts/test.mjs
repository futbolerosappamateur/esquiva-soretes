// Lanzador de las pruebas (npm test).
//
// En Windows, si la terminal abre la carpeta con la unidad en minúscula (c:\...),
// Node termina cargando dos copias de Vitest y ninguna prueba arranca
// ("Cannot read properties of undefined (reading 'config')").
// Este lanzador normaliza la letra de unidad y después ejecuta Vitest.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform === 'win32' && /^[a-z]:/.test(root)) root = root.charAt(0).toUpperCase() + root.slice(1);

const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
