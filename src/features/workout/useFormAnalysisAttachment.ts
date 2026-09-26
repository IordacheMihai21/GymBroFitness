import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';

import { takePendingFormAnalysisResult } from '@/domain/vision/formAnalysisResultStore';
import type { WorkoutSession } from '@/types';

import { attachFormAnalysisResult } from './workout.helpers';

/**
 * Picks up a Form AI result recorded while the camera screen was open and
 * attaches it to the set it was analyzing, on every focus of the workout
 * screen. Split out of `useWorkoutSession` since it only needs the session
 * id and the setter, not any of the set-editing logic.
 */
export function useFormAnalysisAttachment(
  sessionId: string,
  setSession: Dispatch<SetStateAction<WorkoutSession>>,
) {
  const [formAnalysisStatus, setFormAnalysisStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      takePendingFormAnalysisResult(sessionId).then((result) => {
        if (!mounted || !result) return;
        setSession((prev) => attachFormAnalysisResult(prev, result));
        setFormAnalysisStatus(`Form AI attached to set ${result.setIndex + 1}.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
      return () => {
        mounted = false;
      };
    }, [sessionId, setSession]),
  );

  return { formAnalysisStatus };
}
