"use client";

import { useState } from "react";
import { useAppState } from "@/hooks/useAppState";
import { CourtType } from "@/lib/types";
import { fieldClass, fieldClassSm } from "@/lib/ui";

export function RecordsTab() {
  const {
    state,
    addCourt,
    updateCourt,
    removeCourt,
    addPlayer,
    removePlayer,
  } = useAppState();

  const [courtNumber, setCourtNumber] = useState("");
  const [courtName, setCourtName] = useState("");
  const [courtType, setCourtType] = useState<CourtType>("doubles");
  const [playerName, setPlayerName] = useState("");

  const sortedCourts = [...state.courts].sort((a, b) => a.number - b.number);
  const sortedPlayers = [...state.players].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  function handleAddCourt(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(courtNumber, 10);
    if (isNaN(num) || num < 1) return;
    if (state.courts.some((c) => c.number === num)) return;
    addCourt(num, courtName, courtType);
    setCourtNumber("");
    setCourtName("");
  }

  function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim()) return;
    addPlayer(playerName);
    setPlayerName("");
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 mb-1">Courts</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
          Add courts by number. Name them and choose singles or doubles for each.
        </p>

        <form
          onSubmit={handleAddCourt}
          className="flex flex-wrap gap-2 items-end mb-6"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-stone-600 dark:text-stone-400">Court #</span>
            <input
              type="number"
              min={1}
              value={courtNumber}
              onChange={(e) => setCourtNumber(e.target.value)}
              placeholder="1"
              className={`w-20 ${fieldClass}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-[140px]">
            <span className="text-stone-600 dark:text-stone-400">Name (optional)</span>
            <input
              type="text"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              placeholder="Court 1"
              className={`flex-1 min-w-[140px] ${fieldClass}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-stone-600 dark:text-stone-400">Type</span>
            <select
              value={courtType}
              onChange={(e) => setCourtType(e.target.value as CourtType)}
              className={fieldClass}
            >
              <option value="doubles">Doubles</option>
              <option value="singles">Singles</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Add court
          </button>
        </form>

        {sortedCourts.length === 0 ? (
          <p className="text-sm text-stone-400 italic">No courts yet.</p>
        ) : (
          <ul className="space-y-2">
            {sortedCourts.map((court) => (
              <li
                key={court.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3"
              >
                <span className="font-mono text-sm text-stone-400 w-8">
                  #{court.number}
                </span>
                <input
                  type="text"
                  value={court.name}
                  onChange={(e) =>
                    updateCourt(court.id, { name: e.target.value })
                  }
                  className={`flex-1 min-w-[120px] ${fieldClassSm}`}
                />
                <select
                  value={court.type}
                  onChange={(e) =>
                    updateCourt(court.id, {
                      type: e.target.value as CourtType,
                    })
                  }
                  className={fieldClassSm}
                >
                  <option value="doubles">Doubles</option>
                  <option value="singles">Singles</option>
                </select>
                <button
                  onClick={() => removeCourt(court.id)}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                  aria-label={`Remove ${court.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 mb-1">Players</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
          Add everyone who might play today. Stats update when you record a
          round on the Fixtures tab.
        </p>

        <form
          onSubmit={handleAddPlayer}
          className="flex gap-2 items-end mb-6"
        >
          <label className="flex flex-col gap-1 text-sm flex-1">
            <span className="text-stone-600 dark:text-stone-400">Player name</span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Alex"
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Add player
          </button>
        </form>

        {sortedPlayers.length === 0 ? (
          <p className="text-sm text-stone-400 italic">No players yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-left text-stone-600 dark:text-stone-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium text-center">
                    Total games
                  </th>
                  <th className="px-4 py-3 font-medium text-center">
                    Plays in a row
                  </th>
                  <th className="px-4 py-3 font-medium text-center">
                    Sits in a row
                  </th>
                  <th className="px-4 py-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="border-b border-stone-100 dark:border-stone-800 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{player.name}</td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {player.totalGames}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 tabular-nums font-medium ${
                          player.consecutiveGames >= 3
                            ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200"
                            : player.consecutiveGames >= 2
                              ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                        }`}
                      >
                        {player.consecutiveGames}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 tabular-nums font-medium ${
                          player.consecutiveSits >= 3
                            ? "bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200"
                            : player.consecutiveSits >= 2
                              ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
                              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                        }`}
                      >
                        {player.consecutiveSits}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removePlayer(player.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        aria-label={`Remove ${player.name}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
