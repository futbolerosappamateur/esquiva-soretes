// Genera el GeoJSON simplificado de los barrios de CABA que usa el mapa del juego.
//
// Uso:
//   node scripts/build-geo.mjs <barrios.geojson original> [salida]
//
// Fuente de los datos: "Barrios", Buenos Aires Data (Gobierno de la Ciudad de
// Buenos Aires), https://data.buenosaires.gob.ar/dataset/barrios
// Licencia: Creative Commons Atribución 2.5 Argentina (CC BY 2.5 AR).
//
// El script conserva los límites reales: sólo elimina vértices redundantes
// (Douglas-Peucker con una tolerancia de ~12 m, menor que un píxel del mapa)
// y redondea las coordenadas a 5 decimales (~1 m).
import fs from 'node:fs';
import path from 'node:path';

const [, , input, outputArg] = process.argv;
if (!input) {
  console.error('Uso: node scripts/build-geo.mjs <barrios.geojson> [salida]');
  process.exit(1);
}
const output = outputArg ?? path.join('public', 'data', 'caba-barrios.geojson');
const TOLERANCE = 0.00011; // grados (~12 m)

const source = JSON.parse(fs.readFileSync(input, 'utf8'));
if (source.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
  throw new Error('El archivo no es un FeatureCollection GeoJSON');
}

function perpendicularDistance([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpendicularDistance(points[i], points[a], points[b]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index >= 0 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (v) => Math.round(v * 1e5) / 1e5;

function simplifyRing(ring) {
  // El anillo viene cerrado (primer punto = último). Se simplifica abierto y se vuelve a cerrar.
  const open = ring.slice(0, -1);
  const simplified = douglasPeucker(open, TOLERANCE).map(([x, y]) => [round(x), round(y)]);
  if (simplified.length < 3) return null;
  simplified.push([...simplified[0]]);
  return simplified;
}

let before = 0;
let after = 0;
const features = source.features.map((f) => {
  const g = f.geometry;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const outPolys = polygons
    .map((poly) =>
      poly
        .map((ring) => {
          before += ring.length;
          const r = simplifyRing(ring);
          if (r) after += r.length;
          return r;
        })
        .filter(Boolean),
    )
    .filter((poly) => poly.length > 0);
  return {
    type: 'Feature',
    properties: { id: f.properties.id, nombre: f.properties.nombre, comuna: f.properties.comuna },
    geometry: outPolys.length === 1 ? { type: 'Polygon', coordinates: outPolys[0] } : { type: 'MultiPolygon', coordinates: outPolys },
  };
});

const result = {
  type: 'FeatureCollection',
  name: 'caba-barrios',
  metadata: {
    source: 'Barrios - Buenos Aires Data, Gobierno de la Ciudad de Buenos Aires',
    url: 'https://data.buenosaires.gob.ar/dataset/barrios',
    license: 'CC BY 2.5 AR (Creative Commons Atribución 2.5 Argentina)',
    processing: `Simplificado con Douglas-Peucker (tolerancia ${TOLERANCE} grados) y coordenadas redondeadas a 5 decimales.`,
  },
  features,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result));
console.log(`${features.length} barrios · ${before} → ${after} vértices · ${output} (${fs.statSync(output).size} bytes)`);
