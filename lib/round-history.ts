import {
  fixtureRoundType,
  isBalancedFixture,
  recordMatchHistory,
} from "./suggest-fixtures";
import { AppState, HistoryMatch, RoundRecord } from "./types";

function playerName(state: AppState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? "Unknown";
}

export function buildRoundRecord(state: AppState): RoundRecord | null {
  const playingIds = new Set<string>();
  const matches: HistoryMatch[] = [];

  const courts = [...state.courts].sort((a, b) => a.number - b.number);

  for (const court of courts) {
    const fixture = state.fixtures.find((f) => f.courtId === court.id);
    if (!fixture || fixture.active === false) continue;
    if (!isBalancedFixture(fixture, court)) continue;

    const ids = fixture.playerIds.filter(Boolean);
    if (ids.length === 0) continue;

    const type = fixtureRoundType(fixture, court);
    for (const id of ids) playingIds.add(id);

    if (type === "doubles") {
      const [a, b, c, d] = ids;
      matches.push({
        courtName: court.name,
        courtNumber: court.number,
        type,
        team1: [playerName(state, a), playerName(state, b)],
        team2: [playerName(state, c), playerName(state, d)],
      });
    } else {
      const [a, b] = ids;
      matches.push({
        courtName: court.name,
        courtNumber: court.number,
        type,
        team1: [playerName(state, a)],
        team2: [playerName(state, b)],
      });
    }
  }

  if (matches.length === 0) return null;

  const satOut = state.players
    .filter((p) => !playingIds.has(p.id))
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b));

  const roundNumber = state.roundHistory.length + 1;

  return {
    id: crypto.randomUUID(),
    roundNumber,
    recordedAt: new Date().toISOString(),
    matches,
    satOut,
  };
}

export function formatTeam(names: string[]): string {
  return names.join(" & ");
}

export function formatMatchLine(match: HistoryMatch): string {
  const teams = `${formatTeam(match.team1)} vs ${formatTeam(match.team2)}`;
  const type =
    match.type === "singles" ? "Singles" : "Doubles";
  return `${match.courtName} · ${type} — ${teams}`;
}

export function formatRecordedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function applyRecordRound(prev: AppState): {
  next: AppState;
  round: RoundRecord | null;
} {
  const roundRecord = buildRoundRecord(prev);
  if (!roundRecord) return { next: prev, round: null };

  const playingIds = new Set<string>();
  for (const fixture of prev.fixtures) {
    if (fixture.active === false) continue;
    const court = prev.courts.find((c) => c.id === fixture.courtId);
    if (!court || !isBalancedFixture(fixture, court)) continue;
    for (const pid of fixture.playerIds) {
      if (pid) playingIds.add(pid);
    }
  }

  const players = prev.players.map((p) => {
    if (playingIds.has(p.id)) {
      return {
        ...p,
        totalGames: p.totalGames + 1,
        consecutiveGames: p.consecutiveGames + 1,
        consecutiveSits: 0,
      };
    }
    return {
      ...p,
      consecutiveGames: 0,
      consecutiveSits: p.consecutiveSits + 1,
    };
  });

  const { partnerCounts, opponentCounts } = recordMatchHistory(
    prev.fixtures,
    prev.courts,
    prev.partnerCounts,
    prev.opponentCounts
  );

  return {
    round: roundRecord,
    next: {
      ...prev,
      players,
      partnerCounts,
      opponentCounts,
      roundHistory: [roundRecord, ...prev.roundHistory],
    },
  };
}
