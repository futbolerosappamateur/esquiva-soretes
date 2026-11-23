/**
 * Especificaciones de las fachadas porteñas (datos puros, sin gráficos).
 * El generador de texturas (textures/facadeTextures.ts) las dibuja; el
 * generador de niveles sólo necesita sus anchos.
 */

export type ShopKind = 'kiosco' | 'verduleria' | 'antiguedades' | 'almacen' | 'bar' | 'cafe' | 'pizzeria' | 'farmacia';

export interface FacadeSpec {
  id: string;
  width: number;
  /** Pisos superiores (0 a 3). */
  floors: number;
  wall: string;
  trim: string;
  ground: 'door' | 'shop' | 'garage' | 'wall';
  shop?: ShopKind;
  /** Madera de puertas y persianas. */
  wood: string;
  roof: 'balustrade' | 'cornice' | 'dome' | 'parapet';
  tank?: boolean;
  ac?: boolean;
  posters?: number;
  graffiti?: boolean;
  plants?: boolean;
  /** Bandera en el balcón de arriba: la argentina (true) o una de Vélez (blanca con la V azul). */
  flag?: boolean | 'velez';
  /** Paredón pintado (en vez de los grafitis de siempre): la V azul de los hinchas de Vélez. */
  mural?: 'velez';
  cat?: boolean;
  /** Edificio de esquina: lado de la ochava. */
  corner?: 'left' | 'right';
}

/** Fachadas disponibles para San Telmo. */
export const FACADE_SPECS: FacadeSpec[] = [
  { id: 'casa-rosa', width: 112, floors: 1, wall: '#e8a7a0', trim: '#f6eedc', ground: 'door', wood: '#2f5a3a', roof: 'balustrade', plants: true, posters: 1 },
  { id: 'kiosco', width: 112, floors: 2, wall: '#e9c46a', trim: '#fff1cf', ground: 'shop', shop: 'kiosco', wood: '#5a3a22', roof: 'cornice', tank: true, ac: true },
  { id: 'verduleria', width: 120, floors: 1, wall: '#9cc5c9', trim: '#eef6f2', ground: 'shop', shop: 'verduleria', wood: '#3b4f63', roof: 'parapet', tank: true },
  { id: 'garage', width: 100, floors: 2, wall: '#f1e3c6', trim: '#ffffff', ground: 'garage', wood: '#6b4a2f', roof: 'balustrade', graffiti: true, ac: true, flag: true, posters: 2 },
  { id: 'antiguedades', width: 120, floors: 2, wall: '#c95f4b', trim: '#f2dcc0', ground: 'shop', shop: 'antiguedades', wood: '#3a2a20', roof: 'balustrade', plants: true, cat: true },
  { id: 'casa-ocre', width: 104, floors: 1, wall: '#d8b48a', trim: '#f7ead2', ground: 'door', wood: '#5a3a22', roof: 'cornice', posters: 3, graffiti: true },
  { id: 'almacen', width: 112, floors: 2, wall: '#b9c48f', trim: '#f2f2dc', ground: 'shop', shop: 'almacen', wood: '#4a3a2a', roof: 'parapet', tank: true, plants: true },
  { id: 'bar', width: 120, floors: 3, wall: '#a7b8d6', trim: '#f4f4f0', ground: 'shop', shop: 'bar', wood: '#2b2530', roof: 'balustrade', ac: true, plants: true },
  { id: 'casa-terracota', width: 112, floors: 2, wall: '#d9826a', trim: '#f6e2cc', ground: 'door', wood: '#2f5a3a', roof: 'balustrade', plants: true, ac: true, posters: 1 },
  { id: 'pizzeria', width: 112, floors: 1, wall: '#f0d58a', trim: '#fff6dc', ground: 'shop', shop: 'pizzeria', wood: '#7a2a20', roof: 'cornice', tank: true },
  { id: 'farmacia', width: 112, floors: 2, wall: '#efe6d2', trim: '#ffffff', ground: 'shop', shop: 'farmacia', wood: '#3a5a4a', roof: 'cornice', ac: true },
  { id: 'paredon', width: 92, floors: 0, wall: '#c9b8a0', trim: '#e6dccb', ground: 'wall', wood: '#5a3a22', roof: 'parapet', posters: 3 },
  { id: 'casa-celeste', width: 104, floors: 2, wall: '#9fc7e6', trim: '#ffffff', ground: 'door', wood: '#5a3a22', roof: 'balustrade', plants: true, flag: true },
  { id: 'casa-bordo', width: 112, floors: 1, wall: '#a4473f', trim: '#efd8c0', ground: 'door', wood: '#2f3a5a', roof: 'cornice', posters: 2, graffiti: true, tank: true },
];

/**
 * Edificios de esquina con cúpula (comienzo y final de cada cuadra).
 * Son de un piso para que la cúpula entre en pantalla y sirva de referencia.
 */
/**
 * Versalles: casas bajas (de una planta, algunas de dos) y vecinos hinchas de
 * Vélez. Van aparte de FACADE_SPECS: sumar fachadas ahí cambiaría los niveles
 * de San Telmo (el generador elige entre esa lista).
 */
export const VERSALLES_SPECS: FacadeSpec[] = [
  { id: 'casa-fortinera', width: 104, floors: 1, wall: '#f2efe6', trim: '#2456a8', ground: 'door', wood: '#2456a8', roof: 'parapet', plants: true, flag: 'velez' },
  { id: 'casa-baja-blanca', width: 96, floors: 0, wall: '#ece7dc', trim: '#ffffff', ground: 'door', wood: '#5a3a22', roof: 'parapet', plants: true },
  { id: 'casa-baja-verde', width: 100, floors: 0, wall: '#b9cfa5', trim: '#f3f1e4', ground: 'door', wood: '#3b5a3a', roof: 'cornice', plants: true, posters: 1 },
  { id: 'casa-baja-celeste', width: 100, floors: 0, wall: '#a9cbe3', trim: '#ffffff', ground: 'door', wood: '#2456a8', roof: 'parapet', plants: true },
  { id: 'paredon-fortinero', width: 92, floors: 0, wall: '#e6e2d8', trim: '#ffffff', ground: 'wall', wood: '#5a3a22', roof: 'parapet', mural: 'velez' },
];

export const CORNER_SPECS: FacadeSpec[] = [
  { id: 'esquina-inicio', width: 128, floors: 1, wall: '#e2c79f', trim: '#fbf1dc', ground: 'shop', shop: 'cafe', wood: '#2b2530', roof: 'dome', plants: true, corner: 'left' },
  { id: 'esquina-final', width: 128, floors: 1, wall: '#d6a49a', trim: '#fbefe6', ground: 'shop', shop: 'cafe', wood: '#3a2a20', roof: 'dome', ac: true, corner: 'right' },
];
