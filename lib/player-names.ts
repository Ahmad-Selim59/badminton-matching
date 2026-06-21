import { Player } from "./types";

/** Filesystem-style unique name: "Alex" → "Alex (1)" → "Alex (2)" … */
export function uniquePlayerName(players: Player[], desired: string): string {
  const taken = new Set(players.map((p) => p.name.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) return desired;

  let n = 1;
  let candidate = `${desired} (${n})`;
  while (taken.has(candidate.toLowerCase())) {
    n++;
    candidate = `${desired} (${n})`;
  }
  return candidate;
}
