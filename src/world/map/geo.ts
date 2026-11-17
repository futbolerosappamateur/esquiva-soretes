/**
 * Mapa de la Ciudad: lectura del GeoJSON de barrios, proyección a 2D y
 * rasterizado propio (sin antialias, para que el pixel art quede nítido).
 * No depende de Phaser ni del navegador: se prueba con Vitest.
 */
import { normalizeName } from '../../data/campaign';

export interface GeoBarrio {
  name: string;
  /** Nombre normalizado (sin tildes, mayúsculas) para cruzar con la campaña. */
  key: string;
  comuna: number;
  /** Anillos [lon, lat] (exteriores y huecos: se rellenan con la regla par-impar). */
  rings: [number, number][][];
}

export interface ProjectedBarrio {
  key: string;
  name: string;
  comuna: number;
  rings: [number, number][][];
}

export interface ProjectedMap {
  width: number;
  height: number;
  /** Píxeles por grado de latitud. */
  scale: number;
  barrios: ProjectedBarrio[];
  /** Indica que es la representación provisional (sin datos geográficos reales). */
  provisional: boolean;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function readRing(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw)) return null;
  const pts: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return null;
    pts.push([p[0], p[1]]);
  }
  return pts.length >= 4 ? pts : null;
}

/** Lee un FeatureCollection de barrios (Polygon o MultiPolygon). Lanza un error si el formato no sirve. */
export function parseBarriosGeoJson(json: unknown): GeoBarrio[] {
  if (!isObj(json) || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw new Error('GeoJSON inválido');
  const out: GeoBarrio[] = [];
  for (const f of json.features) {
    if (!isObj(f) || !isObj(f.geometry) || !isObj(f.properties)) continue;
    const props = f.properties;
    const name = typeof props.nombre === 'string' ? props.nombre : typeof props.BARRIO === 'string' ? props.BARRIO : null;
    if (!name) continue;
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' && Array.isArray(g.coordinates) ? g.coordinates : [];
    const rings: [number, number][][] = [];
    for (const poly of polys as unknown[]) {
      if (!Array.isArray(poly)) continue;
      for (const r of poly) {
        const ring = readRing(r);
        if (ring) rings.push(ring);
      }
    }
    if (rings.length === 0) continue;
    const comuna = typeof props.comuna === 'number' ? props.comuna : typeof props.COMUNA === 'number' ? props.COMUNA : 0;
    out.push({ name, key: normalizeName(name), comuna, rings });
  }
  if (out.length === 0) throw new Error('El GeoJSON no tiene barrios');
  return out;
}

/**
 * Proyección equirectangular centrada en la ciudad (corrige el ancho de los
 * grados de longitud con el coseno de la latitud). El norte queda arriba.
 */
export function projectBarrios(barrios: GeoBarrio[], cityHeight: number, margin: number, marginY = margin): ProjectedMap {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const b of barrios) {
    for (const ring of b.rings) {
      for (const [lon, lat] of ring) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = cityHeight / (maxLat - minLat);
  const width = Math.ceil((maxLon - minLon) * k * scale) + margin * 2;
  const height = Math.ceil(cityHeight) + marginY * 2;
  const project = (lon: number, lat: number): [number, number] => [margin + (lon - minLon) * k * scale, marginY + (maxLat - lat) * scale];
  return {
    width,
    height,
    scale,
    provisional: false,
    barrios: barrios.map((b) => ({ key: b.key, name: b.name, comuna: b.comuna, rings: b.rings.map((r) => r.map(([lon, lat]) => project(lon, lat))) })),
  };
}

/** Escala un mapa ya proyectado (para los distintos niveles de zoom). */
export function scaleProjected(map: ProjectedMap, factor: number): ProjectedMap {
  return {
    ...map,
    width: Math.ceil(map.width * factor),
    height: Math.ceil(map.height * factor),
    scale: map.scale * factor,
    barrios: map.barrios.map((b) => ({ ...b, rings: b.rings.map((r) => r.map(([x, y]) => [x * factor, y * factor] as [number, number])) })),
  };
}

export interface MapRaster {
  width: number;
  height: number;
  /** 0 = fuera de la ciudad; i + 1 = barrio i. */
  ids: Uint8Array;
  /** Punto más "adentro" de cada barrio (para íconos y la ficha). */
  labels: { x: number; y: number }[];
  areas: number[];
  /** Fila más al sur y borde este de la ciudad por fila (para dibujar el río). */
  eastEdge: Int16Array;
  westEdge: Int16Array;
}

/** Relleno por líneas de barrido con la regla par-impar (respeta huecos). */
function fillRings(ids: Uint8Array, width: number, height: number, rings: [number, number][][], value: number): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const r of rings) for (const [, y] of r) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(height - 1, Math.ceil(maxY));
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > sy !== yj > sy) xs.push(xi + ((sy - yi) * (xj - xi)) / (yj - yi));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.round(xs[k]));
      const b = Math.min(width, Math.round(xs[k + 1]));
      for (let x = a; x < b; x++) ids[y * width + x] = value;
    }
  }
}

export function rasterizeMap(map: ProjectedMap): MapRaster {
  const { width, height } = map;
  const ids = new Uint8Array(width * height);
  map.barrios.forEach((b, i) => fillRings(ids, width, height, b.rings, i + 1));

  // Cierra las grietas de 1 px que deja simplificar cada barrio por separado.
  for (let pass = 0; pass < 2; pass++) {
    const copy = ids.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        if (copy[p] !== 0) continue;
        const n = [copy[p - 1], copy[p + 1], copy[p - width], copy[p + width]];
        const filled = n.filter((v) => v !== 0);
        if (filled.length >= 3 || (filled.length === 2 && ((n[0] && n[1]) || (n[2] && n[3])))) {
          const counts = new Map<number, number>();
          filled.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
          ids[p] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }
      }
    }
  }

  // Transformada de distancia (chamfer 3-4) al borde de cada barrio → punto de etiqueta.
  const INF = 1 << 20;
  const dist = new Int32Array(width * height);
  for (let p = 0; p < ids.length; p++) dist[p] = ids[p] === 0 ? 0 : INF;
  const same = (p: number, q: number) => ids[p] === ids[q];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (dist[p] === 0) continue;
      let d = dist[p];
      const check = (q: number, cost: number) => {
        d = Math.min(d, same(p, q) ? dist[q] + cost : cost);
      };
      if (x > 0) check(p - 1, 3);
      else d = Math.min(d, 3);
      if (y > 0) check(p - width, 3);
      else d = Math.min(d, 3);
      if (x > 0 && y > 0) check(p - width - 1, 4);
      if (x < width - 1 && y > 0) check(p - width + 1, 4);
      dist[p] = d;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (dist[p] === 0) continue;
      let d = dist[p];
      const check = (q: number, cost: number) => {
        d = Math.min(d, same(p, q) ? dist[q] + cost : cost);
      };
      if (x < width - 1) check(p + 1, 3);
      else d = Math.min(d, 3);
      if (y < height - 1) check(p + width, 3);
      else d = Math.min(d, 3);
      if (x < width - 1 && y < height - 1) check(p + width + 1, 4);
      if (x > 0 && y < height - 1) check(p + width - 1, 4);
      dist[p] = d;
    }
  }
  const labels = map.barrios.map(() => ({ x: 0, y: 0 }));
  const best = map.barrios.map(() => -1);
  const areas = map.barrios.map(() => 0);
  const eastEdge = new Int16Array(height).fill(-1);
  const westEdge = new Int16Array(height).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const id = ids[p];
      if (id === 0) continue;
      areas[id - 1]++;
      if (dist[p] > best[id - 1]) {
        best[id - 1] = dist[p];
        labels[id - 1] = { x, y };
      }
      if (westEdge[y] < 0) westEdge[y] = x;
      eastEdge[y] = x;
    }
  }
  return { width, height, ids, labels, areas, eastEdge, westEdge };
}

/**
 * Representación provisional para cuando no se pueden cargar los datos
 * geográficos: una grilla de cuadrados, claramente marcada como tal (no
 * pretende ser la geografía real).
 */
export function provisionalMap(names: string[], cell: number): ProjectedMap {
  const cols = 8;
  const margin = 20;
  const barrios: ProjectedBarrio[] = names.map((name, i) => {
    const cx = margin + (i % cols) * cell;
    const cy = margin + Math.floor(i / cols) * cell;
    const pad = 2;
    const ring: [number, number][] = [
      [cx + pad, cy + pad],
      [cx + cell - pad, cy + pad],
      [cx + cell - pad, cy + cell - pad],
      [cx + pad, cy + cell - pad],
      [cx + pad, cy + pad],
    ];
    return { key: normalizeName(name), name, comuna: 0, rings: [ring] };
  });
  const rows = Math.ceil(names.length / cols);
  return { width: margin * 2 + cols * cell, height: margin * 2 + rows * cell, scale: 1, barrios, provisional: true };
}
