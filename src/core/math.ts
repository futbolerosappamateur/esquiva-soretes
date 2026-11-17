export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Acerca `current` a `target` sin pasarse, con un paso máximo `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export function formatScore(value: number): string {
  return Math.max(0, Math.floor(value)).toString();
}

/** Formatea con separador de miles al estilo argentino (12.345). */
export function formatThousands(value: number): string {
  const s = Math.max(0, Math.floor(value)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
