import type { Exercise } from '@/types';

type ExerciseInput = Omit<
  Exercise,
  'id' | 'aliases' | 'secondaryMuscles' | 'easierAlternatives' | 'harderAlternatives' | 'equivalentAlternatives' | 'laterality' | 'trackingType'
> &
  Partial<
    Pick<
      Exercise,
      | 'aliases'
      | 'secondaryMuscles'
      | 'easierAlternatives'
      | 'harderAlternatives'
      | 'equivalentAlternatives'
      | 'laterality'
      | 'trackingType'
    >
  >;

/**
 * Seed exercises use their slug as a stable id so demo data, program
 * references, and Supabase seeds stay deterministic across installs.
 */
export function defineExercise(input: ExerciseInput): Exercise {
  return {
    id: input.slug,
    aliases: [],
    secondaryMuscles: [],
    easierAlternatives: [],
    harderAlternatives: [],
    equivalentAlternatives: [],
    laterality: 'bilateral',
    trackingType: 'weight_reps',
    ...input,
  };
}
