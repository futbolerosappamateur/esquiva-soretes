// Convierte las imágenes de un personaje dibujado (ilustraciones grandes, con
// fondo transparente) en las hojas que usa el juego: con el sombreado de la
// ilustración ("style": "smooth", como el pibe de plastilina) o en pixel art.
// La guía para pedir las imágenes está en art/README.md.
//
//   node scripts/sprites/convert-sheet.mjs scripts/sprites/pibe.json           → genera las hojas
//   node scripts/sprites/convert-sheet.mjs scripts/sprites/pibe.json --debug   → además, imágenes de control
//
// Pasos: limpia el fondo (bordes de color y transparencias a medias), separa
// cada dibujo, lo achica al tamaño del juego promediando colores (en pixel
// art, además reduce la paleta, que comparten todos los cuadros, y agrega el
// contorno oscuro de los personajes del juego), apoya los pies en la última
// fila del cuadro y arma tres versiones (zapatillas limpias, una sucia, dos sucias).
//
// Salida: public/assets/characters/<look>-0.png .. -2.png con su atlas .json
// (nombres de cuadro del juego: idle0, walk0, jumpUp...), o <look>-0@4.png,
// <look>-0@6.png... si la configuración pide varios detalles ("renderScales").
// Se cargan desde src/assets/manifest.ts con las claves char-<look>-0..2.
// Los dibujos pueden venir en una hoja ("source") o en varias ("sheets": una
// por animación, cada una con su escala, porque cada hoja suele venir dibujada
// a un tamaño distinto).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const configPath = args.find((a) => !a.startsWith('--'));
if (!configPath) {
  console.error('Uso: node scripts/sprites/convert-sheet.mjs <config.json> [--debug]');
  process.exit(1);
}
const DEBUG = args.includes('--debug');
const cfg = JSON.parse(fs.readFileSync(path.resolve(ROOT, configPath), 'utf8'));
/**
 * renderScale: detalle de los cuadros. El juego se dibuja con la resolución de
 * la pantalla (en una de 1920, 4 píxeles por unidad: ver src/graphics/renderScale.ts),
 * así que los cuadros pueden tener más detalle que el tamaño del juego: con 2
 * son de 96×96 y se muestran como 48×48 unidades; con 4, de 192×192. Conviene
 * que la hoja original tenga dibujos al menos tan altos como `targetHeight`
 * (si no, se agrandan y se ven borrosos). style: 'pixel' (paleta reducida y
 * contorno, como el resto del mundo) o 'smooth' (conserva el sombreado y los
 * bordes suaves del dibujo).
 */
/**
 * renderScales: [4, 6] genera dos juegos de hojas (`<look>-0@4.png`,
 * `<look>-0@6.png`...) y el juego descarga el que necesita su pantalla (ver
 * src/assets/manifest.ts). Con un solo renderScale, los nombres no llevan @.
 */
const SCALES = cfg.renderScales ?? [cfg.renderScale ?? 1];
const SUFFIXED = Array.isArray(cfg.renderScales);
let RS = SCALES[0];
const SMOOTH = cfg.style === 'smooth';
let FRAME = (cfg.frameSize ?? 48) * RS;
/** Fila del piso: la misma proporción que el juego (47/48 del cuadro). */
let GROUND = Math.round((FRAME * 47) / 48);
function useScale(rs) {
  RS = rs;
  FRAME = (cfg.frameSize ?? 48) * RS;
  GROUND = Math.round((FRAME * 47) / 48);
}
const OUTLINE = SMOOTH ? null : (cfg.outline ?? '#21142b');
const COLUMNS = 8;

// ------------------------------------------------------------------ imagen

const load = (file) => {
  const png = PNG.sync.read(fs.readFileSync(path.resolve(ROOT, file)));
  return { w: png.width, h: png.height, data: new Uint8ClampedArray(png.data) };
};
const blank = (w, h) => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });
const save = (img, file) => {
  const png = new PNG({ width: img.w, height: img.h });
  png.data = Buffer.from(img.data);
  fs.mkdirSync(path.dirname(path.resolve(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, file), PNG.sync.write(png));
};
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

/**
 * Limpieza del fondo: las herramientas de "quitar fondo" dejan un halo (acá,
 * rojo puro casi transparente) y el dibujo mismo levemente transparente.
 */
function clean(img, c) {
  const d = img.data;
  const minAlpha = c.minAlpha ?? 128;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    const fringe = c.fringe && r > c.fringe.minR && g < c.fringe.maxG && b < c.fringe.maxB && a < (c.fringe.maxAlpha ?? 250);
    if (a < minAlpha || fringe) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
    else d[i + 3] = 255;
  }
  return img;
}

// ------------------------------------------------------------ separación

/** Dibujos sueltos: componentes conexas, uniendo pedacitos cercanos. */
function segment(img, region, minArea, gap) {
  const { w } = img;
  const x0 = region.x;
  const y0 = region.y;
  const rw = region.w;
  const rh = region.h;
  const label = new Int32Array(rw * rh);
  const boxes = [];
  const stack = [];
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const i = y * rw + x;
      if (label[i] || img.data[((y + y0) * w + (x + x0)) * 4 + 3] === 0) continue;
      const box = { x0: x, y0: y, x1: x, y1: y, area: 0 };
      label[i] = boxes.length + 1;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop();
        const jx = j % rw;
        const jy = (j - jx) / rw;
        box.area++;
        box.x0 = Math.min(box.x0, jx);
        box.x1 = Math.max(box.x1, jx);
        box.y0 = Math.min(box.y0, jy);
        box.y1 = Math.max(box.y1, jy);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = jx + dx;
            const ny = jy + dy;
            if (nx < 0 || ny < 0 || nx >= rw || ny >= rh) continue;
            const k = ny * rw + nx;
            if (label[k] || img.data[((ny + y0) * w + (nx + x0)) * 4 + 3] === 0) continue;
            label[k] = boxes.length + 1;
            stack.push(k);
          }
        }
      }
      boxes.push(box);
    }
  }
  // Se descartan motitas y se unen las partes de un mismo dibujo (manos, chispas...).
  let list = boxes.filter((b) => b.area >= minArea).map((b) => ({ ...b }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < list.length && !merged; i++) {
      for (let j = i + 1; j < list.length && !merged; j++) {
        const a = list[i];
        const b = list[j];
        if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
          list[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), area: a.area + b.area };
          list.splice(j, 1);
          merged = true;
        }
      }
    }
  }
  list = list.map((b) => ({ x: b.x0 + x0, y: b.y0 + y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, area: b.area }));
  // Filas: por el centro vertical de cada dibujo; columnas: de izquierda a derecha.
  list.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows = [];
  for (const s of list) {
    const cy = s.y + s.h / 2;
    const row = rows.find((r) => cy >= r.top && cy <= r.bottom);
    if (row) {
      row.items.push(s);
      row.top = Math.min(row.top, s.y);
      row.bottom = Math.max(row.bottom, s.y + s.h);
    } else rows.push({ top: s.y, bottom: s.y + s.h, items: [s] });
  }
  rows.sort((a, b) => a.top - b.top);
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x));
}

// ---------------------------------------------------------------- escala

/**
 * Achica promediando (cada píxel nuevo es el promedio de la zona que cubre),
 * con alfa premultiplicado. Los pies quedan apoyados exactamente en el borde
 * inferior.
 */
function downscale(img, box, scale) {
  const ow = Math.max(1, Math.round(box.w * scale));
  const oh = Math.max(1, Math.round(box.h * scale));
  const out = { w: ow, h: oh, rgba: new Float32Array(ow * oh * 4) };
  const inv = 1 / scale;
  const sx0 = box.x + box.w / 2 - (ow * inv) / 2;
  const sy0 = box.y + box.h - oh * inv;
  for (let oy = 0; oy < oh; oy++) {
    const fy0 = sy0 + oy * inv;
    const fy1 = fy0 + inv;
    for (let ox = 0; ox < ow; ox++) {
      const fx0 = sx0 + ox * inv;
      const fx1 = fx0 + inv;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let y = Math.floor(fy0); y < Math.ceil(fy1); y++) {
        const wy = Math.min(fy1, y + 1) - Math.max(fy0, y);
        if (wy <= 0) continue;
        for (let x = Math.floor(fx0); x < Math.ceil(fx1); x++) {
          const wx = Math.min(fx1, x + 1) - Math.max(fx0, x);
          if (wx <= 0) continue;
          const wgt = wx * wy;
          area += wgt;
          if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
          const i = (y * img.w + x) * 4;
          const al = img.data[i + 3] / 255;
          r += img.data[i] * al * wgt;
          g += img.data[i + 1] * al * wgt;
          b += img.data[i + 2] * al * wgt;
          a += al * wgt;
        }
      }
      const k = (oy * ow + ox) * 4;
      out.rgba[k] = a > 0 ? r / a : 0;
      out.rgba[k + 1] = a > 0 ? g / a : 0;
      out.rgba[k + 2] = a > 0 ? b / a : 0;
      out.rgba[k + 3] = area > 0 ? a / area : 0;
    }
  }
  return out;
}

// --------------------------------------------------------------- paleta

const dist2 = (p, q) => {
  // Distancia de color con pesos aproximados de luminosidad.
  const rm = (p[0] + q[0]) / 2;
  const dr = p[0] - q[0];
  const dg = p[1] - q[1];
  const db = p[2] - q[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
};

/** K-means determinista (k-means++ con semilla fija). */
function kmeans(colors, k, iterations = 16) {
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const centers = [colors[Math.floor(rand() * colors.length)].slice()];
  const best = new Float64Array(colors.length).fill(Infinity);
  while (centers.length < k) {
    let total = 0;
    for (let i = 0; i < colors.length; i++) {
      best[i] = Math.min(best[i], dist2(colors[i], centers[centers.length - 1]));
      total += best[i];
    }
    let pick = rand() * total;
    let idx = 0;
    for (; idx < colors.length - 1; idx++) {
      pick -= best[idx];
      if (pick <= 0) break;
    }
    centers.push(colors[idx].slice());
  }
  const assign = new Int32Array(colors.length);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < colors.length; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dd = dist2(colors[i], centers[c]);
        if (dd < bd) {
          bd = dd;
          bi = c;
        }
      }
      assign[i] = bi;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < colors.length; i++) {
      const s = sums[assign[i]];
      s[0] += colors[i][0];
      s[1] += colors[i][1];
      s[2] += colors[i][2];
      s[3]++;
    }
    sums.forEach((s, c) => {
      if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centers.map((c) => c.map(Math.round));
}

const nearest = (palette, p) => {
  let bi = 0;
  let bd = Infinity;
  for (let c = 0; c < palette.length; c++) {
    const dd = dist2(p, palette[c]);
    if (dd < bd) {
      bd = dd;
      bi = c;
    }
  }
  return palette[bi];
};

// -------------------------------------------------------------- cuadros

/** Centro horizontal del torso (para que el cuerpo no "baile" entre cuadros). */
function torsoCenter(small) {
  let sum = 0;
  let n = 0;
  const top = Math.floor(small.h * 0.22);
  const bottom = Math.ceil(small.h * 0.55);
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < small.w; x++) {
      if (small.rgba[(y * small.w + x) * 4 + 3] >= 0.5) {
        sum += x;
        n++;
      }
    }
  }
  return n ? sum / n : small.w / 2;
}

function place(small, palette, c, flip, nudge) {
  const frame = blank(FRAME, FRAME);
  // Fila más baja con algo dibujado: ahí van los pies. En pixel art queda una fila
  // por encima del piso (el contorno ocupa la del piso); en suave, sobre el piso.
  let lowest = -1;
  for (let y = small.h - 1; y >= 0 && lowest < 0; y--) {
    for (let x = 0; x < small.w; x++) if (small.rgba[(y * small.w + x) * 4 + 3] >= 0.5) lowest = y;
  }
  const cx = flip ? small.w - 1 - torsoCenter(small) : torsoCenter(small);
  const ox = Math.round(FRAME / 2 - cx) + (nudge?.[0] ?? 0) * RS;
  const oy = GROUND - (OUTLINE ? RS : 0) - lowest + (nudge?.[1] ?? 0) * RS;
  // Suave: se conservan los bordes semitransparentes (lo casi invisible se descarta).
  const minAlpha = SMOOTH ? 0.08 : 0.5;
  let clipped = 0;
  for (let y = 0; y < small.h; y++) {
    for (let x = 0; x < small.w; x++) {
      const k = (y * small.w + x) * 4;
      const a = small.rgba[k + 3];
      if (a < minAlpha) continue;
      const fx = (flip ? small.w - 1 - x : x) + ox;
      const fy = y + oy;
      if (fx < 0 || fy < 0 || fx >= FRAME || fy > GROUND) {
        if (a >= 0.5) clipped++;
        continue;
      }
      const col = palette ? nearest(palette, [small.rgba[k], small.rgba[k + 1], small.rgba[k + 2]]) : [small.rgba[k], small.rgba[k + 1], small.rgba[k + 2]];
      const i = (fy * FRAME + fx) * 4;
      frame.data[i] = col[0];
      frame.data[i + 1] = col[1];
      frame.data[i + 2] = col[2];
      frame.data[i + 3] = SMOOTH ? Math.round(Math.min(1, a > 0.9 ? 1 : a) * 255) : 255;
    }
  }
  frame.clipped = clipped;
  return frame;
}

/** Contorno de 1 píxel alrededor de la silueta (como los personajes del juego). */
function outline(frame, color) {
  const [r, g, b] = hex(color);
  const solid = new Uint8Array(FRAME * FRAME);
  for (let i = 0; i < solid.length; i++) solid[i] = frame.data[i * 4 + 3] > 40 ? 1 : 0;
  for (let y = 0; y < FRAME; y++) {
    for (let x = 0; x < FRAME; x++) {
      const i = y * FRAME + x;
      if (solid[i]) continue;
      const near = (x > 0 && solid[i - 1]) || (x < FRAME - 1 && solid[i + 1]) || (y > 0 && solid[i - FRAME]) || (y < FRAME - 1 && solid[i + FRAME]);
      if (!near) continue;
      frame.data[i * 4] = r;
      frame.data[i * 4 + 1] = g;
      frame.data[i * 4 + 2] = b;
      frame.data[i * 4 + 3] = 255;
    }
  }
  return frame;
}

/**
 * Zapatillas sucias: busca las zapatillas (píxeles claros o rojos en la parte
 * de abajo del dibujo), las separa en dos y pinta de marrón la suela y la punta.
 */
function dirty(frame, level, c) {
  if (level === 0) return frame;
  const out = { w: FRAME, h: FRAME, data: new Uint8ClampedArray(frame.data) };
  let top = FRAME;
  let bottom = 0;
  for (let y = 0; y < FRAME; y++) {
    for (let x = 0; x < FRAME; x++) {
      if (frame.data[(y * FRAME + x) * 4 + 3]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  const band = Math.max(4 * RS, Math.round((bottom - top) * (c.shoeBand ?? 0.35)));
  const isShoe = (i) => {
    const [r, g, b, a] = [frame.data[i], frame.data[i + 1], frame.data[i + 2], frame.data[i + 3]];
    if (a < 128) return false;
    // Blanco o gris (no el celeste de la camiseta) o rojo de los detalles.
    const light = r > 150 && g > 150 && b > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
    const red = r > 140 && r - Math.max(g, b) > 60;
    return light || red;
  };
  const mask = new Uint8Array(FRAME * FRAME);
  for (let y = bottom - band; y <= bottom; y++) for (let x = 0; x < FRAME; x++) if (isShoe((y * FRAME + x) * 4)) mask[y * FRAME + x] = 1;
  // Dos zapatillas: grupos de píxeles conectados (la de más a la derecha es la que va adelante).
  const groups = [];
  const seen = new Uint8Array(FRAME * FRAME);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const g = [];
    const st = [i];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop();
      g.push(j);
      const x = j % FRAME;
      for (const k of [j - 1, j + 1, j - FRAME, j + FRAME, j - FRAME - 1, j - FRAME + 1, j + FRAME - 1, j + FRAME + 1]) {
        if (k < 0 || k >= mask.length || seen[k] || !mask[k]) continue;
        if (Math.abs((k % FRAME) - x) > 1) continue;
        seen[k] = 1;
        st.push(k);
      }
    }
    if (g.length >= 3 * RS * RS) groups.push(g);
  }
  groups.sort((a, b) => Math.max(...b.map((j) => j % FRAME)) - Math.max(...a.map((j) => j % FRAME)));
  const pick = groups.slice(0, level === 1 ? 1 : 2);
  const brown = [hex('#6b3d1c'), hex('#4a2810'), hex('#87501f')];
  for (const g of pick) {
    const ys = g.map((j) => Math.floor(j / FRAME));
    const maxY = Math.max(...ys);
    const maxX = Math.max(...g.map((j) => j % FRAME));
    for (const j of g) {
      const x = j % FRAME;
      const y = Math.floor(j / FRAME);
      // Suela (las dos filas de abajo), la punta y algunas manchitas (medidas en píxeles del juego).
      const gx = Math.floor(x / RS);
      const gy = Math.floor(y / RS);
      const sole = y >= maxY - (2 * RS - 1);
      const tip = x >= maxX - (2 * RS - 1) && y >= maxY - (4 * RS - 1);
      const spot = (gx * 7 + gy * 13) % 5 === 0;
      if (!(sole || tip || spot)) continue;
      const col = brown[(gx + gy) % 3 === 0 ? 2 : sole ? 1 : 0];
      // En el estilo suave, el barro se mezcla un poco con el sombreado de la zapatilla.
      const mix = SMOOTH ? 0.85 : 1;
      out.data[j * 4] = Math.round(col[0] * mix + frame.data[j * 4] * (1 - mix));
      out.data[j * 4 + 1] = Math.round(col[1] * mix + frame.data[j * 4 + 1] * (1 - mix));
      out.data[j * 4 + 2] = Math.round(col[2] * mix + frame.data[j * 4 + 2] * (1 - mix));
    }
  }
  return out;
}

// --------------------------------------------------------- depuración

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function drawText(img, x, y, text, color, scale = 2) {
  let cx = x;
  for (const ch of text) {
    const glyph = ch === '.' ? '000000000000010' : DIGITS[Number(ch)];
    if (!glyph) {
      cx += 2 * scale;
      continue;
    }
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy * 3 + gx] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = cx + gx * scale + sx;
            const py = y + gy * scale + sy;
            if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
            const i = (py * img.w + px) * 4;
            img.data.set([...color, 255], i);
          }
        }
      }
    }
    cx += 4 * scale;
  }
}
function drawBox(img, b, color) {
  for (let x = b.x; x < b.x + b.w; x++) {
    for (const y of [b.y, b.y + b.h - 1]) if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data.set([...color, 255], (y * img.w + x) * 4);
  }
  for (let y = b.y; y < b.y + b.h; y++) {
    for (const x of [b.x, b.x + b.w - 1]) if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.data.set([...color, 255], (y * img.w + x) * 4);
  }
}

// ---------------------------------------------------------------- retrato

/**
 * Retrato: la ilustración grande del personaje (para la selección de
 * personaje y otras pantallas), a su resolución original y con los bordes
 * suaves. A diferencia de los cuadros de animación no se achica: se limpia.
 *  - el cuerpo (casi opaco) queda opaco del todo;
 *  - lo casi transparente (la aureola que dejó quitar el fondo) se borra;
 *  - los bordes conservan su transparencia, pero con el color del dibujo de al
 *    lado (así no queda el halo rojo o amarillo del fondo original).
 */
function makePortrait(pcfg) {
  // Desde un dibujo de una hoja ({ sheet, sprite: [fila, columna] }) o desde una zona ({ region }).
  let raw;
  let r;
  if (pcfg.sheet) {
    const box = at(pcfg.sheet, pcfg.sprite ?? [0, 0]);
    const pad = pcfg.pad ?? 6;
    raw = sheets[pcfg.sheet].raw;
    r = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
  } else {
    raw = load(pcfg.source ?? sheetDefs[sheetNames[0]].source);
    r = pcfg.region;
  }
  const minA = pcfg.minAlpha ?? 24;
  const solidA = pcfg.solidAlpha ?? 232;
  const img = blank(r.w, r.h);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const sx = r.x + x;
      const sy = r.y + y;
      if (sx < 0 || sy < 0 || sx >= raw.w || sy >= raw.h) continue;
      img.data.set(raw.data.subarray((sy * raw.w + sx) * 4, (sy * raw.w + sx) * 4 + 4), (y * r.w + x) * 4);
    }
  }
  const d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < r.w && y < r.h && d[(y * r.w + x) * 4 + 3] >= solidA;
  const out = blank(r.w, r.h);
  let x0 = r.w;
  let y0 = r.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4;
      const a = d[i + 3];
      if (a < minA) continue;
      let rgb = [d[i], d[i + 1], d[i + 2]];
      let alpha = 255;
      if (a < solidA) {
        // Borde: color promedio del dibujo opaco más cercano (hasta 2 píxeles).
        let n = 0;
        const acc = [0, 0, 0];
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (!solid(x + dx, y + dy)) continue;
            const j = ((y + dy) * r.w + x + dx) * 4;
            acc[0] += d[j];
            acc[1] += d[j + 1];
            acc[2] += d[j + 2];
            n++;
          }
        }
        if (n === 0) continue; // suelto, lejos del dibujo: resto del fondo
        rgb = acc.map((v) => Math.round(v / n));
        alpha = Math.round(((a - minA) / (solidA - minA)) * 255);
      }
      out.data.set([...rgb, alpha], i);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('El retrato quedó vacío: revisá "portrait"');
  // Recorte al dibujo, con 2 píxeles de aire (y los pies apoyados en el borde de abajo).
  const pad = 2;
  const cw = x1 - x0 + 1 + pad * 2;
  const ch = y1 - y0 + 1 + pad;
  const crop = blank(cw, ch);
  for (let y = y0; y <= y1; y++) crop.data.set(out.data.subarray((y * r.w + x0) * 4, (y * r.w + x1 + 1) * 4), ((y - y0 + pad) * cw + pad) * 4);
  save(crop, `public/assets/characters/${cfg.look}-portrait.png`);
  console.log(`Retrato: public/assets/characters/${cfg.look}-portrait.png (${cw}×${ch})`);
  if (DEBUG) {
    // Sobre fondo oscuro y claro, ampliado al doble, para revisar los bordes.
    const z = 2;
    const dbg = blank(cw * z * 2, ch * z);
    for (let y = 0; y < ch * z; y++) {
      for (let x = 0; x < cw * z * 2; x++) {
        const half = x >= cw * z ? 1 : 0;
        const sx = Math.floor((x - half * cw * z) / z);
        const sy = Math.floor(y / z);
        const si = (sy * cw + sx) * 4;
        const bg = half ? [236, 226, 210] : [42, 29, 51];
        const al = crop.data[si + 3] / 255;
        dbg.data.set([0, 1, 2].map((k) => Math.round(crop.data[si + k] * al + bg[k] * (1 - al))).concat(255), (y * cw * z * 2 + x) * 4);
      }
    }
    save(dbg, `art/debug/${cfg.look}-portrait-check.png`);
  }
}

// -------------------------------------------------------------- principal

/**
 * Hojas de origen: varias (`sheets`, una por animación, cada una con su
 * escala) o una sola (`source`, como en las configuraciones viejas).
 */
const sheetDefs = cfg.sheets ?? { main: { source: cfg.source, region: cfg.region, clean: cfg.clean } };
const sheetNames = Object.keys(sheetDefs);
const sheets = {};
for (const name of sheetNames) {
  const def = sheetDefs[name];
  const raw = load(def.source);
  const img = clean(load(def.source), def.clean ?? cfg.clean ?? {});
  const region = def.region ?? { x: 0, y: 0, w: img.w, h: img.h };
  const rows = segment(img, region, def.minArea ?? cfg.minArea ?? 150, def.mergeGap ?? cfg.mergeGap ?? 3);
  sheets[name] = { def, raw, img, region, rows, scale: def.scale ?? 1 };
  console.log(`${sheetNames.length > 1 ? `${name}: ` : ''}dibujos por fila: ${rows.map((r) => r.length).join(' · ')}`);
  if (DEBUG) {
    const dbg = blank(region.w, region.h);
    for (let y = 0; y < region.h; y++) {
      for (let x = 0; x < region.w; x++) {
        const si = ((y + region.y) * img.w + (x + region.x)) * 4;
        const di = (y * region.w + x) * 4;
        if (img.data[si + 3]) dbg.data.set(img.data.subarray(si, si + 4), di);
        else dbg.data.set([40, 30, 48, 255], di);
      }
    }
    rows.forEach((row, r) =>
      row.forEach((s, c) => {
        const b = { x: s.x - region.x, y: s.y - region.y, w: s.w, h: s.h };
        drawBox(dbg, b, [255, 210, 63]);
        drawText(dbg, b.x + 2, b.y + 2, `${r}.${c}`, [124, 202, 242]);
      }),
    );
    save(dbg, `art/debug/${cfg.look}${sheetNames.length > 1 ? `-${name}` : ''}-segments.png`);
  }
}

/** Cuadro de la configuración → { sheet, sprite: [fila, columna], scale?, flip?, nudge? }. */
function spec(name) {
  const v = cfg.frames[name];
  if (Array.isArray(v)) return typeof v[0] === 'string' ? { sheet: v[0], sprite: [v[1], v[2]] } : { sheet: sheetNames[0], sprite: v };
  return { sheet: sheetNames[0], ...v };
}

function at(sheetName, ref) {
  const sh = sheets[sheetName];
  if (!sh) throw new Error(`No hay una hoja "${sheetName}" en "sheets"`);
  const [r, c] = ref;
  const s = sh.rows[r]?.[c];
  if (!s) throw new Error(`No hay dibujo en la fila ${r}, columna ${c} de la hoja "${sheetName}"`);
  return s;
}

if (cfg.portrait) makePortrait(cfg.portrait);

const names = Object.keys(cfg.frames ?? {});
if (names.length === 0) {
  console.log('Sin "frames" en la configuración: sólo se generaron las imágenes de control.');
  process.exit(0);
}
const refSpec = spec(cfg.reference ?? 'idle0');
const ref = at(refSpec.sheet, refSpec.sprite);
const refFactor = sheets[refSpec.sheet].scale * (refSpec.scale ?? 1);
/** Alto del personaje en unidades del juego (42; las configuraciones viejas lo daban en píxeles del cuadro). */
const unitsTall = cfg.targetUnits ?? (cfg.targetHeight ?? 42 * SCALES[0]) / SCALES[0];

for (const rs of SCALES) {
  useScale(rs);
  const base = (unitsTall * RS) / (ref.h * refFactor);
  console.log(`Detalle ${RS}: cuadros de ${FRAME}×${FRAME}, escala ${base.toFixed(3)} (el cuadro de referencia mide ${ref.h} px de alto)`);
  // Escala de cada cuadro: la de su hoja y, si hace falta, una propia.
  const smalls = names.map((name) => {
    const sp = spec(name);
    const sh = sheets[sp.sheet];
    return downscale(sh.img, at(sp.sheet, sp.sprite), base * sh.scale * (sp.scale ?? 1));
  });

  // Paleta común a todos los cuadros (sólo estilo pixel).
  const samples = [];
  if (cfg.colors && !SMOOTH) for (const s of smalls) for (let i = 0; i < s.rgba.length; i += 4) if (s.rgba[i + 3] >= 0.5) samples.push([s.rgba[i], s.rgba[i + 1], s.rgba[i + 2]]);
  const palette = cfg.colors && !SMOOTH ? kmeans(samples, cfg.colors) : null;
  if (palette) console.log(`Paleta: ${palette.length} colores`);

  const frames = names.map((name, i) => {
    const sp = spec(name);
    const f = place(smalls[i], palette, cfg, sp.flip === true, sp.nudge);
    if (f.clipped > 0) console.warn(`  Ojo: "${name}" no entra en el cuadro (${f.clipped} píxeles cortados): achicalo con "scale" o movelo con "nudge".`);
    return OUTLINE ? outline(f, OUTLINE) : f;
  });

  const suffix = SUFFIXED ? `@${RS}` : '';
  for (let level = 0; level < 3; level++) {
    const sheetRows = Math.ceil(frames.length / COLUMNS);
    const sheet = blank(COLUMNS * FRAME, sheetRows * FRAME);
    const file = `${cfg.look}-${level}${suffix}`;
    // displayScale: el juego muestra los cuadros a esta escala (1/RS: 0,5 si están dibujados al doble).
    const atlas = { frames: {}, meta: { app: 'esquiva-soretes convert-sheet', image: `${file}.png`, size: { w: sheet.w, h: sheet.h }, scale: '1', displayScale: 1 / RS, smooth: SMOOTH } };
    frames.forEach((f, i) => {
      const fx = (i % COLUMNS) * FRAME;
      const fy = Math.floor(i / COLUMNS) * FRAME;
      const img = dirty(f, level, cfg);
      for (let y = 0; y < FRAME; y++) sheet.data.set(img.data.subarray(y * FRAME * 4, (y + 1) * FRAME * 4), ((fy + y) * sheet.w + fx) * 4);
      atlas.frames[names[i]] = {
        frame: { x: fx, y: fy, w: FRAME, h: FRAME },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: FRAME, h: FRAME },
        sourceSize: { w: FRAME, h: FRAME },
      };
    });
    save(sheet, `public/assets/characters/${file}.png`);
    fs.writeFileSync(path.resolve(ROOT, `public/assets/characters/${file}.json`), JSON.stringify(atlas, null, 1));
    if (DEBUG && rs === SCALES[SCALES.length - 1]) {
      // Imagen de control: los cuadros sobre un damero (achicada si los cuadros son muy grandes).
      const zoom = Math.max(1, 4 / RS);
      const step = RS > 4 ? 2 : 1;
      const big = blank(Math.ceil((sheet.w * zoom) / step), Math.ceil((sheet.h * zoom) / step));
      for (let y = 0; y < big.h; y++) {
        for (let x = 0; x < big.w; x++) {
          const si = (Math.floor((y * step) / zoom) * sheet.w + Math.floor((x * step) / zoom)) * 4;
          const di = (y * big.w + x) * 4;
          const al = sheet.data[si + 3] / 255;
          const bg = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? [58, 44, 66] : [48, 36, 56];
          big.data.set([0, 1, 2].map((k) => Math.round(sheet.data[si + k] * al + bg[k] * (1 - al))).concat(255), di);
        }
      }
      save(big, `art/debug/${cfg.look}-${level}-x4.png`);
    }
  }
  console.log(`Listo: public/assets/characters/${cfg.look}-0..2${suffix}.png (${frames.length} cuadros de ${FRAME}×${FRAME})`);
}
