import type { RunReport } from './types';

/**
 * Partidas pendientes de enviar al servidor (sin conexión, sin sesión o con
 * el servidor caído). Quedan guardadas en el dispositivo y se mandan en
 * orden cuando vuelve la conexión con la misma cuenta. Cada partida tiene un
 * id único: si se manda dos veces, el servidor la cuenta una sola vez.
 */
export interface OutboxEntry {
  /** Cuenta y perfil online a los que pertenece la partida. */
  accountId: string;
  profileId: string;
  report: RunReport;
  queuedAt: string;
  attempts: number;
}

export interface OutboxStorage {
  load(): unknown;
  save(value: unknown): void;
}

export const OUTBOX_LIMIT = 60;
/** Más de esto, el servidor ya no acepta la fecha (y probablemente nadie se acuerda de la partida). */
const MAX_AGE_MS = 25 * 24 * 3600 * 1000;

const isEntry = (v: unknown): v is OutboxEntry => {
  const e = v as OutboxEntry;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof e.accountId === 'string' &&
    typeof e.profileId === 'string' &&
    typeof e.queuedAt === 'string' &&
    typeof e.attempts === 'number' &&
    typeof e.report === 'object' &&
    e.report !== null &&
    typeof e.report.clientRunId === 'string'
  );
};

export class Outbox {
  private entries: OutboxEntry[];

  constructor(
    private readonly storage: OutboxStorage,
    private readonly now: () => number = () => Date.now(),
  ) {
    const raw = storage.load();
    const list = Array.isArray(raw) ? raw.filter(isEntry) : [];
    this.entries = list.filter((e) => this.now() - Date.parse(e.queuedAt) < MAX_AGE_MS);
  }

  get size(): number {
    return this.entries.length;
  }

  /** Agrega una partida (si ya estaba, no la duplica). Si se llena, descarta las más viejas. */
  add(accountId: string, profileId: string, report: RunReport): void {
    if (this.entries.some((e) => e.report.clientRunId === report.clientRunId)) return;
    this.entries.push({ accountId, profileId, report, queuedAt: new Date(this.now()).toISOString(), attempts: 0 });
    if (this.entries.length > OUTBOX_LIMIT) this.entries.splice(0, this.entries.length - OUTBOX_LIMIT);
    this.persist();
  }

  /** Pendientes de una cuenta, en el orden en que se jugaron. */
  pendingFor(accountId: string): OutboxEntry[] {
    return this.entries.filter((e) => e.accountId === accountId);
  }

  has(clientRunId: string): boolean {
    return this.entries.some((e) => e.report.clientRunId === clientRunId);
  }

  remove(clientRunId: string): void {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.report.clientRunId !== clientRunId);
    if (this.entries.length !== before) this.persist();
  }

  markAttempt(clientRunId: string): void {
    const e = this.entries.find((x) => x.report.clientRunId === clientRunId);
    if (!e) return;
    e.attempts++;
    this.persist();
  }

  private persist(): void {
    this.storage.save(this.entries);
  }
}
