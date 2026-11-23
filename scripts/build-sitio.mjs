// Arma el sitio para esquivasoretes.com.ar:
//
//   dist-sitio/          la portada (logo animado + "Próximamente"), desde sitio/
//   dist-sitio/demo/     el juego compilado, para mostrarlo con contraseña
//
//   npm run sitio
//
// La demo no se indexa (robots.txt y meta noindex). La contraseña la pone el
// hosting (en Plesk: directorio protegido "demo"). Cómo publicarlo: docs/PUBLICAR.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-sitio');

fs.rmSync(OUT, { recursive: true, force: true });

// El juego (rutas relativas: vite.config.ts usa base './', así anda dentro de /demo/).
await build({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  logLevel: 'warn',
  build: { outDir: path.join(OUT, 'demo'), emptyOutDir: true },
});
const demoIndex = path.join(OUT, 'demo', 'index.html');
fs.writeFileSync(demoIndex, fs.readFileSync(demoIndex, 'utf8').replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />'));

// La portada, con la letra del juego (y su licencia).
fs.cpSync(path.join(ROOT, 'sitio'), OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src/assets/fonts/geologica-semibold.ttf'), path.join(OUT, 'geologica-semibold.ttf'));
fs.copyFileSync(path.join(ROOT, 'src/assets/fonts/LICENSE.md'), path.join(OUT, 'geologica-LICENSE.md'));

let bytes = 0;
let files = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      files++;
      bytes += fs.statSync(p).size;
    }
  }
};
walk(OUT);
console.log(`Listo: dist-sitio/ (${files} archivos, ${(bytes / 1024 / 1024).toFixed(1)} MB). La portada en la raíz y el juego en demo/.`);
