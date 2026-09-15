import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  createGeneratedProgramSnapshot,
  loadActiveProgram,
  resetActiveProgram,
  saveActiveProgram,
  type ActiveProgramSnapshot,
} from '@/domain/programs/programStore';
import type { TrainingProgram } from '@/types';

import { useTrainingProfile } from './useTrainingProfile';

export function useActiveProgram() {
  const profile = useTrainingProfile();
  const fallback = useMemo(
    () => createGeneratedProgramSnapshot(profile.preferences, profile.user.id),
    [profile.preferences, profile.user.id],
  );
  const [snapshot, setSnapshot] = useState<ActiveProgramSnapshot | null>(null);
  const [loadingProgram, setLoadingProgram] = useState(true);

  const reloadProgram = useCallback(async () => {
    setLoadingProgram(true);
    const next = await loadActiveProgram(profile.preferences, profile.user.id);
    setSnapshot(next);
    setLoadingProgram(false);
    return next;
  }, [profile.preferences, profile.user.id]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoadingProgram(true);
      loadActiveProgram(profile.preferences, profile.user.id)
        .then((next) => {
          if (mounted) setSnapshot(next);
        })
        .finally(() => {
          if (mounted) setLoadingProgram(false);
        });
      return () => {
        mounted = false;
      };
    }, [profile.preferences, profile.user.id]),
  );

  const saveProgram = useCallback(async (program: TrainingProgram) => {
    const next = await saveActiveProgram(program);
    setSnapshot(next);
    return next;
  }, []);

  const resetProgram = useCallback(async () => {
    const next = await resetActiveProgram(profile.preferences, profile.user.id);
    setSnapshot(next);
    return next;
  }, [profile.preferences, profile.user.id]);

  const effective = snapshot?.program.userId === profile.user.id ? snapshot : fallback;

  return {
    ...effective,
    user: profile.user,
    preferences: profile.preferences,
    loading: profile.loading || loadingProgram,
    saveProgram,
    resetProgram,
    reloadProgram,
  };
}
