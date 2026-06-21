import {
  AppState,
  Court,
  CourtType,
  Fixture,
  Player,
  playersNeeded,
} from "./types";

// --- Scoring weights (higher score = better assignment) ---
const NEVER_TOGETHER = 10;
const NOT_RECENT = 5;
const REPEAT_PENALTY = 20;
/** Extra penalty when the same two were partners last recorded round. */
const RECENT_PARTNER_PENALTY = 40;
/** Extra penalty when the same two faced each other last recorded round. */
const RECENT_OPPONENT_PENALTY = 25;
const FOURSOME_REPEAT = 20;
const TRIPLET_REPEAT = 15;
const FAIRNESS_SIT = 8;
const FAIRNESS_UNDERPLAYED = 4;
const MUST_SIT_PENALTY = 100;

const OPTIMIZER_ATTEMPTS = 12;
/** Max players considered per doubles pick — keeps C(n,4) tractable. */
const MAX_DOUBLES_CANDIDATES = 12;
const MAX_SINGLES_CANDIDATES = 14;
/** Hard cap on local-search sweeps so refinement can never freeze the UI. */
const MAX_REFINE_SWEEPS = 6;
/** Minimum total-score gain required to accept a swap (avoids churn). */
const SWAP_EPSILON = 0.001;

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export function groupKey(ids: string[]): string {
  return [...ids].sort().join("|");
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

function allPairs(ids: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

interface ScoringContext {
  partnerCounts: Record<string, number>;
  opponentCounts: Record<string, number>;
  foursomeCounts: Record<string, number>;
  tripletCounts: Record<string, number>;
  recentPartners: Set<string>;
  recentOpponents: Set<string>;
  recentFoursomes: Set<string>;
  recentTriplets: Set<string>;
  players: Player[];
}

function buildScoringContext(state: AppState): ScoringContext {
  const recentPartners = new Set<string>();
  const recentOpponents = new Set<string>();
  const recentFoursomes = new Set<string>();
  const recentTriplets = new Set<string>();

  const nameToId = new Map(
    state.players.map((p) => [p.name.toLowerCase(), p.id])
  );
  const lastRound = state.roundHistory[0];

  if (lastRound) {
    for (const match of lastRound.matches) {
      const ids = [...match.team1, ...match.team2]
        .map((n) => nameToId.get(n.toLowerCase()))
        .filter((id): id is string => Boolean(id));

      if (match.type === "doubles" && ids.length === 4) {
        const [a, b, c, d] = ids;
        recentPartners.add(pairKey(a, b));
        recentPartners.add(pairKey(c, d));
        for (const x of [a, b]) {
          for (const y of [c, d]) {
            recentOpponents.add(pairKey(x, y));
          }
        }
        const four = ids as [string, string, string, string];
        recentFoursomes.add(groupKey(four));
        for (const tk of tripletKeys(four)) {
          recentTriplets.add(tk);
        }
      } else if (match.type === "singles" && ids.length === 2) {
        recentOpponents.add(pairKey(ids[0], ids[1]));
      }
    }
  }

  return {
    partnerCounts: state.partnerCounts ?? {},
    opponentCounts: state.opponentCounts ?? {},
    foursomeCounts: state.foursomeCounts ?? {},
    tripletCounts: state.tripletCounts ?? {},
    recentPartners,
    recentOpponents,
    recentFoursomes,
    recentTriplets,
    players: state.players,
  };
}

function recentPairPenalty(
  a: string,
  b: string,
  ctx: ScoringContext,
  relationship: "partner" | "opponent" | "together"
): number {
  const key = pairKey(a, b);
  if (relationship === "partner" || relationship === "together") {
    if (ctx.recentPartners.has(key)) return -RECENT_PARTNER_PENALTY;
  }
  if (relationship === "opponent" || relationship === "together") {
    if (ctx.recentOpponents.has(key)) return -RECENT_OPPONENT_PENALTY;
  }
  return 0;
}

function pairInteractionScore(
  a: string,
  b: string,
  ctx: ScoringContext,
  relationship: "partner" | "opponent" | "together" = "together"
): number {
  const key = pairKey(a, b);
  const times =
    (ctx.partnerCounts[key] ?? 0) + (ctx.opponentCounts[key] ?? 0);
  let score = 0;
  if (times === 0) score += NEVER_TOGETHER;
  else {
    score -= times * REPEAT_PENALTY;
    const wasRecent =
      ctx.recentPartners.has(key) || ctx.recentOpponents.has(key);
    if (!wasRecent) score += NOT_RECENT;
  }
  score += recentPairPenalty(a, b, ctx, relationship);
  return score;
}

function fairnessBonus(p: Player, allPlayers: Player[]): number {
  const avg =
    allPlayers.reduce((s, x) => s + x.totalGames, 0) /
    Math.max(1, allPlayers.length);
  let score = 0;
  score += p.consecutiveSits * FAIRNESS_SIT;
  score += Math.max(0, avg - p.totalGames) * FAIRNESS_UNDERPLAYED;
  score -= p.consecutiveGames * 3;
  if (p.consecutiveGames >= 2) score -= MUST_SIT_PENALTY;
  return score;
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

function bestDoublesLineup(
  ids: [string, string, string, string],
  ctx: ScoringContext
): { playerIds: string[]; score: number } {
  const splits: [[string, string], [string, string]][] = [
    [[ids[0], ids[1]], [ids[2], ids[3]]],
    [[ids[0], ids[2]], [ids[1], ids[3]]],
    [[ids[0], ids[3]], [ids[1], ids[2]]],
  ];

  let best = { playerIds: [...ids] as string[], score: -Infinity };

  for (const [team1, team2] of splits) {
    let score = 0;
    score += pairInteractionScore(team1[0], team1[1], ctx, "partner") * 1.2;
    score += pairInteractionScore(team2[0], team2[1], ctx, "partner") * 1.2;
    for (const a of team1) {
      for (const b of team2) {
        score += pairInteractionScore(a, b, ctx, "opponent");
      }
    }
    const lineup = [...team1, ...team2];
    if (score > best.score) {
      best = { playerIds: lineup, score };
    }
  }

  return best;
}

function scoreDoublesCombo(
  combo: Player[],
  ctx: ScoringContext
): { score: number; playerIds: string[] } {
  const ids = combo.map((p) => p.id) as [string, string, string, string];
  let score = 0;

  const fk = groupKey(ids);
  const foursomeTimes = ctx.foursomeCounts[fk] ?? 0;
  if (foursomeTimes === 0) score += NEVER_TOGETHER;
  else score -= foursomeTimes * FOURSOME_REPEAT;
  if (ctx.recentFoursomes.has(fk)) score -= RECENT_PARTNER_PENALTY;

  for (const tk of tripletKeys(ids)) {
    const times = ctx.tripletCounts[tk] ?? 0;
    if (times === 0) score += 3;
    else score -= times * TRIPLET_REPEAT;
    if (ctx.recentTriplets.has(tk)) score -= RECENT_PARTNER_PENALTY / 2;
  }

  for (const [a, b] of allPairs(ids)) {
    score += pairInteractionScore(a, b, ctx) * 0.5;
  }

  for (const p of combo) {
    score += fairnessBonus(p, ctx.players);
  }

  const lineup = bestDoublesLineup(ids, ctx);
  score += lineup.score;

  return { score, playerIds: lineup.playerIds };
}

function scoreSinglesCombo(combo: Player[], ctx: ScoringContext): number {
  const [a, b] = combo;
  let score = pairInteractionScore(a.id, b.id, ctx, "opponent");
  score += fairnessBonus(a, ctx.players);
  score += fairnessBonus(b, ctx.players);
  return score;
}

function* combinationsIter<T>(items: T[], size: number): Generator<T[]> {
  const n = items.length;
  if (size > n || size < 1) return;
  const idx = Array.from({ length: size }, (_, i) => i);
  while (true) {
    yield idx.map((i) => items[i]);
    let i = size - 1;
    while (i >= 0 && idx[i] === n - size + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < size; j++) idx[j] = idx[j - 1] + 1;
  }
}

function shufflePool<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed + 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPlayPool(players: Player[], slotsNeeded: number): Player[] {
  const rested = players.filter((p) => p.consecutiveGames < 2);
  const pool =
    rested.length >= slotsNeeded
      ? rested
      : [...players].sort((a, b) => a.consecutiveGames - b.consecutiveGames);
  return pool;
}

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

interface CourtSlot {
  court: Court;
  type: CourtType | null;
}

function planCourtSlots(courts: Court[], playerCount: number): CourtSlot[] {
  let remaining = playerCount;
  return courts.map((court) => {
    const type = resolveRoundType(court, remaining);
    if (!type) return { court, type: null };
    remaining -= playersNeeded(type);
    return { court, type };
  });
}

function emptyFixture(court: Court): Fixture {
  return {
    courtId: court.id,
    playerIds: Array(playersNeeded(court.type)).fill(""),
    active: false,
  };
}

function searchPool(
  available: Player[],
  ctx: ScoringContext,
  max: number,
  seed: number
): Player[] {
  const ranked = [...available].sort(
    (a, b) => fairnessBonus(b, ctx.players) - fairnessBonus(a, ctx.players)
  );
  if (ranked.length <= max) return ranked;
  const window = ranked.slice(0, max + 4);
  return shufflePool(window, seed).slice(0, max);
}

function pickBestDoubles(
  available: Player[],
  ctx: ScoringContext,
  seed: number
): { playerIds: string[]; picked: Player[]; score: number } | null {
  if (available.length < 4) return null;

  const candidates = searchPool(
    available,
    ctx,
    MAX_DOUBLES_CANDIDATES,
    seed
  );

  let best: {
    playerIds: string[];
    picked: Player[];
    score: number;
  } | null = null;

  for (const combo of combinationsIter(candidates, 4)) {
    const { score, playerIds } = scoreDoublesCombo(combo, ctx);
    if (!best || score > best.score) {
      best = { playerIds, picked: combo, score };
    }
  }

  return best;
}

function pickBestSingles(
  available: Player[],
  ctx: ScoringContext,
  seed: number
): { playerIds: string[]; picked: Player[]; score: number } | null {
  if (available.length < 2) return null;

  const candidates = searchPool(
    available,
    ctx,
    MAX_SINGLES_CANDIDATES,
    seed
  );

  let best: {
    playerIds: string[];
    picked: Player[];
    score: number;
  } | null = null;

  for (const combo of combinationsIter(candidates, 2)) {
    const score = scoreSinglesCombo(combo, ctx);
    if (!best || score > best.score) {
      best = { playerIds: [combo[0].id, combo[1].id], picked: combo, score };
    }
  }

  return best;
}

function assignRound(
  pool: Player[],
  slots: CourtSlot[],
  ctx: ScoringContext,
  seed: number
): { fixtures: Fixture[]; score: number } {
  let available = [...pool];
  const fixtures: Fixture[] = [];
  let totalScore = 0;

  for (const slot of slots) {
    if (!slot.type) {
      fixtures.push(emptyFixture(slot.court));
      continue;
    }

    if (slot.type === "doubles") {
      const pick = pickBestDoubles(available, ctx, seed + slot.court.number);
      if (!pick) {
        fixtures.push(emptyFixture(slot.court));
        continue;
      }
      fixtures.push({
        courtId: slot.court.id,
        playerIds: pick.playerIds,
        roundType: slot.type !== slot.court.type ? slot.type : undefined,
        active: true,
      });
      totalScore += pick.score;
      const pickedIds = new Set(pick.picked.map((p) => p.id));
      available = available.filter((p) => !pickedIds.has(p.id));
    } else {
      const pick = pickBestSingles(available, ctx, seed + slot.court.number);
      if (!pick) {
        fixtures.push(emptyFixture(slot.court));
        continue;
      }
      fixtures.push({
        courtId: slot.court.id,
        playerIds: pick.playerIds,
        roundType: slot.type !== slot.court.type ? slot.type : undefined,
        active: true,
      });
      totalScore += pick.score;
      const pickedIds = new Set(pick.picked.map((p) => p.id));
      available = available.filter((p) => !pickedIds.has(p.id));
    }
  }

  return { fixtures, score: totalScore };
}

/** Score a court's current occupants; returns the best team split too. */
function comboScore(
  ids: string[],
  type: CourtType,
  ctx: ScoringContext,
  playerMap: Map<string, Player>
): { score: number; playerIds: string[] } {
  const players = ids
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));

  if (type === "doubles") {
    if (players.length !== 4) return { score: -Infinity, playerIds: ids };
    return scoreDoublesCombo(players, ctx);
  }
  if (players.length !== 2) return { score: -Infinity, playerIds: ids };
  return { score: scoreSinglesCombo(players, ctx), playerIds: ids };
}

/** Total score of a full set of fixtures (used to compare attempts). */
function scoreFixtures(
  fixtures: Fixture[],
  courts: Court[],
  ctx: ScoringContext,
  players: Player[]
): number {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const courtMap = new Map(courts.map((c) => [c.id, c]));
  let total = 0;
  for (const fixture of fixtures) {
    if (fixture.active === false) continue;
    const court = courtMap.get(fixture.courtId);
    if (!court) continue;
    const ids = fixture.playerIds.filter(Boolean);
    const type = fixtureRoundType(fixture, court);
    if (ids.length !== playersNeeded(type)) continue;
    total += comboScore(ids, type, ctx, playerMap).score;
  }
  return total;
}

interface RefineSlot {
  fixtureIndex: number;
  type: CourtType;
  ids: string[];
  score: number;
}

/**
 * Greedy assignment fills courts one at a time, so it can hog the best
 * matchup on an early court. This local search swaps players *between*
 * courts and keeps any swap that lowers the round's total repeat penalty,
 * nudging the result toward a global optimum. Bounded by MAX_REFINE_SWEEPS.
 */
function refineAssignment(
  fixtures: Fixture[],
  courts: Court[],
  ctx: ScoringContext,
  players: Player[]
): Fixture[] {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const courtMap = new Map(courts.map((c) => [c.id, c]));

  const slots: RefineSlot[] = [];
  fixtures.forEach((fixture, fixtureIndex) => {
    if (fixture.active === false) return;
    const court = courtMap.get(fixture.courtId);
    if (!court) return;
    const ids = fixture.playerIds.filter(Boolean);
    const type = fixtureRoundType(fixture, court);
    if (ids.length !== playersNeeded(type)) return;
    const { score } = comboScore(ids, type, ctx, playerMap);
    slots.push({ fixtureIndex, type, ids: [...ids], score });
  });

  if (slots.length < 2) return fixtures;

  for (let sweep = 0; sweep < MAX_REFINE_SWEEPS; sweep++) {
    let improved = false;

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];

        for (let ai = 0; ai < a.ids.length; ai++) {
          for (let bj = 0; bj < b.ids.length; bj++) {
            const newAIds = [...a.ids];
            const newBIds = [...b.ids];
            newAIds[ai] = b.ids[bj];
            newBIds[bj] = a.ids[ai];

            const resA = comboScore(newAIds, a.type, ctx, playerMap);
            const resB = comboScore(newBIds, b.type, ctx, playerMap);

            if (
              resA.score + resB.score >
              a.score + b.score + SWAP_EPSILON
            ) {
              a.ids = resA.playerIds;
              a.score = resA.score;
              b.ids = resB.playerIds;
              b.score = resB.score;
              improved = true;
            }
          }
        }
      }
    }

    if (!improved) break;
  }

  const refined = [...fixtures];
  for (const slot of slots) {
    refined[slot.fixtureIndex] = {
      ...refined[slot.fixtureIndex],
      playerIds: slot.ids,
    };
  }
  return refined;
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

  const ctx = buildScoringContext(s);
  const slotsNeeded = courts.reduce((sum, c) => {
    const type = resolveRoundType(c, s.players.length);
    return sum + (type ? playersNeeded(type) : 0);
  }, 0);

  const pool = buildPlayPool(s.players, slotsNeeded);
  const courtSlots = planCourtSlots(courts, pool.length);

  let bestFixtures: Fixture[] | null = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < OPTIMIZER_ATTEMPTS; attempt++) {
    const ordered =
      attempt === 0
        ? [...pool].sort((a, b) => playerPriority(b) - playerPriority(a))
        : shufflePool(pool, attempt);

    const { fixtures } = assignRound(ordered, courtSlots, ctx, attempt);
    const refined = refineAssignment(fixtures, courts, ctx, s.players);
    const score = scoreFixtures(refined, courts, ctx, s.players);
    if (score > bestScore) {
      bestScore = score;
      bestFixtures = refined;
    }
  }

  return bestFixtures ?? courts.map((c) => emptyFixture(c));
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
