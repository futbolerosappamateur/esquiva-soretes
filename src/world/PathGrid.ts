import { PLAYER_TUNING } from '../config/balance';
import { expand, footprintsOverlap, type Footprint } from '../systems/Collision';

/**
 * Grilla de validación de caminos.
 *
 * Cada celda indica si los pies del personaje pueden estar ahí sin tocar
 * ningún obstáculo (se prueba la huella real del jugador, con margen de
 * comodidad). El recorrido válido es "monótono": avanzar hacia la derecha y
 * moverse libremente hacia arriba o abajo en una misma columna. Si existe un
 * camino así, existe siempre una forma de cruzar la cuadra sin pisar nada y
 * sin necesidad de saltar.
 */
export class PathGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  private readonly player: Footprint;

  constructor(
    length: number,
    readonly yMin: number,
    readonly yMax: number,
    readonly cell: number,
    margin: number,
  ) {
    this.cols = Math.ceil(length / cell) + 1;
    this.rows = Math.floor((yMax - yMin) / cell) + 1;
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.player = expand(PLAYER_TUNING.footprint, margin);
  }

  colOf(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell)));
  }

  xOf(col: number): number {
    return col * this.cell;
  }

  yOf(row: number): number {
    return this.yMin + row * this.cell;
  }

  isBlocked(col: number, row: number): boolean {
    return this.blocked[col * this.rows + row] === 1;
  }

  /** Marca las celdas donde la huella del jugador tocaría esta huella. */
  block(x: number, y: number, fp: Footprint): void {
    const reachX = (fp.w + this.player.w) / 2 + this.cell;
    const c0 = this.colOf(x - reachX);
    const c1 = this.colOf(x + reachX);
    for (let c = c0; c <= c1; c++) {
      const px = this.xOf(c);
      for (let r = 0; r < this.rows; r++) {
        if (footprintsOverlap(px, this.yOf(r), this.player, x, y, fp)) this.blocked[c * this.rows + r] = 1;
      }
    }
  }

  snapshot(c0: number, c1: number): { c0: number; data: Uint8Array } {
    const a = Math.max(0, c0);
    const b = Math.min(this.cols - 1, c1);
    return { c0: a, data: this.blocked.slice(a * this.rows, (b + 1) * this.rows) };
  }

  restore(snap: { c0: number; data: Uint8Array }): void {
    this.blocked.set(snap.data, snap.c0 * this.rows);
  }

  /** Filas alcanzables en la columna inicial partiendo desde `y`. */
  startReach(col: number, y: number): Uint8Array {
    const reach = new Uint8Array(this.rows);
    const r0 = Math.max(0, Math.min(this.rows - 1, Math.round((y - this.yMin) / this.cell)));
    if (this.isBlocked(col, r0)) {
      for (let r = 0; r < this.rows; r++) if (!this.isBlocked(col, r)) reach[r] = 1;
      return reach;
    }
    reach[r0] = 1;
    this.flood(col, reach);
    return reach;
  }

  private flood(col: number, reach: Uint8Array): void {
    for (let r = 1; r < this.rows; r++) if (reach[r - 1] && !this.isBlocked(col, r)) reach[r] = 1;
    for (let r = this.rows - 2; r >= 0; r--) if (reach[r + 1] && !this.isBlocked(col, r)) reach[r] = 1;
  }

  /**
   * Propaga el conjunto alcanzable desde la columna c0-1 hasta c1 inclusive y
   * devuelve el conjunto de cada columna. Devuelve null si en algún punto no
   * queda ninguna fila transitable.
   */
  propagateAll(reachIn: Uint8Array, c0: number, c1: number): Uint8Array[] | null {
    const out: Uint8Array[] = [];
    let reach = reachIn;
    for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
      const next = new Uint8Array(this.rows);
      let any = false;
      for (let r = 0; r < this.rows; r++) {
        if (reach[r] && !this.isBlocked(c, r)) {
          next[r] = 1;
          any = true;
        }
      }
      if (!any) return null;
      this.flood(c, next);
      out.push(next);
      reach = next;
    }
    return out;
  }

  /** Primera columna sin paso posible entre c0 y c1, o -1 si todo es transitable. */
  firstDeadColumn(reachIn: Uint8Array, c0: number, c1: number): number {
    let reach = reachIn;
    for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
      const next = new Uint8Array(this.rows);
      let any = false;
      for (let r = 0; r < this.rows; r++) {
        if (reach[r] && !this.isBlocked(c, r)) {
          next[r] = 1;
          any = true;
        }
      }
      if (!any) return c;
      this.flood(c, next);
      reach = next;
    }
    return -1;
  }

  clear(): void {
    this.blocked.fill(0);
  }
}
