"use client";

import { useEffect } from "react";
import { RoundRecord } from "@/lib/types";

export function RecordToast({
  round,
  onDismiss,
  onViewHistory,
}: {
  round: RoundRecord;
  onDismiss: () => void;
  onViewHistory?: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [round.id, onDismiss]);

  const gameWord = round.matches.length === 1 ? "game" : "games";

  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold"
          aria-hidden
        >
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            Round {round.roundNumber} recorded
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            {round.matches.length} {gameWord} saved to History
            {round.satOut.length > 0 &&
              ` · ${round.satOut.length} sat out`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
          >
            View History
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2 py-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
