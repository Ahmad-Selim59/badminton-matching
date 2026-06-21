"use client";

import { useState } from "react";
import { AppStateProvider, useAppState } from "@/hooks/useAppState";
import { ThemeProvider, ThemeToggle } from "@/hooks/useTheme";
import { RecordsTab } from "@/components/RecordsTab";
import { FixturesTab } from "@/components/FixturesTab";
import { HistoryTab } from "@/components/HistoryTab";

type Tab = "records" | "fixtures" | "history";

function AppContent() {
  const [tab, setTab] = useState<Tab>("records");
  const { clearAll, hydrated } = useAppState();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-24 text-stone-400 dark:text-stone-500 text-sm">
        Loading…
      </div>
    );
  }

  function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearAll();
    setConfirmClear(false);
  }

  return (
    <>
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <div className="mx-auto max-w-3xl px-4 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 tracking-tight">
              Badminton Match Maker
            </h1>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              Saved in this browser · syncs across tabs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleClear}
              onBlur={() => setConfirmClear(false)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                confirmClear
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
              }`}
            >
              {confirmClear ? "Confirm clear all" : "Clear all"}
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-3xl px-4 flex gap-1">
          {(
            [
              ["records", "Records"],
              ["fixtures", "Fixtures"],
              ["history", "History"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? "border-emerald-600 text-emerald-800 dark:text-emerald-300"
                  : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {tab === "records" ? (
          <RecordsTab />
        ) : tab === "fixtures" ? (
          <FixturesTab onViewHistory={() => setTab("history")} />
        ) : (
          <HistoryTab />
        )}
      </main>
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-full bg-stone-50 dark:bg-stone-950">
      <ThemeProvider>
        <AppStateProvider>
          <AppContent />
        </AppStateProvider>
      </ThemeProvider>
    </div>
  );
}
