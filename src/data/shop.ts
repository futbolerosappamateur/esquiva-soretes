import { CHARACTERS } from './characters';

/**
 * Tienda del barrio: PREPARADA, TODAVÍA CERRADA (no hay compras en la v0.3).
 *
 * Las monedas que se juntan jugando quedan guardadas para esta tienda. Reglas:
 *  - sólo monedas del juego, nunca dinero real;
 *  - las monedas no son puntos: gastarlas no cambia ningún récord;
 *  - los personajes que se ganan con desafíos NO se venden.
 * Cuando lleguen los gráficos definitivos, cada artículo apunta a su recurso.
 */
export type ShopCategory = 'clothes' | 'sneakers' | 'accessories' | 'variants' | 'animations' | 'characters';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  /** Precio en monedas del juego. */
  price: number;
  /** false = se muestra como "próximamente" (todavía no se puede comprar). */
  available: boolean;
  /** Para quién es (si es de un personaje en particular). */
  characterId?: string;
}

/** La tienda abre cuando haya artículos con gráficos definitivos. */
export const SHOP_OPEN = false;

export const SHOP_CATEGORIES: Record<ShopCategory, string> = {
  clothes: 'ROPA',
  sneakers: 'ZAPATILLAS',
  accessories: 'ACCESORIOS',
  variants: 'COLORES',
  animations: 'FESTEJOS',
  characters: 'PERSONAJES',
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'shirt-albiceleste', category: 'clothes', name: 'REMERA ALBICELESTE', price: 120, available: false },
  { id: 'hoodie-barrio', category: 'clothes', name: 'BUZO DEL BARRIO', price: 160, available: false },
  { id: 'sneakers-white', category: 'sneakers', name: 'ZAPATILLAS BLANCAS IMPECABLES', price: 200, available: false },
  { id: 'sneakers-boots', category: 'sneakers', name: 'BOTAS DE LLUVIA', price: 180, available: false },
  { id: 'cap-red', category: 'accessories', name: 'GORRA ROJA', price: 90, available: false },
  { id: 'scooter-neon', category: 'variants', name: 'MONOPATÍN NEÓN', price: 150, available: false, characterId: 'player_skater' },
  { id: 'dance-murga', category: 'animations', name: 'FESTEJO MURGUERO', price: 220, available: false },
];

/** Los personajes que se desbloquean con desafíos nunca se venden. */
export function isSellable(item: ShopItem): boolean {
  if (item.category !== 'characters') return true;
  const def = CHARACTERS.find((c) => c.id === item.characterId);
  return !!def && def.unlock.kind === 'starter';
}
