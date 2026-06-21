/**
 * Acceptance simulation for the Suggest games scheduler.
 *
 * Goal being tested: "Everyone plays roughly the same amount, while meeting as
 * many different people as possible."
 *
 * It plays a full deterministic season (4 doubles courts, 30 players) by
 * repeatedly calling suggestFixtures() then recording the round, then scores
 * the whole season on four sub-metrics and compares the composite quality to a
 * saved baseline. The run fails if quality drops by >= REGRESSION_THRESHOLD vs
 * the last accepted run.
 *
 * Run:    pnpm test
 * Reset:  pnpm test -- --update   (overwrite the baseline on purpose)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { suggestFixtures } from "../../lib/suggest-fixtures";
import { applyRecordRound } from "../../lib/round-history";
import { AppState, Court, Player, RoundRecord } from "../../lib/types";

const COURTS = 4;
const PLAYERS = 30;
const ROUNDS = 20;
const REGRESSION_THRESHOLD = 0.06; // 6% worse than last run => fail

const WEIGHTS = {
  fairness: 0.3,
  partnerDiversity: 0.3,
  opponentDiversity: 0.2,
  freshness: 0.2,
} as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, "baseline.json");

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function buildInitialState(): AppState {
  const courts: Court[] = Array.from({ length: COURTS }, (_, i) => ({
    id: `court-${i + 1}`,
    number: i + 1,
    name: `Court ${i + 1}`,
    type: "doubles",
  }));

  const players: Player[] = Array.from({ length: PLAYERS }, (_, i) => ({
    id: `p${String(i).padStart(2, "0")}`,
    name: `Player ${String(i + 1).padStart(2, "0")}`,
    totalGames: 0,
    consecutiveGames: 0,
    consecutiveSits: 0,
  }));

  return {
    courts,
    players,
    fixtures: [],
    partnerCounts: {},
    opponentCounts: {},
    foursomeCounts: {},
    tripletCounts: {},
    roundHistory: [],
  };
}

interface RoundStats {
  round: number;
  playing: number;
  newPartnerships: number;
  repeatPartnerships: number;
  consecutivePartnerRepeats: number;
  gamesSpread: number;
}

function extractPairs(round: RoundRecord): {
  partners: string[];
  opponents: string[];
} {
  const partners: string[] = [];
  const opponents: string[] = [];
  for (const m of round.matches) {
    if (m.type !== "doubles") continue;
    partners.push(pairKey(m.team1[0], m.team1[1]));
    partners.push(pairKey(m.team2[0], m.team2[1]));
    for (const x of m.team1) {
      for (const y of m.team2) {
        opponents.push(pairKey(x, y));
      }
    }
  }
  return { partners, opponents };
}

interface SeasonResult {
  quality: number;
  fairness: number;
  partnerDiversity: number;
  opponentDiversity: number;
  freshness: number;
  rounds: RoundStats[];
  totalPartnerships: number;
  distinctPartnerships: number;
}

function runSeason(): SeasonResult {
  let state = buildInitialState();

  const seenPartners = new Set<string>();
  const allPartners: string[] = [];
  const allOpponents: string[] = [];
  let consecutivePartnerRepeats = 0;
  let prevPartners = new Set<string>();
  const rounds: RoundStats[] = [];

  for (let r = 1; r <= ROUNDS; r++) {
    const fixtures = suggestFixtures(state);
    state = { ...state, fixtures };
    const { next, round } = applyRecordRound(state);
    if (!round) throw new Error(`Round ${r} produced no matches`);
    state = next;

    const { partners, opponents } = extractPairs(round);
    const partnerSet = new Set(partners);

    let newPartnerships = 0;
    let repeatPartnerships = 0;
    for (const key of partners) {
      if (seenPartners.has(key)) repeatPartnerships++;
      else {
        newPartnerships++;
        seenPartners.add(key);
      }
    }

    let roundConsecutive = 0;
    for (const key of partnerSet) {
      if (prevPartners.has(key)) roundConsecutive++;
    }
    consecutivePartnerRepeats += roundConsecutive;
    prevPartners = partnerSet;

    allPartners.push(...partners);
    allOpponents.push(...opponents);

    const totals = state.players.map((p) => p.totalGames);
    const gamesSpread = Math.max(...totals) - Math.min(...totals);

    rounds.push({
      round: r,
      playing: round.matches.length * 4,
      newPartnerships,
      repeatPartnerships,
      consecutivePartnerRepeats: roundConsecutive,
      gamesSpread,
    });
  }

  const totals = state.players.map((p) => p.totalGames);
  const maxGames = Math.max(...totals);
  const minGames = Math.min(...totals);
  const idealPerPlayer = (ROUNDS * COURTS * 4) / PLAYERS;
  const normalizedSpread = (maxGames - minGames) / idealPerPlayer;
  const fairness = Math.max(0, 1 - normalizedSpread);

  const distinctPartnerships = new Set(allPartners).size;
  const partnerDiversity = distinctPartnerships / allPartners.length;
  const distinctOpponents = new Set(allOpponents).size;
  const opponentDiversity = distinctOpponents / allOpponents.length;
  const freshness = 1 - consecutivePartnerRepeats / allPartners.length;

  const quality =
    100 *
    (WEIGHTS.fairness * fairness +
      WEIGHTS.partnerDiversity * partnerDiversity +
      WEIGHTS.opponentDiversity * opponentDiversity +
      WEIGHTS.freshness * freshness);

  return {
    quality,
    fairness,
    partnerDiversity,
    opponentDiversity,
    freshness,
    rounds,
    totalPartnerships: allPartners.length,
    distinctPartnerships,
  };
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function printReport(result: SeasonResult) {
  console.log(`\nSeason: ${COURTS} doubles courts, ${PLAYERS} players, ${ROUNDS} rounds\n`);
  console.log("Rd | Play | New | Rep | Back2Back | Spread");
  console.log("---+------+-----+-----+-----------+-------");
  for (const r of result.rounds) {
    console.log(
      `${String(r.round).padStart(2)} | ${String(r.playing).padStart(4)} | ` +
        `${String(r.newPartnerships).padStart(3)} | ${String(r.repeatPartnerships).padStart(3)} | ` +
        `${String(r.consecutivePartnerRepeats).padStart(9)} | ${String(r.gamesSpread).padStart(6)}`
    );
  }

  console.log("\nSub-scores (higher = better):");
  console.log(`  Play fairness      ${pct(result.fairness)}  (everyone plays ~equally)`);
  console.log(`  Partner diversity  ${pct(result.partnerDiversity)}  (${result.distinctPartnerships}/${result.totalPartnerships} partnerships unique)`);
  console.log(`  Opponent diversity ${pct(result.opponentDiversity)}`);
  console.log(`  Freshness          ${pct(result.freshness)}  (avoids back-to-back partners)`);
  console.log(`\n  QUALITY = ${result.quality.toFixed(2)} / 100`);
}

function main() {
  const forceUpdate = process.argv.includes("--update");
  const result = runSeason();
  printReport(result);

  let baseline: { quality: number; recordedAt: string } | null = null;
  if (existsSync(BASELINE_PATH)) {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  }

  const saveBaseline = () => {
    mkdirSync(dirname(BASELINE_PATH), { recursive: true });
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        { quality: result.quality, recordedAt: new Date().toISOString() },
        null,
        2
      ) + "\n"
    );
  };

  if (forceUpdate || !baseline) {
    saveBaseline();
    console.log(
      baseline
        ? `\nBaseline overwritten -> ${result.quality.toFixed(2)}`
        : `\nNo baseline found. Saved first baseline -> ${result.quality.toFixed(2)}`
    );
    console.log("\nPASS\n");
    return;
  }

  const floor = baseline.quality * (1 - REGRESSION_THRESHOLD);
  const deltaPct = (result.quality - baseline.quality) / baseline.quality;
  console.log(
    `\nBaseline: ${baseline.quality.toFixed(2)} | Now: ${result.quality.toFixed(2)} | ` +
      `Delta: ${deltaPct >= 0 ? "+" : ""}${(deltaPct * 100).toFixed(2)}% | ` +
      `Floor (-${REGRESSION_THRESHOLD * 100}%): ${floor.toFixed(2)}`
  );

  if (result.quality < floor) {
    console.error(
      `\nFAIL: quality regressed by ${(Math.abs(deltaPct) * 100).toFixed(2)}% ` +
        `(>= ${REGRESSION_THRESHOLD * 100}% threshold).\n`
    );
    process.exit(1);
  }

  saveBaseline();
  console.log("\nPASS\n");
}

main();
