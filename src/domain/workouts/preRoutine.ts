export type PreWorkoutLog = {
  substance: string;
  doseMg: number;
  takenAt: string; // ISO
  peakWindowMinutes: number;
  carbsLoadedG: number;
};

export type PreWorkoutStatus = {
  minutesSinceTaken: number;
  minutesToPeak: number; // 0 once past the peak window
  atPeak: boolean;
};

/**
 * Placeholder domain math for the "Pre-Fuel" card — real substance/timing
 * logging isn't built yet, but the elapsed/peak-window calculation itself is
 * genuine so the UI isn't just static text.
 */
export function computePreWorkoutStatus(
  log: PreWorkoutLog,
  now: Date = new Date(),
): PreWorkoutStatus {
  const minutesSinceTaken = Math.max(
    0,
    Math.round((now.getTime() - new Date(log.takenAt).getTime()) / 60000),
  );
  const minutesToPeak = Math.max(0, log.peakWindowMinutes - minutesSinceTaken);
  return {
    minutesSinceTaken,
    minutesToPeak,
    atPeak: minutesToPeak === 0 && minutesSinceTaken < log.peakWindowMinutes + 60,
  };
}
