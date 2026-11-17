/** Utilidades de color para el dibujo procedural. */

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Mezcla lineal entre dos colores (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color. amount en [-1, 1]. */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#000000', -amount);
}

/** Oscurece con un leve corrimiento hacia violeta, más lindo que el negro puro en pixel art. */
export function shadow(hex: string, amount = 0.25): string {
  return mix(hex, '#2a1838', amount);
}
