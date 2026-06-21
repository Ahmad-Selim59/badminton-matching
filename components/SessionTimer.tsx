"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration, playAlarm } from "@/lib/timer-beep";
import { cardClass, fieldClassSm } from "@/lib/ui";

const LIMIT_KEY = "badminton-timer-limit";
const STATE_KEY = "badminton-timer-state";

type TimerStatus = "idle" | "running" | "paused" | "alarm";

interface PersistedTimer {
  status: TimerStatus;
  accumulatedMs: number;
  startedAt: number | null;
  limitMinutes: number;
}

function loadLimit(): number {
  try {
    const v = localStorage.getItem(LIMIT_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return 90;
}

function loadTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimer;
  } catch {
    return null;
  }
}

function saveTimer(state: PersistedTimer) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function clearTimerStorage() {
  localStorage.removeItem(STATE_KEY);
}

function elapsedMs(state: PersistedTimer, now: number): number {
  if (
    (state.status === "running" || state.status === "alarm") &&
    state.startedAt
  ) {
    return state.accumulatedMs + (now - state.startedAt);
  }
  return state.accumulatedMs;
}

export function SessionTimer() {
  const audioRef = useRef<AudioContext | null>(null);
  const alarmFiredRef = useRef(false);

  const [limitMinutes, setLimitMinutes] = useState(90);
  const [limitInput, setLimitInput] = useState("90");
  const [timer, setTimer] = useState<PersistedTimer>({
    status: "idle",
    accumulatedMs: 0,
    startedAt: null,
    limitMinutes: 90,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const limit = loadLimit();
    setLimitMinutes(limit);
    setLimitInput(String(limit));

    const saved = loadTimer();
    if (saved) {
      setTimer(saved);
      if (saved.status === "alarm") alarmFiredRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (timer.status !== "running" && timer.status !== "alarm") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer.status]);

  const now = Date.now();
  const elapsed = elapsedMs(timer, now);
  const limitMs = limitMinutes > 0 ? limitMinutes * 60 * 1000 : 0;
  const isOverLimit = limitMs > 0 && elapsed >= limitMs;
  const overtimeMs = isOverLimit ? elapsed - limitMs : 0;

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    if (timer.status !== "running" || limitMs === 0) return;
    if (elapsed >= limitMs && !alarmFiredRef.current) {
      alarmFiredRef.current = true;
      setTimer((prev) => {
        const next = { ...prev, status: "alarm" as TimerStatus };
        saveTimer(next);
        return next;
      });
      playAlarm(getAudio()).catch(() => {});
    }
  }, [tick, timer.status, elapsed, limitMs, getAudio]);

  function persist(next: PersistedTimer) {
    setTimer(next);
    if (next.status === "idle") {
      clearTimerStorage();
    } else {
      saveTimer(next);
    }
  }

  function handleStart() {
    const mins = parseInt(limitInput, 10);
    const limit = !isNaN(mins) && mins > 0 ? mins : limitMinutes;
    setLimitMinutes(limit);
    setLimitInput(String(limit));
    localStorage.setItem(LIMIT_KEY, String(limit));
    alarmFiredRef.current = false;
    getAudio();
    persist({
      status: "running",
      accumulatedMs: timer.status === "paused" ? timer.accumulatedMs : 0,
      startedAt: Date.now(),
      limitMinutes: limit,
    });
  }

  function handlePause() {
    if (timer.status !== "running" || !timer.startedAt) return;
    persist({
      ...timer,
      status: "paused",
      accumulatedMs: elapsedMs(timer, Date.now()),
      startedAt: null,
    });
  }

  function handleResume() {
    alarmFiredRef.current = false;
    getAudio();
    persist({
      ...timer,
      status: "running",
      startedAt: Date.now(),
    });
  }

  function handleReset() {
    alarmFiredRef.current = false;
    persist({
      status: "idle",
      accumulatedMs: 0,
      startedAt: null,
      limitMinutes: limitMinutes,
    });
  }

  function handleDismissAlarm() {
    alarmFiredRef.current = true;
    persist({
      status: "running",
      accumulatedMs: elapsedMs(timer, Date.now()),
      startedAt: Date.now(),
      limitMinutes,
    });
  }

  function handleLimitChange(value: string) {
    setLimitInput(value);
    const mins = parseInt(value, 10);
    if (!isNaN(mins) && mins > 0) {
      setLimitMinutes(mins);
      localStorage.setItem(LIMIT_KEY, String(mins));
    }
  }

  const progress =
    limitMs > 0 ? Math.min(100, (elapsed / limitMs) * 100) : 0;

  return (
    <div className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            Session timer
          </h3>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
            Track how long play has been running
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          Limit (min)
          <input
            type="number"
            min={1}
            max={480}
            value={limitInput}
            onChange={(e) => handleLimitChange(e.target.value)}
            disabled={timer.status === "running"}
            className={`w-16 ${fieldClassSm}`}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className={`text-3xl font-mono font-semibold tabular-nums tracking-tight ${
              timer.status === "alarm" || isOverLimit
                ? "text-red-600 dark:text-red-400"
                : "text-stone-900 dark:text-stone-100"
            }`}
          >
            {formatDuration(elapsed)}
          </p>
          {limitMs > 0 && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
              {isOverLimit ? (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {formatDuration(overtimeMs)} over limit
                </span>
              ) : (
                <>Limit {formatDuration(limitMs)}</>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {timer.status === "idle" && (
            <button
              type="button"
              onClick={handleStart}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Start
            </button>
          )}
          {timer.status === "running" && (
            <button
              type="button"
              onClick={handlePause}
              className="rounded-lg border border-stone-300 dark:border-stone-600 px-4 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              Pause
            </button>
          )}
          {timer.status === "paused" && (
            <button
              type="button"
              onClick={handleResume}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Resume
            </button>
          )}
          {timer.status === "alarm" && (
            <button
              type="button"
              onClick={handleDismissAlarm}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Dismiss alarm
            </button>
          )}
          {timer.status !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-stone-300 dark:border-stone-600 px-4 py-2 text-sm font-medium text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {limitMs > 0 && timer.status !== "idle" && (
        <div className="mt-3 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isOverLimit
                ? "bg-red-500"
                : progress > 85
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}

      {timer.status === "alarm" && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-2 text-sm font-medium text-red-800 dark:text-red-200"
        >
          Time limit reached — wrap up this round!
        </p>
      )}
    </div>
  );
}
