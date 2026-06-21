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

export function groupKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

function getCount(counts: Record<string, number>, a: string, b: string): number {
  return counts[pairKey(a, b)] ?? 0;
}

function tripletKeys(ids: [string, string, string, string]): string[] {
  const [a, b, c, d] = ids;
  return [
    groupKey([a, b, c]),
    groupKey([a, b, d]),
    groupKey([a, c, d]),
    groupKey([b, c, d]),
  ];
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

/** Penalty for reusing the same court group. Lower = fresher foursome. */
function foursomeRepeatScore(
  ids: [string, string, string, string],
  foursomeCounts: Record<string, number> = {},
  tripletCounts: Record<string, number> = {}
): number {
  let score = (foursomeCounts[groupKey(ids)] ?? 0) * 300;
  for (const key of tripletKeys(ids)) {
    score += (tripletCounts[key] ?? 0) * 80;
  }
  return score;
}

/** Stable 2v2 from four ids — no team-split search. */
function defaultDoublesLineup(
  ids: [string, string, string, string]
): string[] {
  const sorted = [...ids].sort();
  return [sorted[0], sorted[1], sorted[2], sorted[3]];
}

function pickDoublesFour(
  available: Player[],
  foursomeCounts: Record<string, number>,
  tripletCounts: Record<string, number>
): { playerIds: string[]; picked: Player[] } | null {
  if (available.length < 4) return null;

  let best: { playerIds: string[]; picked: Player[]; score: number } | null =
    null;

  for (const combo of combinations(available, 4)) {
    const ids = combo.map((p) => p.id) as [string, string, string, string];
    const repeatScore = foursomeRepeatScore(ids, foursomeCounts, tripletCounts);
    const prioritySum = combo.reduce((s, p) => s + playerPriority(p), 0);
    const score = repeatScore - prioritySum;

    if (!best || score < best.score) {
      best = {
        playerIds: defaultDoublesLineup(ids),
        picked: combo,
        score,
      };
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
  const s: AppState = {
    ...state,
    foursomeCounts: state.foursomeCounts ?? {},
    tripletCounts: state.tripletCounts ?? {},
    partnerCounts: state.partnerCounts ?? {},
    opponentCounts: state.opponentCounts ?? {},
  };

  const courts = [...s.courts].sort((a, b) => a.number - b.number);

  if (s.players.length === 0 || courts.length === 0) {
    return courts.map((c) => ({
      courtId: c.id,
      playerIds: Array(playersNeeded(c.type)).fill(""),
      active: false,
    }));
  }

  const maxSlots = Math.min(
    s.players.length,
    courts.reduce((sum, c) => sum + playersNeeded(c.type), 0)
  );
  let available = buildPlayPool(s.players, maxSlots);
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
        s.foursomeCounts,
        s.tripletCounts
      );
      if (!pick) {
        fixtures.push(emptyFixture(court));
        continue;
      }
      fixtures.push(assignPick(court, roundType, pick));
      const pickedIds = new Set(pick.picked.map((p) => p.id));
      available = available.filter((p) => !pickedIds.has(p.id));
    } else {
      const pick = pickSinglesTwo(available, s.opponentCounts);
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

export function fixtureRoundType(fixture: Fixture, court: Court): CourtType {
  return fixture.roundType ?? court.type;
}

export function isBalancedFixture(fixture: Fixture, court: Court): boolean {
  const type = fixtureRoundType(fixture, court);
  const filled = fixture.playerIds.filter(Boolean).length;
  return filled === 0 || filled === playersNeeded(type);
}

function bumpCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function recordMatchHistory(
  fixtures: Fixture[],
  courts: Court[],
  partnerCounts: Record<string, number>,
  opponentCounts: Record<string, number>,
  foursomeCounts: Record<string, number>,
  tripletCounts: Record<string, number>
): {
  partnerCounts: Record<string, number>;
  opponentCounts: Record<string, number>;
  foursomeCounts: Record<string, number>;
  tripletCounts: Record<string, number>;
} {
  const partners = { ...(partnerCounts ?? {}) };
  const opponents = { ...(opponentCounts ?? {}) };
  const foursomes = { ...(foursomeCounts ?? {}) };
  const triplets = { ...(tripletCounts ?? {}) };
  const courtMap = new Map(courts.map((c) => [c.id, c]));

  function bumpPair(counts: Record<string, number>, a: string, b: string) {
    bumpCount(counts, pairKey(a, b));
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
      const four = [a, b, c, d] as [string, string, string, string];
      bumpCount(foursomes, groupKey(four));
      for (const key of tripletKeys(four)) {
        bumpCount(triplets, key);
      }
      bumpPair(partners, a, b);
      bumpPair(partners, c, d);
      for (const x of [a, b]) {
        for (const y of [c, d]) {
          bumpPair(opponents, x, y);
        }
      }
    } else {
      bumpPair(opponents, ids[0], ids[1]);
    }
  }

  return {
    partnerCounts: partners,
    opponentCounts: opponents,
    foursomeCounts: foursomes,
    tripletCounts: triplets,
  };
}
