import { loadJSON, saveJSON } from './storage';

export interface Records {
  bestScore: number;
  bestDistanceM: number;
  bestBlock: number;
  totalDodged: number;
  gamesPlayed: number;
}

const DEFAULT_RECORDS: Records = {
  bestScore: 0,
  bestDistanceM: 0,
  bestBlock: 0,
  totalDodged: 0,
  gamesPlayed: 0,
};

export interface RunSummary {
  score: number;
  distanceM: number;
  dodged: number;
  blocksCompleted: number;
}

/** Récords personales guardados en LocalStorage. */
class RecordsStore {
  private data: Records = loadJSON('records', DEFAULT_RECORDS);

  get(): Readonly<Records> {
    return this.data;
  }

  /**
   * Actualiza el récord con la puntuación actual de la partida.
   * Se puede llamar varias veces durante una misma partida (al completar cada
   * cuadra y al final); `finished` indica que la partida terminó.
   */
  submit(run: RunSummary, newDodges: number, finished: boolean): { isNewRecord: boolean } {
    const isNewRecord = run.score > this.data.bestScore;
    this.data = {
      bestScore: Math.max(this.data.bestScore, Math.floor(run.score)),
      bestDistanceM: Math.max(this.data.bestDistanceM, Math.floor(run.distanceM)),
      bestBlock: Math.max(this.data.bestBlock, run.blocksCompleted),
      totalDodged: this.data.totalDodged + Math.max(0, newDodges),
      gamesPlayed: this.data.gamesPlayed + (finished ? 1 : 0),
    };
    saveJSON('records', this.data);
    return { isNewRecord };
  }
}

export const records = new RecordsStore();
