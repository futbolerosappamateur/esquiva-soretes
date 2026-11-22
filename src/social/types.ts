import type { AchievementCounts } from '../data/achievements';
import type { GameMode } from '../core/leaderboard';

/**
 * Datos que intercambian el juego y el servidor online (ver las funciones
 * RPC en supabase/migrations). Todo lo que viene del servidor se trata como
 * no confiable hasta pasar por las funciones de mapeo.
 */

export type Visibility = 'public' | 'friends' | 'private';
export type RunStatus = 'valid' | 'suspicious' | 'rejected' | 'unverified';

export interface OnlineProfile {
  id: string;
  nickname: string;
  avatarId: string;
  favoriteCharacter: string | null;
  supervised: boolean;
  visibility: Visibility;
  showInRankings: boolean;
  socialEnabled: boolean;
  importedAt: string | null;
  nicknameChangedAt: string | null;
  createdAt: string;
}

export interface OnlineStats {
  coins: number;
  coinsEarned: number;
  runsPlayed: number;
  runsCompleted: number;
  levelsCompleted: number;
  crossings: number;
  carHits: number;
  poopsDodged: number;
  playTimeMs: number;
  bestStreak: number;
}

/** Estado completo de un perfil online (su progreso guardado en el servidor). */
export interface ProfileState {
  profile: OnlineProfile;
  stats: OnlineStats;
  levels: Record<string, { completed: boolean; stars: number; bestScore: number; plays: number; source: 'game' | 'import' }>;
  achievements: AchievementCounts;
  characters: { id: string; source: 'starter' | 'challenge' | 'import' }[];
  badges: { id: string; earnedAt: string }[];
  missionRewards: string[];
}

export interface AccountInfo {
  adultConfirmed: boolean;
  termsVersion: string | null;
  role: string;
  banned: boolean;
  createdAt: string;
}

export interface MyState {
  account: AccountInfo | null;
  profiles: ProfileState[];
  limits: { maxProfiles: number };
}

/** Lo que el juego manda al terminar una partida (completa o no). */
export interface RunReport {
  clientRunId: string;
  parentRunId: string | null;
  levelId: string;
  mode: GameMode;
  characterId: string;
  completed: boolean;
  timeMs: number;
  /** Tiempo con el que arrancó el cronómetro (al retomar desde una esquina). */
  startTimeMs: number;
  score: number;
  assisted: boolean;
  assistReasons: ('checkpoint' | 'debug')[];
  continues: number;
  startBlock: number;
  blocksCompleted: number;
  shoesLeft: number;
  breakdown: { distance: number; dodge: number; bonus: number; penalty: number; crossing: number; speed: number };
  /** Totales de la partida (para validar contra el nivel). */
  counts: { dodged: number; bestStreak: number; closeCalls: number; crossings: number; carHits: number; missions: number };
  /** Lo que sumó ESTE intento (al retomar desde una esquina no se cuenta dos veces lo anterior). */
  attempt: { dodged: number; crossings: number; carHits: number; missions: number; coinsBanked: number; achievements: AchievementCounts };
  splits: number[];
  playedAt: string;
  clientVersion: string;
  /** Registro de eventos (por ahora un resumen por esquina; base para una verificación más robusta). */
  events?: { v: number; splits: number[] };
}

export interface RunRewards {
  coins: number;
  starCoins: number;
  newStars: number;
  stars: number;
  firstCompletion: boolean;
  unlockedCharacters: string[];
  badges: string[];
}

export interface RunResult {
  runId: string;
  clientRunId: string;
  status: RunStatus;
  reasons: string[];
  official: boolean;
  duplicate: boolean;
  rewards: RunRewards;
  ranks: { speed: number | null; score: number | null };
  state: ProfileState;
}

export type LeaderboardKind = 'speed' | 'score' | 'character';
export type LeaderboardScope = 'global' | 'friends';

export interface LeaderboardRow {
  rank: number;
  profileId: string;
  nickname: string;
  avatarId: string;
  characterId: string;
  timeMs: number | null;
  score: number;
  playedAt: string;
  isMe: boolean;
  isFriend: boolean;
}

export interface LeaderboardResult {
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
}

export interface PublicProfile {
  profileId: string;
  nickname: string;
  avatarId: string;
  visibility: Visibility;
  limited: boolean;
  socialEnabled: boolean;
  friendStatus: 'none' | 'friends' | 'outgoing' | 'incoming';
  blockedByMe: boolean;
  favoriteCharacter: string | null;
  memberSince: string | null;
  stats: { levelsCompleted: number; runsCompleted: number; poopsDodged: number; bestStreak: number } | null;
  badges: string[] | null;
  characters: string[] | null;
}

export interface HistoryEntry {
  runId: string;
  levelId: string;
  mode: GameMode;
  characterId: string;
  completed: boolean;
  timeMs: number | null;
  score: number;
  assisted: boolean;
  status: RunStatus;
  reasons: string[];
  official: boolean;
  source: 'game' | 'import';
  playedAt: string;
}

export interface PersonalRecord {
  levelId: string;
  mode: GameMode;
  bestTime: { timeMs: number; characterId: string; playedAt: string } | null;
  bestScore: { score: number; characterId: string; assisted: boolean; playedAt: string } | null;
  unverifiedTime: { timeMs: number; characterId: string; playedAt: string } | null;
  unverifiedScore: { score: number; characterId: string; playedAt: string } | null;
}

export interface ProfileCard {
  profileId: string;
  nickname: string;
  avatarId: string;
}

export interface ImportPayload {
  levels: Record<string, { completed: boolean; stars: number; bestScore: number; plays: number }>;
  coins: number;
  achievements: AchievementCounts;
  missionRewards: string[];
  records: { id: string; levelId: string; mode: GameMode; characterId: string; timeMs: number | null; score: number; date: string; assisted: boolean }[];
}
