"use client";

import { useEffect, useRef } from "react";

const SECTIONS = [
  {
    title: "How it works (two steps)",
    body: "First it decides WHO plays this round (fairness), then it works out the BEST matchups for those players (variety). Fairness is decided first and never gets overridden by matchmaking. You can tweak any pick before recording.",
  },
  {
    title: "Step 1 — Who plays vs sits",
    bullets: [
      "Whoever has sat out longest gets a spot first — this is a hard rule, not a preference.",
      "Nobody ever sits two rounds in a row while someone else plays two in a row (unless there aren't enough players to fill the courts).",
      "Players on 2+ games in a row sit out when enough others are available.",
      "Ties broken by fewest total games, so everyone trends to the same count.",
    ],
  },
  {
    title: "Step 2 — Best matchups",
    bullets: [
      "Only the players chosen in Step 1 are arranged — matchmaking can never bench someone who's owed a game.",
      "Prefers people who've never partnered or played each other; penalises repeats.",
      "Extra penalty for repeating last round's partners, so pairings keep changing.",
      "Doubles: avoids the same four on a court and discourages the same trio meeting again.",
      "Tries many arrangements and swaps players between courts to find the most varied full round.",
    ],
  },
  {
    title: "Courts & leftovers",
    bullets: [
      "Each court needs a full balanced game: 4 for doubles (2v2), 2 for singles (1v1).",
      "Never 2v1 or other lopsided teams.",
      "10 players on 4 doubles courts → 2 doubles + 1 singles, 1 court unused.",
      "Extra players who don't fit a full court sit this round out.",
    ],
  },
  {
    title: "Record round",
    body: "Locks in stats (plays/sits in a row, total games) and match history for the next suggestion. Only fully staffed courts count.",
  },
] as const;

export function SuggestHelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-0 text-stone-800 dark:text-stone-200 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 dark:border-stone-800 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            How suggestions work
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Fair rotations for volunteers
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-600 dark:hover:text-stone-200 text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5">
              {section.title}
            </h3>
            {"body" in section && (
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                {section.body}
              </p>
            )}
            {"bullets" in section && (
              <ul className="text-sm text-stone-600 dark:text-stone-400 space-y-1.5 list-disc pl-4 leading-relaxed">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="border-t border-stone-100 dark:border-stone-800 px-5 py-3">
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </dialog>
  );
}
