import { AppState, DEFAULT_STATE, Player } from "./types";

const STORAGE_KEY = "badminton-match-maker";

function normalizePlayer(p: Player & { consecutiveSits?: number }): Player {
  return {
    ...p,
    consecutiveSits: p.consecutiveSits ?? 0,
  };
}

function normalizeState(parsed: Partial<AppState>): AppState {
  return {
    ...DEFAULT_STATE,
    ...parsed,
    players: (parsed.players ?? []).map(normalizePlayer),
    partnerCounts: parsed.partnerCounts ?? {},
    opponentCounts: parsed.opponentCounts ?? {},
    roundHistory: parsed.roundHistory ?? [],
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return normalizeState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
