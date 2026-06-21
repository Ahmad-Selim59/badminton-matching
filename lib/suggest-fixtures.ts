import {
  AppState,
  Court,
  CourtType,
  Fixture,
  Player,
  playersNeeded,
} from "./types";

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function getCount(counts: Record<string, number>, a: string, b: string): number {
  return counts[pairKey(a, b)] ?? 0;
}

/** Higher = more urgent to play this round. */
export function playerPriority(p: Player): number {
  let score = 0;
  score += p.consecutiveSits * 100;
  score -= p.consecutiveGames * 40;
  score -= p.totalGames * 3;
  if (p.consecutiveGames >= 2) score -= 10_000;
  return score;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  if (size === items.length) return [items];
  const [first, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map((c) => [first, ...c]),
    ...combinations(rest, size),
  ];
}

function bestDoublesSplit(
  ids: [string, string, string, string],
  partnerCounts: Record<string, number>,
  opponentCounts: Record<string, number>
): { playerIds: string[]; score: number } {
  const splits: [[string, string], [string, string]][] = [
    [[ids[0], ids[1]], [ids[2], ids[3]]],
    [[ids[0], ids[2]], [ids[1], ids[3]]],
    [[ids[0], ids[3]], [ids[1], ids[2]]],
  ];

  let best = { playerIds: [...ids] as string[], score: Infinity };

  for (const [team1, team2] of splits) {
    let score = 0;
    score += getCount(partnerCounts, team1[0], team1[1]) * 50;
    score += getCount(partnerCounts, team2[0], team2[1]) * 50;
    for (const a of team1) {
      for (const b of team2) {
        score += getCount(opponentCounts, a, b) * 20;
      }
    }
    const lineup = [...team1, ...team2];
    if (score < best.score) {
      best = { playerIds: lineup, score };
    }
  }

  return best;
}

function pickDoublesFour(
  available: Player[],
  partnerCounts: Record<string, number>,
  opponentCounts: Record<string, number>
): { playerIds: string[]; picked: Player[] } | null {
  if (available.length < 4) return null;

  let best: { playerIds: string[]; picked: Player[]; score: number } | null =
    null;

  for (const combo of combinations(available, 4)) {
    const ids = combo.map((p) => p.id) as [string, string, string, string];
    const split = bestDoublesSplit(ids, partnerCounts, opponentCounts);
    const prioritySum = combo.reduce((s, p) => s + playerPriority(p), 0);
    const score = split.score - prioritySum;

    if (!best || score < best.score) {
      best = { playerIds: split.playerIds, picked: combo, score };
    }
  }

  return best;
}

function pickSinglesTwo(
  available: Player[],
  opponentCounts: Record<string, number>
): { playerIds: string[]; picked: Player[] } | null {
  if (available.length < 2) return null;

  let best: { playerIds: string[]; picked: Player[]; score: number } | null =
    null;

  for (const combo of combinations(available, 2)) {
    const [a, b] = combo;
    const score =
      getCount(opponentCounts, a.id, b.id) * 20 -
      (playerPriority(a) + playerPriority(b));

    if (!best || score < best.score) {
      best = { playerIds: [a.id, b.id], picked: combo, score };
    }
  }

  return best;
}

function buildPlayPool(players: Player[], slotsNeeded: number): Player[] {
  const rested = players.filter((p) => p.consecutiveGames < 2);
  const pool =
    rested.length >= slotsNeeded
      ? rested
      : [...players].sort((a, b) => a.consecutiveGames - b.consecutiveGames);

  return [...pool].sort((a, b) => playerPriority(b) - playerPriority(a));
}

/** Pick round type for this court — never returns a type we can't fully staff. */
function resolveRoundType(
  court: Court,
  availableCount: number
): CourtType | null {
  if (court.type === "doubles" && availableCount >= 4) return "doubles";
  if (court.type === "singles" && availableCount >= 2) return "singles";
  // Not enough for configured type — use leftovers as singles (never 2v1)
  if (availableCount >= 4) return "doubles";
  if (availableCount >= 2) return "singles";
  return null;
}

function emptyFixture(court: Court): Fixture {
  return {
    courtId: court.id,
    playerIds: Array(playersNeeded(court.type)).fill(""),
    active: false,
  };
}

function assignPick(
  court: Court,
  roundType: CourtType,
  pick: { playerIds: string[]; picked: Player[] }
): Fixture {
  return {
    courtId: court.id,
    playerIds: pick.playerIds,
    roundType: roundType !== court.type ? roundType : undefined,
    active: true,
  };
}

export function suggestFixtures(state: AppState): Fixture[] {
  const courts = [...state.courts].sort((a, b) => a.number - b.number);

  if (state.players.length === 0 || courts.length === 0) {
    return courts.map((c) => ({
      courtId: c.id,
      playerIds: Array(playersNeeded(c.type)).fill(""),
      active: false,
    }));
  }

  const maxSlots = Math.min(
    state.players.length,
    courts.reduce((sum, c) => sum + playersNeeded(c.type), 0)
  );
  let available = buildPlayPool(state.players, maxSlots);
  const fixtures: Fixture[] = [];

  for (const court of courts) {
    const roundType = resolveRoundType(court, available.length);

    if (!roundType) {
      fixtures.push(emptyFixture(court));
      continue;
    }

    if (roundType === "doubles") {
      const pick = pickDoublesFour(
        available,
        state.partnerCounts,
        state.opponentCounts
      );
      if (!pick) {
        fixtures.push(emptyFixture(court));
        continue;
      }
      fixtures.push(assignPick(court, roundType, pick));
      const pickedIds = new Set(pick.picked.map((p) => p.id));
      available = available.filter((p) => !pickedIds.has(p.id));
    } else {
      const pick = pickSinglesTwo(available, state.opponentCounts);
      if (!pick) {
        fixtures.push(emptyFixture(court));
        continue;
      }
      fixtures.push(assignPick(court, roundType, pick));
      const pickedIds = new Set(pick.picked.map((p) => p.id));
      available = available.filter((p) => !pickedIds.has(p.id));
    }
  }

  return fixtures;
}

export function fixtureRoundType(
  fixture: Fixture,
  court: Court
): CourtType {
  return fixture.roundType ?? court.type;
}

export function isBalancedFixture(
  fixture: Fixture,
  court: Court
): boolean {
  const type = fixtureRoundType(fixture, court);
  const filled = fixture.playerIds.filter(Boolean).length;
  return filled === 0 || filled === playersNeeded(type);
}

export function recordMatchHistory(
  fixtures: Fixture[],
  courts: Court[],
  partnerCounts: Record<string, number>,
  opponentCounts: Record<string, number>
): {
  partnerCounts: Record<string, number>;
  opponentCounts: Record<string, number>;
} {
  const partners = { ...partnerCounts };
  const opponents = { ...opponentCounts };
  const courtMap = new Map(courts.map((c) => [c.id, c]));

  function bump(counts: Record<string, number>, a: string, b: string) {
    const key = pairKey(a, b);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  for (const fixture of fixtures) {
    const court = courtMap.get(fixture.courtId);
    if (!court || fixture.active === false) continue;
    if (!isBalancedFixture(fixture, court)) continue;

    const type = fixtureRoundType(fixture, court);
    const ids = fixture.playerIds.filter(Boolean);
    if (ids.length < playersNeeded(type)) continue;

    if (type === "doubles") {
      const [a, b, c, d] = ids;
      bump(partners, a, b);
      bump(partners, c, d);
      for (const x of [a, b]) {
        for (const y of [c, d]) {
          bump(opponents, x, y);
        }
      }
    } else {
      bump(opponents, ids[0], ids[1]);
    }
  }

  return { partnerCounts: partners, opponentCounts: opponents };
}
