/**
 * Envoltorio seguro de LocalStorage. Si el navegador lo bloquea (modo privado,
 * cuotas, etc.) el juego sigue funcionando sin guardar datos.
 */
const PREFIX = 'esquivaSoretes:';

export function loadJSON<T extends object>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return { ...fallback };
  }
}

/** Devuelve el valor guardado tal cual (sin validar) o null. */
export function loadRaw(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento disponible: se ignora en silencio.
  }
}
