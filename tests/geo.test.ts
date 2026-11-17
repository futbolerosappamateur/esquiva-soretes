import { describe, expect, it } from 'vitest';
import geoRaw from '../public/data/caba-barrios.geojson?raw';
import { BARRIOS, normalizeName } from '../src/data/campaign';
import { parseBarriosGeoJson, projectBarrios, provisionalMap, rasterizeMap } from '../src/world/map/geo';

const json = JSON.parse(geoRaw);

describe('Datos geográficos de los barrios (BA Data)', () => {
  const barrios = parseBarriosGeoJson(json);

  it('trae los 48 barrios oficiales con su atribución', () => {
    expect(barrios).toHaveLength(48);
    expect(json.metadata.source).toMatch(/Buenos Aires Data/);
    expect(json.metadata.license).toMatch(/CC BY 2\.5 AR/);
  });

  it('cada barrio de la campaña existe en los datos, con su comuna correcta', () => {
    const byKey = new Map(barrios.map((b) => [b.key, b]));
    expect(BARRIOS).toHaveLength(48);
    for (const b of BARRIOS) {
      const geo = byKey.get(normalizeName(b.geoName));
      expect(geo, b.name).toBeDefined();
      expect(geo!.comuna, b.name).toBe(b.comuna);
    }
    // Sin barrios repetidos en la campaña.
    expect(new Set(BARRIOS.map((b) => b.id)).size).toBe(48);
    expect(new Set(BARRIOS.map((b) => normalizeName(b.geoName))).size).toBe(48);
  });

  it('se proyecta con el norte arriba y una forma reconocible de la Ciudad', () => {
    const map = projectBarrios(barrios, 250, 20);
    // CABA es apenas más alta que ancha (≈18 km × 20 km).
    const ratio = (map.width - 40) / (map.height - 40);
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.0);
    const raster = rasterizeMap(map);
    const label = (name: string) => raster.labels[map.barrios.findIndex((b) => b.key === normalizeName(name))];
    // Núñez queda al norte de La Boca; Liniers al oeste de Puerto Madero; San Telmo al sur de Retiro.
    expect(label('Nuñez').y).toBeLessThan(label('La Boca').y);
    expect(label('Liniers').x).toBeLessThan(label('Puerto Madero').x);
    expect(label('San Telmo').y).toBeGreaterThan(label('Retiro').y);
  });

  it('el rasterizado cubre cada barrio y ubica la etiqueta adentro', () => {
    const map = projectBarrios(barrios, 250, 20);
    const raster = rasterizeMap(map);
    map.barrios.forEach((b, i) => {
      expect(raster.areas[i], b.name).toBeGreaterThan(20);
      const { x, y } = raster.labels[i];
      expect(raster.ids[y * raster.width + x], b.name).toBe(i + 1);
    });
    // Los barrios vecinos quedan pegados (sin grietas): casi no hay huecos rodeados de ciudad.
    let holes = 0;
    for (let y = 1; y < raster.height - 1; y++) {
      for (let x = 1; x < raster.width - 1; x++) {
        const p = y * raster.width + x;
        if (raster.ids[p] !== 0) continue;
        const n = [raster.ids[p - 1], raster.ids[p + 1], raster.ids[p - raster.width], raster.ids[p + raster.width]];
        if (n.every((v) => v !== 0)) holes++;
      }
    }
    expect(holes).toBe(0);
  });

  it('el mapa provisional queda marcado como tal', () => {
    const map = provisionalMap(BARRIOS.map((b) => b.name), 30);
    expect(map.provisional).toBe(true);
    expect(map.barrios).toHaveLength(48);
  });

  it('rechaza archivos que no son GeoJSON de barrios', () => {
    expect(() => parseBarriosGeoJson({ type: 'Nada' })).toThrow();
    expect(() => parseBarriosGeoJson({ type: 'FeatureCollection', features: [] })).toThrow();
  });
});
