export type CourtType = "singles" | "doubles";

export interface Court {
  id: string;
  number: number;
  name: string;
  type: CourtType;
}

export interface Player {
  id: string;
  name: string;
  totalGames: number;
  consecutiveGames: number;
  consecutiveSits: number;
}

export interface Fixture {
  courtId: string;
  playerIds: string[];
  /** Overrides court type for this round only (e.g. doubles court → singles). */
  roundType?: CourtType;
  /** False when suggest leaves this court unused. */
  active?: boolean;
}

export interface HistoryMatch {
  courtName: string;
  courtNumber: number;
  type: CourtType;
  team1: string[];
  team2: string[];
}

export interface RoundRecord {
  id: string;
  roundNumber: number;
  recordedAt: string;
  matches: HistoryMatch[];
  satOut: string[];
}

export interface AppState {
  courts: Court[];
  players: Player[];
  fixtures: Fixture[];
  /** Times two players were partners (doubles same team). Key: sorted id pair. */
  partnerCounts: Record<string, number>;
  /** Times two players faced each other. Key: sorted id pair. */
  opponentCounts: Record<string, number>;
  /** Times the same four played doubles on one court. Key: sorted four ids. */
  foursomeCounts: Record<string, number>;
  /** Times three players shared a doubles court. Key: sorted three ids. */
  tripletCounts: Record<string, number>;
  roundHistory: RoundRecord[];
}

export const DEFAULT_STATE: AppState = {
  courts: [],
  players: [],
  fixtures: [],
  partnerCounts: {},
  opponentCounts: {},
  foursomeCounts: {},
  tripletCounts: {},
  roundHistory: [],
};

export function playersNeeded(type: CourtType): number {
  return type === "singles" ? 2 : 4;
}
