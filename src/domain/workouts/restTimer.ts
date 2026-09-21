import type { RestTimerSnapshot } from '@/types';

export function startRestTimer(
  durationSeconds: number,
  nowMs = Date.now(),
): RestTimerSnapshot | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const duration = Math.round(durationSeconds);
  return {
    durationSeconds: duration,
    endsAt: new Date(nowMs + duration * 1000).toISOString(),
  };
}

export function remainingRestSeconds(timer: RestTimerSnapshot, nowMs = Date.now()): number {
  const endsAtMs = Date.parse(timer.endsAt);
  if (!Number.isFinite(endsAtMs)) return 0;
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

export function extendRestTimer(
  timer: RestTimerSnapshot,
  seconds: number,
  nowMs = Date.now(),
): RestTimerSnapshot {
  const extension = Math.max(0, Math.round(seconds));
  const parsedEndsAt = Date.parse(timer.endsAt);
  const baseMs = Number.isFinite(parsedEndsAt) ? Math.max(parsedEndsAt, nowMs) : nowMs;
  return {
    durationSeconds: timer.durationSeconds + extension,
    endsAt: new Date(baseMs + extension * 1000).toISOString(),
  };
}
