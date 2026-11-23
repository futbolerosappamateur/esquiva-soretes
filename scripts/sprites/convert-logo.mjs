// Arma la hoja animada del logo de la portada a partir de sus cuadros (PNG).
//
//   npm run logo                       → usa art/source/logo/ (cuadro-00.png, cuadro-01.png...)
//   npm run logo -- <carpeta>          → otra carpeta con los cuadros
//
// El logo llegó como GIF animado (art/source/logo.gif, 9 cuadros de 418×418):
// sus cuadros se sacaron a PNG con el navegador. El GIF sólo tiene píxeles
// opacos o transparentes, así que el borde queda serruchado: acá se suaviza
// (el borde se vuelve semitransparente según cuántos vecinos opacos tiene) y
// el color del dibujo se extiende un píxel hacia afuera, para que al agrandarlo
// con filtro suave no aparezca un halo oscuro.
//
// Salida: public/assets/ui/logo.png (los cuadros en grilla). En
// src/assets/manifest.ts se declara con el tamaño de cada cuadro.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.resolve(ROOT, process.argv[2] ?? 'art/source/logo');
const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
if (files.length === 0) {
  console.error(`No hay cuadros PNG en ${dir}`);
  process.exit(1);
}
const frames = files.map((f) => PNG.sync.read(fs.readFileSync(path.join(dir, f))));
const W = frames[0].width;
const H = frames[0].height;
if (frames.some((f) => f.width !== W || f.height !== H)) {
  console.error('Todos los cuadros tienen que medir lo mismo.');
  process.exit(1);
}

/** Borde suave: cada píxel opaco del borde queda tan opaco como la proporción de vecinos opacos. */
function soften(img) {
  const a = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = img.data[i * 4 + 3];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (a[i] === 0) continue;
      let opaque = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && a[ny * W + nx] > 0) opaque++;
        }
      }
      if (opaque < 9) img.data[i * 4 + 3] = Math.max(70, Math.round((a[i] * opaque) / 9));
    }
  }
}

/** Los píxeles transparentes junto al dibujo toman su color (con transparencia cero). */
function bleed(img) {
  const src = Buffer.from(img.data);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] !== 0) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = (ny * W + nx) * 4;
          if (src[j + 3] === 0) continue;
          r += src[j];
          g += src[j + 1];
          b += src[j + 2];
          n++;
        }
      }
      if (n > 0) {
        img.data[i] = Math.round(r / n);
        img.data[i + 1] = Math.round(g / n);
        img.data[i + 2] = Math.round(b / n);
      }
    }
  }
}

const cols = Math.ceil(Math.sqrt(frames.length));
const rows = Math.ceil(frames.length / cols);
const out = new PNG({ width: W * cols, height: H * rows });
frames.forEach((img, k) => {
  soften(img);
  bleed(img);
  const ox = (k % cols) * W;
  const oy = Math.floor(k / cols) * H;
  for (let y = 0; y < H; y++) img.data.copy(out.data, ((oy + y) * out.width + ox) * 4, y * W * 4, (y + 1) * W * 4);
});
const target = path.join(ROOT, 'public/assets/ui/logo.png');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, PNG.sync.write(out));
console.log(`Listo: public/assets/ui/logo.png (${frames.length} cuadros de ${W}×${H}, en ${cols}×${rows})`);
console.log('Después, la versión WebP (la que usan el juego y la portada): public/assets/ui/logo.webp y sitio/logo-animado.webp (ver art/README.md).');
if (W < 1000) console.log(`Ojo: los cuadros miden ${W} px. Para que se vea nítido en pantallas grandes, conviene una versión de 1200 px o más.`);
