"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { clearState, ensureAppState, loadState, saveState } from "@/lib/storage";
import { applyRecordRound } from "@/lib/round-history";
import { suggestFixtures as computeSuggestions } from "@/lib/suggest-fixtures";
import {
  AppState,
  Court,
  CourtType,
  DEFAULT_STATE,
  Fixture,
  RoundRecord,
  Player,
  playersNeeded,
} from "@/lib/types";

function generateId(): string {
  return crypto.randomUUID();
}

interface AppStateContextValue {
  state: AppState;
  hydrated: boolean;
  addCourt: (number: number, name: string, type: CourtType) => void;
  updateCourt: (
    id: string,
    updates: Partial<Pick<Court, "number" | "name" | "type">>
  ) => void;
  removeCourt: (id: string) => void;
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  setFixturePlayers: (courtId: string, playerIds: string[]) => void;
  suggestFixtures: () => void;
  recordRound: () => RoundRecord | null;
  clearAll: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function syncFixtures(courts: Court[], fixtures: Fixture[]): Fixture[] {
  return courts.map((court) => {
    const existing = fixtures.find((f) => f.courtId === court.id);
    const roundType = existing?.roundType;
    const needed = playersNeeded(roundType ?? court.type);
    const playerIds = existing
      ? existing.playerIds
          .slice(0, needed)
          .concat(Array(Math.max(0, needed - existing.playerIds.length)).fill(""))
      : Array(needed).fill("");
    return {
      courtId: court.id,
      playerIds,
      roundType: existing?.roundType,
      active: existing?.active,
    };
  });
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "badminton-match-maker") {
        setState(loadState());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(ensureAppState(state));
  }, [state, hydrated]);

  const update = useCallback((fn: (prev: AppState) => AppState) => {
    setState(fn);
  }, []);

  const addCourt = useCallback(
    (number: number, name: string, type: CourtType) => {
      update((prev) => {
        const court: Court = {
          id: generateId(),
          number,
          name: name.trim() || `Court ${number}`,
          type,
        };
        const courts = [...prev.courts, court];
        return { ...prev, courts, fixtures: syncFixtures(courts, prev.fixtures) };
      });
    },
    [update]
  );

  const updateCourt = useCallback(
    (id: string, updates: Partial<Pick<Court, "number" | "name" | "type">>) => {
      update((prev) => {
        const courts = prev.courts.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        );
        return { ...prev, courts, fixtures: syncFixtures(courts, prev.fixtures) };
      });
    },
    [update]
  );

  const removeCourt = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        courts: prev.courts.filter((c) => c.id !== id),
        fixtures: prev.fixtures.filter((f) => f.courtId !== id),
      }));
    },
    [update]
  );

  const addPlayer = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      update((prev) => {
        if (
          prev.players.some(
            (p) => p.name.toLowerCase() === trimmed.toLowerCase()
          )
        ) {
          return prev;
        }
        const player: Player = {
          id: generateId(),
          name: trimmed,
          totalGames: 0,
          consecutiveGames: 0,
          consecutiveSits: 0,
        };
        return { ...prev, players: [...prev.players, player] };
      });
    },
    [update]
  );

  const removePlayer = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== id),
        fixtures: prev.fixtures.map((f) => ({
          ...f,
          playerIds: f.playerIds.map((pid) => (pid === id ? "" : pid)),
        })),
      }));
    },
    [update]
  );

  const setFixturePlayers = useCallback(
    (courtId: string, playerIds: string[]) => {
      update((prev) => {
        const existing = prev.fixtures.find((f) => f.courtId === courtId);
        const fixtures = existing
          ? prev.fixtures.map((f) =>
              f.courtId === courtId
                ? { ...f, playerIds, active: true, roundType: undefined }
                : f
            )
          : [...prev.fixtures, { courtId, playerIds, active: true }];
        return { ...prev, fixtures };
      });
    },
    [update]
  );

  const suggestFixtures = useCallback(() => {
    update((prev) => {
      const safe = ensureAppState(prev);
      return {
        ...safe,
        fixtures: syncFixtures(safe.courts, computeSuggestions(safe)),
      };
    });
  }, [update]);

  const recordRound = useCallback((): RoundRecord | null => {
    let recorded: RoundRecord | null = null;
    update((prev) => {
      const { next, round } = applyRecordRound(ensureAppState(prev));
      recorded = round;
      return next;
    });
    return recorded;
  }, [update]);

  const clearAll = useCallback(() => {
    clearState();
    setState(DEFAULT_STATE);
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        state,
        hydrated,
        addCourt,
        updateCourt,
        removeCourt,
        addPlayer,
        removePlayer,
        setFixturePlayers,
        suggestFixtures,
        recordRound,
        clearAll,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
