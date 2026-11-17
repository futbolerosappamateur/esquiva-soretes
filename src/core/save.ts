import { createDefaultSave, migrateSave, type SaveData } from './progress';
import { loadRaw, saveJSON } from './storage';

const KEY = 'save';

type Listener = (save: Readonly<SaveData>) => void;

/**
 * Progreso persistente (campaña, monedas, personajes) en LocalStorage.
 * Convive con las claves de la v0.1 ('records' y 'settings'), que no se tocan:
 * los récords existentes se conservan siempre.
 */
class SaveStore {
  private data: SaveData;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.data = migrateSave(loadRaw(KEY));
    this.persist();
  }

  get(): Readonly<SaveData> {
    return this.data;
  }

  /** Aplica un cambio y lo guarda en el acto. */
  update<T>(mutate: (draft: SaveData) => T): T {
    const result = mutate(this.data);
    this.persist();
    this.listeners.forEach((l) => l(this.data));
    return result;
  }

  /** Reinicia la campaña, las monedas y los personajes (con confirmación desde Opciones). */
  resetProgress(): void {
    this.data = createDefaultSave();
    this.persist();
    this.listeners.forEach((l) => l(this.data));
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persist(): void {
    saveJSON(KEY, this.data);
  }
}

export const saveStore = new SaveStore();
