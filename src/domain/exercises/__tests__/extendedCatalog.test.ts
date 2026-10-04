import { EQUIPMENT_TYPES, MUSCLE_GROUPS } from '@/types';

import {
  ALL_EXERCISES,
  EXERCISE_CATALOG,
  EXTENDED_EXERCISES,
  availableExercises,
  getExercise,
  isAutoProgrammed,
} from '../catalog';
import { setsByMuscle } from '@/domain/workouts/analytics';
import { BROWSABLE_EXERCISE_LIBRARY, exerciseThumbnailUrl } from '../library';

// The extended catalog is generated at install time; an offline install writes
// an empty one, so these checks hold either way.
describe('extended RepDB catalog', () => {
  it('never collides with curated ids and always carries valid metadata', () => {
    const curatedIds = new Set(EXERCISE_CATALOG.map((exercise) => exercise.id));
    for (const exercise of EXTENDED_EXERCISES) {
      expect(curatedIds.has(exercise.id)).toBe(false);
      expect(exercise.id.startsWith('repdb-')).toBe(true);
      expect(exercise.primaryMuscles.length).toBeGreaterThan(0);
      expect(exercise.primaryMuscles.every((muscle) => MUSCLE_GROUPS.includes(muscle))).toBe(true);
      expect(exercise.equipment.every((item) => EQUIPMENT_TYPES.includes(item))).toBe(true);
      expect(exerciseThumbnailUrl(exercise)).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/RepDB\//,
      );
    }
    expect(new Set(ALL_EXERCISES.map((exercise) => exercise.id)).size).toBe(ALL_EXERCISES.length);
  });

  it('keeps the program generator pool curated unless extended is requested', () => {
    const owned = [...EQUIPMENT_TYPES];
    expect(availableExercises(owned).every((exercise) => !exercise.id.startsWith('repdb-'))).toBe(
      true,
    );
    expect(availableExercises(owned, [], { includeExtended: true }).length).toBe(
      availableExercises(owned).length +
        EXTENDED_EXERCISES.filter((exercise) =>
          availableExercises(owned, [], { includeExtended: true }).includes(exercise),
        ).length,
    );
  });

  it('only admits progressive-overload movements with one directly trained muscle', () => {
    const lowHypertrophy =
      /carry|farmer|\bwalk\b|swing|clean|snatch|jerk|thruster|plank|hold|wall sit|twist|windmill/i;
    for (const exercise of EXTENDED_EXERCISES) {
      expect(exercise.primaryMuscles).toHaveLength(1);
      expect(exercise.secondaryMuscles).not.toContain(exercise.primaryMuscles[0]);
      expect(exercise.trackingType).not.toBe('time');
      expect(exercise.name).not.toMatch(lowHypertrophy);
      expect(isAutoProgrammed(exercise)).toBe(false);
    }
    expect(EXERCISE_CATALOG.every(isAutoProgrammed)).toBe(true);
  });

  it('counts extended sets as direct volume for the main muscle only', () => {
    const exercise = EXTENDED_EXERCISES.find((item) => item.secondaryMuscles.length > 0);
    if (!exercise) return; // offline install: nothing to check
    const session = {
      id: 's1',
      userId: 'u1',
      programId: null,
      programDayId: null,
      dayName: 'Test',
      status: 'completed' as const,
      startedAt: '2026-10-01T10:00:00Z',
      finishedAt: '2026-10-01T11:00:00Z',
      totalPausedSeconds: 0,
      exercises: [
        {
          id: 'p1',
          exerciseId: exercise.id,
          order: 0,
          markedDiscomfort: false,
          markedUnavailable: false,
          prescription: {
            exerciseId: exercise.id,
            order: 0,
            workingSets: 3,
            minReps: 8,
            maxReps: 12,
            targetRir: 2,
            restSeconds: 120,
            selectionReason: 'test',
          },
          sets: [1, 2, 3].map((setNumber) => ({
            id: `set-${setNumber}`,
            setNumber,
            kind: 'working' as const,
            loadKg: 20,
            reps: 10,
            durationSeconds: null,
            rir: 2,
            completed: true,
            skipped: false,
            completedAt: null,
          })),
        },
      ],
    };
    const bySetMuscle = setsByMuscle(session, getExercise);
    expect(bySetMuscle[exercise.primaryMuscles[0]]).toBe(3);
    for (const muscle of exercise.secondaryMuscles) {
      expect(bySetMuscle[muscle]).toBeUndefined();
    }
  });

  it('resolves curated names exactly as before', () => {
    expect(getExercise('Barbell Bench Press')?.id).toBe('barbell-bench-press');
    expect(getExercise('barbell-bench-press')?.id).toBe('barbell-bench-press');
  });

  it('lists each extended exercise in the browsable library at most once', () => {
    const ids = BROWSABLE_EXERCISE_LIBRARY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
