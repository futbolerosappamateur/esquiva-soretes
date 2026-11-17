/**
 * Vehículos que circulan por las calles transversales.
 * El largo y el ancho son la huella en el piso (px); la altura sólo es visual.
 * Para sumar uno nuevo alcanza con agregar una entrada y dibujar (o cargar)
 * sus texturas `vehicle-<id>-front` y `vehicle-<id>-rear`.
 */
export interface VehicleType {
  id: string;
  label: string;
  /** Huella en el piso: ancho (eje x) y largo (eje de profundidad). */
  width: number;
  length: number;
  /** Altura del dibujo (px). */
  height: number;
  speed: [number, number];
  weight: number;
  /** Colores para el dibujo provisional. */
  body: string;
  roof?: string;
  kind: 'car' | 'taxi' | 'bus';
}

export const VEHICLE_TYPES: VehicleType[] = [
  { id: 'car-red', label: 'AUTO', width: 28, length: 42, height: 14, speed: [118, 150], weight: 2, body: '#c62b22', kind: 'car' },
  { id: 'car-blue', label: 'AUTO', width: 28, length: 42, height: 14, speed: [118, 150], weight: 2, body: '#2f5a8a', kind: 'car' },
  { id: 'car-white', label: 'AUTO', width: 28, length: 42, height: 14, speed: [112, 140], weight: 2, body: '#e8e8e4', kind: 'car' },
  { id: 'car-green', label: 'AUTO', width: 28, length: 40, height: 14, speed: [112, 140], weight: 1, body: '#3f7a4a', kind: 'car' },
  { id: 'taxi', label: 'TAXI', width: 28, length: 42, height: 14, speed: [128, 160], weight: 3, body: '#1f1a24', roof: '#f2c23c', kind: 'taxi' },
  { id: 'bus', label: 'COLECTIVO', width: 34, length: 80, height: 26, speed: [92, 112], weight: 0.8, body: '#2a7fc0', roof: '#f4f4f0', kind: 'bus' },
];

export function vehicleTextureKey(id: string, facing: 'front' | 'rear'): string {
  return `vehicle-${id}-${facing}`;
}
