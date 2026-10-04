import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type ElapsedClockProps = {
  startedAt: string;
  totalPausedSeconds: number;
  /** When set, the clock freezes at this moment (workout paused). */
  pausedAt?: string | null;
  style?: StyleProp<TextStyle>;
};

function format(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Live session timer, minus paused time. Ticks once a second; mono digits keep it steady. */
export function ElapsedClock({
  startedAt,
  totalPausedSeconds,
  pausedAt,
  style,
}: ElapsedClockProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (pausedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pausedAt]);

  const start = Date.parse(startedAt);
  const end = pausedAt ? Date.parse(pausedAt) : now;
  const elapsed = Number.isFinite(start) ? (end - start) / 1000 - totalPausedSeconds : 0;

  return (
    <Text style={style} accessibilityLabel={`Workout time ${format(elapsed)}`}>
      {format(elapsed)}
    </Text>
  );
}
