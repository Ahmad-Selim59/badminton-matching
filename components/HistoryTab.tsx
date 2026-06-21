"use client";

import { useAppState } from "@/hooks/useAppState";
import {
  formatMatchLine,
  formatRecordedAt,
} from "@/lib/round-history";
import { cardClass, emptyStateClass } from "@/lib/ui";

export function HistoryTab() {
  const { state } = useAppState();
  const rounds = state.roundHistory;

  if (rounds.length === 0) {
    return (
      <div className={emptyStateClass}>
        <p className="text-stone-500 dark:text-stone-400">
          No games recorded yet. Set up fixtures and hit{" "}
          <strong>Record round</strong> to start building history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        {rounds.length} round{rounds.length === 1 ? "" : "s"} recorded. Newest
        first.
      </p>

      <ol className="space-y-4">
        {rounds.map((round) => (
          <li key={round.id} className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 px-4 py-3">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                Round {round.roundNumber}
              </h3>
              <time
                dateTime={round.recordedAt}
                className="text-xs text-stone-400 dark:text-stone-500"
              >
                {formatRecordedAt(round.recordedAt)}
              </time>
            </div>

            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {round.matches.map((match, i) => (
                <li key={i} className="px-4 py-3 text-sm">
                  <p className="text-stone-800 dark:text-stone-200">
                    {formatMatchLine(match)}
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                    Court {match.courtNumber}
                  </p>
                </li>
              ))}
            </ul>

            {round.satOut.length > 0 && (
              <div className="border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 px-4 py-2.5">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Sat out:{" "}
                  <span className="text-stone-600 dark:text-stone-300">
                    {round.satOut.join(", ")}
                  </span>
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
