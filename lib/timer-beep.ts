/** Play a short beep. Requires prior user gesture (e.g. Start click). */
export function playBeep(
  audioContext: AudioContext,
  frequency = 880,
  durationMs = 200
): void {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.25;

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  const now = audioContext.currentTime;
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

  oscillator.start(now);
  oscillator.stop(now + durationMs / 1000);
}

export async function playAlarm(
  audioContext: AudioContext,
  repeats = 5
): Promise<void> {
  for (let i = 0; i < repeats; i++) {
    playBeep(audioContext, i % 2 === 0 ? 880 : 660, 250);
    await new Promise((r) => setTimeout(r, 350));
  }
}

export function formatDuration(totalMs: number): string {
  const totalSec = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
