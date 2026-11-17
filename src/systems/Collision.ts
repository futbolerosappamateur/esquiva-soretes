/**
 * Colisiones en el plano del suelo (2.5D).
 *
 * Nada colisiona con el dibujo completo del sprite: cada entidad tiene una
 * "huella" en el piso (rectángulo o elipse) centrada en su posición (x, y),
 * donde y es la profundidad dentro de la vereda. La altura del salto (z) se
 * evalúa aparte, por eso saltar no mueve la huella.
 */
export interface Footprint {
  shape: 'rect' | 'ellipse';
  /** Ancho total (eje x). */
  w: number;
  /** Alto total en el plano del suelo (eje de profundidad). */
  h: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Elipse contra rectángulo (exacto): se escala el espacio para que la elipse sea un círculo unitario. */
function ellipseVsRect(ex: number, ey: number, e: Footprint, rx: number, ry: number, r: Footprint): boolean {
  const ax = e.w / 2;
  const ay = e.h / 2;
  const cx = (rx - ex) / ax;
  const cy = (ry - ey) / ay;
  const hw = r.w / 2 / ax;
  const hh = r.h / 2 / ay;
  const px = clamp(0, cx - hw, cx + hw);
  const py = clamp(0, cy - hh, cy + hh);
  return px * px + py * py < 1;
}

/** Elipse contra elipse (aproximación por radios en la dirección de los centros). */
function ellipseVsEllipse(ax: number, ay: number, a: Footprint, bx: number, by: number, b: Footprint): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  const radius = (e: Footprint, ux: number, uy: number) => {
    const rx = e.w / 2;
    const ry = e.h / 2;
    return (rx * ry) / Math.sqrt((ry * ux) ** 2 + (rx * uy) ** 2);
  };
  const ux = dx / dist;
  const uy = dy / dist;
  return dist < radius(a, ux, uy) + radius(b, ux, uy);
}

export function footprintsOverlap(ax: number, ay: number, a: Footprint, bx: number, by: number, b: Footprint): boolean {
  if (a.shape === 'rect' && b.shape === 'rect') {
    return Math.abs(ax - bx) * 2 < a.w + b.w && Math.abs(ay - by) * 2 < a.h + b.h;
  }
  if (a.shape === 'ellipse' && b.shape === 'rect') return ellipseVsRect(ax, ay, a, bx, by, b);
  if (a.shape === 'rect' && b.shape === 'ellipse') return ellipseVsRect(bx, by, b, ax, ay, a);
  return ellipseVsEllipse(ax, ay, a, bx, by, b);
}

/** Devuelve una huella agrandada `margin` píxeles hacia cada lado. */
export function expand(fp: Footprint, margin: number): Footprint {
  return { shape: fp.shape, w: fp.w + margin * 2, h: fp.h + margin * 2 };
}
