"use client";

import { useEffect, useRef } from "react";

const SECTIONS = [
  {
    title: "Suggest games",
    body: "Fills courts in order (Court 1, 2, 3…). You can tweak any pick before recording the round.",
  },
  {
    title: "Who plays vs sits",
    bullets: [
      "Players on 2+ games in a row sit out when enough others are available.",
      "Players who've been waiting (sits in a row) get priority.",
      "Fewer total games also helps someone get picked.",
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
    title: "Partner & opponent rotation",
    bullets: [
      "After each recorded round we remember who partnered and who faced whom.",
      "Doubles: tries all 3 ways to split 4 players into 2v2, picks the freshest pairings.",
      "Repeating the same partner is penalised more than repeating an opponent.",
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
