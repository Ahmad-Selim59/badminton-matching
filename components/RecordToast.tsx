"use client";

import { useEffect, useState } from "react";
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(onDismiss, 3000);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(timer);
    };
  }, [round.id, onDismiss]);

  const gameWord = round.matches.length === 1 ? "game" : "games";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-4 right-4 top-20 z-50 mx-auto max-w-lg rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950 px-4 py-4 shadow-lg transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-lg font-bold"
          aria-hidden
        >
          ✓
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            Round {round.roundNumber} recorded!
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
            {round.matches.length} {gameWord} saved to History
            {round.satOut.length > 0 &&
              ` · ${round.satOut.length} sat out`}
          </p>
          {onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-100"
            >
              View in History →
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xl leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
