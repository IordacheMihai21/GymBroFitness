import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  DEFAULT_TRAINING_PROFILE,
  loadTrainingProfile,
  type TrainingProfileSnapshot,
} from '@/domain/programs/profileStore';

export function useTrainingProfile(): TrainingProfileSnapshot & { loading: boolean } {
  const [profile, setProfile] = useState<TrainingProfileSnapshot>(DEFAULT_TRAINING_PROFILE);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      loadTrainingProfile()
        .then((next) => {
          if (mounted) setProfile(next);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });

      return () => {
        mounted = false;
      };
    }, []),
  );

  return { ...profile, loading };
}
