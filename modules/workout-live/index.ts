import { type NativeModule, requireOptionalNativeModule } from 'expo';

export type LiveAction = { id: string; title: string };

export type LiveContent = {
  title: string;
  text: string;
  subText?: string | null;
  /** Epoch ms when rest ends: the notification counts down to it. */
  restEndsAt?: number | null;
  /** Epoch ms the workout started: shown as elapsed time when not resting. */
  startedAt?: number | null;
  progress?: number | null;
  progressMax?: number | null;
  /** #RRGGBB accent. */
  color?: string | null;
  /** Up to three buttons. */
  actions?: LiveAction[];
};

type WorkoutLiveEvents = {
  onAction(event: { action: string }): void;
};

declare class WorkoutLiveModule extends NativeModule<WorkoutLiveEvents> {
  show(content: LiveContent): boolean;
  hide(): void;
}

/** Android only; null on iOS, web and in tests, where every call is a no-op. */
const native = requireOptionalNativeModule<WorkoutLiveModule>('WorkoutLive');

export function showWorkoutLive(content: LiveContent): boolean {
  if (!native) return false;
  try {
    return native.show(content);
  } catch {
    return false;
  }
}

export function hideWorkoutLive(): void {
  try {
    native?.hide();
  } catch {
    // The notification also times out on its own.
  }
}

export function addWorkoutLiveActionListener(listener: (action: string) => void): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onAction', (event) => listener(event.action));
  return () => subscription.remove();
}
