"use client";

import { useState, useTransition } from "react";
import { useAppState } from "@/hooks/useAppState";
import { fixtureRoundType, isBalancedFixture } from "@/lib/suggest-fixtures";
import { CourtType, playersNeeded } from "@/lib/types";
import { fieldClassSm, btnOutline, cardClass } from "@/lib/ui";
import { SuggestHelpDialog } from "@/components/SuggestHelpDialog";
import { RecordToast } from "@/components/RecordToast";
import { SessionTimer } from "@/components/SessionTimer";
import { RoundRecord } from "@/lib/types";

export function FixturesTab({
  onViewHistory,
}: {
  onViewHistory?: () => void;
}) {
  const { state, setFixturePlayers, suggestFixtures, recordRound } =
    useAppState();
  const [helpOpen, setHelpOpen] = useState(false);
  const [recordedRound, setRecordedRound] = useState<RoundRecord | null>(null);
  const [justRecorded, setJustRecorded] = useState(false);
  const [isSuggesting, startSuggestTransition] = useTransition();

  function handleSuggest() {
    startSuggestTransition(() => {
      suggestFixtures();
    });
  }

  function handleRecord() {
    const round = recordRound();
    if (round) {
      setRecordedRound(round);
      setJustRecorded(true);
      setTimeout(() => setJustRecorded(false), 2500);
    }
  }

  const sortedCourts = [...state.courts].sort((a, b) => a.number - b.number);

  function getFixture(courtId: string) {
    return state.fixtures.find((f) => f.courtId === courtId);
  }

  function effectiveType(courtId: string): CourtType {
    const court = state.courts.find((c) => c.id === courtId);
    const fixture = getFixture(courtId);
    if (!court) return "doubles";
    return fixture ? fixtureRoundType(fixture, court) : court.type;
  }

  function handlePlayerChange(
    courtId: string,
    slotIndex: number,
    playerId: string
  ) {
    const needed = playersNeeded(effectiveType(courtId));
    const fixture = getFixture(courtId);
    const playerIds = fixture
      ? [...fixture.playerIds]
      : Array(needed).fill("");
    while (playerIds.length < needed) playerIds.push("");
    playerIds[slotIndex] = playerId;
    setFixturePlayers(courtId, playerIds);
  }

  const usedPlayerIds = new Set<string>();
  for (const fixture of state.fixtures) {
    if (fixture.active === false) continue;
    for (const pid of fixture.playerIds) {
      if (pid) usedPlayerIds.add(pid);
    }
  }

  const courtsWithPlayers = sortedCourts.filter((court) => {
    const fixture = getFixture(court.id);
    if (!fixture || fixture.active === false) return false;
    return isBalancedFixture(fixture, court);
  });

  const canRecord = courtsWithPlayers.length > 0;

  const totalRounds = state.roundHistory.length;

  if (sortedCourts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-900/50 px-6 py-12 text-center">
        <p className="text-stone-500 dark:text-stone-400">
          Add courts on the <strong>Records</strong> tab first, then come back
          here to set up who&apos;s playing.
        </p>
      </div>
    );
  }

  if (state.players.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-900/50 px-6 py-12 text-center">
        <p className="text-stone-500 dark:text-stone-400">
          Add players on the <strong>Records</strong> tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {recordedRound && (
        <RecordToast
          round={recordedRound}
          onDismiss={() => setRecordedRound(null)}
          onViewHistory={
            onViewHistory
              ? () => {
                  setRecordedRound(null);
                  onViewHistory();
                }
              : undefined
          }
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3">
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wide font-medium">
            Session total
          </p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
            {totalRounds}{" "}
            <span className="text-base font-medium text-stone-600 dark:text-stone-400">
              {totalRounds === 1 ? "round" : "rounds"} played
            </span>
          </p>
        </div>
      </div>

      <SessionTimer />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xl">
          Assign players manually or use <strong>Suggest games</strong>. Courts
          always need full teams (2v2 or 1v1) — never lopsided.
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
            aria-label="How suggestions work"
            title="How suggestions work"
          >
            ?
          </button>
          <button
            onClick={handleSuggest}
            disabled={isSuggesting}
            className={`${btnOutline} disabled:opacity-60`}
          >
            {isSuggesting ? "Suggesting…" : "Suggest games"}
          </button>
          <button
            onClick={handleRecord}
            disabled={!canRecord}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              justRecorded
                ? "bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 dark:ring-offset-stone-950"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {justRecorded ? "Recorded ✓" : "Record round"}
          </button>
        </div>
      </div>

      <SuggestHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="grid gap-4 sm:grid-cols-2">
        {sortedCourts.map((court) => {
          const fixture = getFixture(court.id);
          const inactive = fixture?.active === false;
          const roundType = effectiveType(court.id);
          const needed = playersNeeded(roundType);
          const playerIds = fixture?.playerIds ?? Array(needed).fill("");
          const isSinglesThisRound = roundType === "singles";
          const typeOverride =
            fixture?.roundType && fixture.roundType !== court.type;

          if (inactive) {
            return (
              <div
                key={court.id}
                className="rounded-xl border border-dashed border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 p-5"
              >
                <h3 className="font-semibold text-stone-400 dark:text-stone-500">{court.name}</h3>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                  Court {court.number} · Not used this round
                </p>
                <p className="text-sm text-stone-400 dark:text-stone-500 mt-3">
                  Not enough players left for a full game here.
                </p>
              </div>
            );
          }

          return (
            <div
              key={court.id}
              className={`${cardClass} p-5`}
            >
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                    {court.name}
                  </h3>
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    Court {court.number} ·{" "}
                    {isSinglesThisRound ? "Singles" : "Doubles"}
                    {typeOverride && " this round"}
                  </p>
                </div>
              </div>

              {isSinglesThisRound ? (
                <div className="space-y-3">
                  <PlayerSelect
                    label="Player 1"
                    value={playerIds[0] ?? ""}
                    players={state.players}
                    usedElsewhere={usedPlayerIds}
                    currentSlot={playerIds[0]}
                    onChange={(id) => handlePlayerChange(court.id, 0, id)}
                  />
                  <p className="text-center text-xs text-stone-400 dark:text-stone-500 font-medium">
                    vs
                  </p>
                  <PlayerSelect
                    label="Player 2"
                    value={playerIds[1] ?? ""}
                    players={state.players}
                    usedElsewhere={usedPlayerIds}
                    currentSlot={playerIds[1]}
                    onChange={(id) => handlePlayerChange(court.id, 1, id)}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <PlayerSelect
                        key={i}
                        label={`Player ${i + 1}`}
                        value={playerIds[i] ?? ""}
                        players={state.players}
                        usedElsewhere={usedPlayerIds}
                        currentSlot={playerIds[i]}
                        onChange={(id) =>
                          handlePlayerChange(court.id, i, id)
                        }
                      />
                    ))}
                  </div>
                  <p className="text-center text-xs text-stone-400 dark:text-stone-500 font-medium">
                    vs
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[2, 3].map((i) => (
                      <PlayerSelect
                        key={i}
                        label={`Player ${i + 1}`}
                        value={playerIds[i] ?? ""}
                        players={state.players}
                        usedElsewhere={usedPlayerIds}
                        currentSlot={playerIds[i]}
                        onChange={(id) =>
                          handlePlayerChange(court.id, i, id)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerSelect({
  label,
  value,
  players,
  usedElsewhere,
  currentSlot,
  onChange,
}: {
  label: string;
  value: string;
  players: { id: string; name: string }[];
  usedElsewhere: Set<string>;
  currentSlot?: string;
  onChange: (id: string) => void;
}) {
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-stone-500 dark:text-stone-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClassSm}
      >
        <option value="">— empty —</option>
        {sorted.map((p) => {
          const taken = usedElsewhere.has(p.id) && p.id !== currentSlot;
          return (
            <option key={p.id} value={p.id} disabled={taken}>
              {p.name}
              {taken ? " (playing)" : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}
