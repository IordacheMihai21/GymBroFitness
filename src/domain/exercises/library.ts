import type { Exercise, MuscleGroup } from '@/types';

import {
  EXERCISE_CATALOG,
  EXTENDED_EXERCISES,
  EXTENDED_IMAGE_BASE,
  EXTENDED_IMAGES,
  getExercise,
} from './catalog';
import libraryData from './seed/library.json';
import repDbMediaData from './seed/repdb-media.json';

const FREE_EXERCISE_DB_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f';

/**
 * Browsable reference data from the free-exercise-db public-domain dataset
 * (github.com/yuhonas/free-exercise-db, Unlicense). Separate from
 * EXERCISE_CATALOG: this is for search/browse only and isn't tagged with
 * the movementPattern/trackingType/laterality the program generator needs.
 */
export type LibraryExercise = {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipmentLabel: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'expert';
  mechanic: 'compound' | 'isolation' | null;
  instructions: string[];
  images: string[];
};

export const EXERCISE_LIBRARY = libraryData as LibraryExercise[];

const CATALOG_LIBRARY_PREFIX = 'catalog:';
const REPDB_MEDIA = repDbMediaData.media as Readonly<Record<string, string[]>>;
/** free-exercise-db id -> RepDB illustration of the same-named exercise. */
const REPDB_REFERENCE_TWINS = repDbMediaData.references as Readonly<Record<string, string[]>>;

/** RepDB image path -> loggable exercise using it, to link reference twins to something loggable. */
const EXERCISE_BY_REPDB_IMAGE = new Map<string, string>([
  ...Object.entries(REPDB_MEDIA).flatMap(([id, paths]) => paths.map((path) => [path, id] as const)),
  ...Object.entries(EXTENDED_IMAGES).flatMap(([id, paths]) =>
    paths.map((path) => [path, id] as const),
  ),
]);
const REPDB_IMAGE_BASE = `https://raw.githubusercontent.com/RepDB/exercise-dataset/${repDbMediaData.commit}/`;

/**
 * Explicit bridge from reference-only data to the smaller loggable catalog.
 * Entries are reviewed manually; absence means "reference only", never an
 * automatic fuzzy conversion.
 */
export const REFERENCE_TO_CATALOG_ID: Readonly<Record<string, string>> = {
  Barbell_Squat: 'barbell-back-squat',
  Bent_Over_Barbell_Row: 'barbell-row',
  Cable_Crossover: 'cable-fly',
  'Chin-Up': 'chin-up',
  'Dips_-_Chest_Version': 'dip',
  Dumbbell_Bench_Press: 'dumbbell-bench-press',
  Incline_Dumbbell_Press: 'incline-dumbbell-press',
  Leg_Press: 'leg-press',
  Machine_Bench_Press: 'machine-chest-press',
  Plank: 'plank',
  Pullups: 'pull-up',
  Pushups: 'push-up',
  Romanian_Deadlift: 'romanian-deadlift',
  Seated_Calf_Raise: 'seated-calf-raise',
  Standing_Military_Press: 'overhead-press',
};

/**
 * catalogSlug -> reference id, for the image-lookup direction only
 * (referenceExerciseForCatalog). Separate from REFERENCE_TO_CATALOG_ID
 * because that map's keys (reference ids) must be unique, but several
 * catalog variants legitimately share one reference photo when the dataset
 * has no equipment-specific shot of its own (e.g. hip-thrust and
 * machine-hip-thrust both show the barbell version — same movement, no
 * machine-specific reference exists). Reviewed manually, same as above;
 * absence here just falls through to the canonical-name match below.
 */
export const CATALOG_IMAGE_OVERRIDES: Readonly<Record<string, string>> = {
  'ab-wheel-rollout': 'Ab_Roller',
  'back-extension': 'Hyperextensions_Back_Extensions',
  'band-assisted-pull-up': 'Band_Assisted_Pull-Up',
  'band-lateral-raise': 'Lateral_Raise_-_With_Bands',
  'band-pull-apart': 'Band_Pull_Apart',
  'band-pushdown': 'Triceps_Pushdown',
  'barbell-bench-press': 'Barbell_Bench_Press_-_Medium_Grip',
  'barbell-curl': 'Barbell_Curl',
  'bench-dip': 'Bench_Dips',
  'bulgarian-split-squat': 'Split_Squat_with_Dumbbells',
  'cable-crunch': 'Cable_Crunch',
  'cable-curl': 'Standing_Biceps_Cable_Curl',
  'cable-lateral-raise': 'Cable_Seated_Lateral_Raise',
  'chest-supported-row': 'Dumbbell_Incline_Row',
  'close-grip-bench-press': 'Close-Grip_Barbell_Bench_Press',
  'deficit-push-up': 'Pushups',
  'diamond-push-up': 'Pushups',
  'dumbbell-curl': 'Dumbbell_Bicep_Curl',
  'dumbbell-fly': 'Dumbbell_Flyes',
  'dumbbell-pullover': 'Bent-Arm_Dumbbell_Pullover',
  'dumbbell-rdl': 'Romanian_Deadlift',
  'dumbbell-row': 'One-Arm_Dumbbell_Row',
  'ez-bar-curl': 'EZ-Bar_Curl',
  'face-pull': 'Face_Pull',
  'glute-bridge': 'Barbell_Glute_Bridge',
  'goblet-squat': 'Goblet_Squat',
  'hack-squat-machine': 'Hack_Squat',
  'hammer-curl': 'Hammer_Curls',
  'hanging-knee-raise': 'Hanging_Leg_Raise',
  'hanging-leg-raise': 'Hanging_Leg_Raise',
  'hip-thrust': 'Barbell_Hip_Thrust',
  'incline-barbell-press': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'incline-dumbbell-curl': 'Incline_Dumbbell_Curl',
  'incline-push-up': 'Incline_Push-Up',
  'inverted-row': 'Inverted_Row',
  'lat-pulldown': 'Wide-Grip_Lat_Pulldown',
  'lateral-raise': 'Side_Lateral_Raise',
  'leg-extension': 'Single-Leg_Leg_Extension',
  'leg-press-calf-raise': 'Calf_Press_On_The_Leg_Press_Machine',
  'lying-leg-curl': 'Lying_Leg_Curls',
  'machine-hip-thrust': 'Barbell_Hip_Thrust',
  'machine-lateral-raise': 'Side_Lateral_Raise',
  'machine-row': 'Leverage_Iso_Row',
  'machine-shoulder-press': 'Machine_Shoulder_Military_Press',
  'overhead-triceps-extension': 'Cable_Rope_Overhead_Triceps_Extension',
  'pallof-press': 'Pallof_Press',
  'pec-deck': 'Butterfly',
  'preacher-curl': 'Preacher_Curl',
  'reverse-crunch': 'Reverse_Crunch',
  'reverse-fly': 'Reverse_Flyes',
  'seated-cable-row': 'Seated_Cable_Rows',
  'seated-dumbbell-press': 'Seated_Dumbbell_Press',
  'seated-leg-curl': 'Seated_Leg_Curl',
  'sissy-squat': 'Weighted_Sissy_Squat',
  'skull-crusher': 'EZ-Bar_Skullcrusher',
  'slider-leg-curl': 'Ball_Leg_Curl',
  'smith-machine-bench-press': 'Smith_Machine_Bench_Press',
  'smith-machine-squat': 'Smith_Machine_Squat',
  'split-squat': 'Split_Squat_with_Dumbbells',
  'standing-calf-raise': 'Standing_Dumbbell_Calf_Raise',
  'step-up': 'Dumbbell_Step_Ups',
  'straight-arm-pulldown': 'Straight-Arm_Pulldown',
  'triceps-dip': 'Dips_-_Triceps_Version',
  'triceps-pushdown': 'Triceps_Pushdown',
  'walking-lunge': 'Barbell_Walking_Lunge',
  'weighted-crunch': 'Cable_Crunch',
  'weighted-push-up': 'Pushups',
};

/**
 * Reviewed loggable movements missing from the public reference dataset.
 * They remain useful without borrowed imagery: the detail view renders the
 * app's own coaching cues instead of showing a visually similar but incorrect
 * exercise demonstration.
 */
const catalogIdsRepresentedByReferences = new Set(
  EXERCISE_LIBRARY.flatMap((reference) => {
    const catalogId = reviewedCatalogIdForReference(reference);
    return catalogId ? [catalogId] : [];
  }),
);

export const CATALOG_LIBRARY_SUPPLEMENTS: LibraryExercise[] = [
  ...EXERCISE_CATALOG,
  ...EXTENDED_EXERCISES,
]
  .filter((exercise) => !catalogIdsRepresentedByReferences.has(exercise.id))
  .map(catalogExerciseAsLibraryEntry);

export const BROWSABLE_EXERCISE_LIBRARY: LibraryExercise[] = [
  ...EXERCISE_LIBRARY,
  ...CATALOG_LIBRARY_SUPPLEMENTS,
];

export function loggableExerciseForReference(reference: LibraryExercise): Exercise | null {
  if (reference.id.startsWith(CATALOG_LIBRARY_PREFIX)) {
    return getExercise(reference.id.slice(CATALOG_LIBRARY_PREFIX.length)) ?? null;
  }
  const catalogId = reviewedCatalogIdForReference(reference);
  return catalogId ? (getExercise(catalogId) ?? null) : null;
}

/**
 * Return a reviewed visual reference for a loggable catalog exercise.
 * Explicit mappings win; an exact canonical name match is safe for display
 * but does not make an otherwise-unreviewed reference entry loggable.
 */
export function referenceExerciseForCatalog(exercise: Exercise): LibraryExercise | null {
  const repDbImages = repDbImagesForCatalog(exercise);
  if (repDbImages.length > 0) {
    return { ...catalogExerciseAsLibraryEntry(exercise), images: repDbImages };
  }

  const overrideReferenceId = CATALOG_IMAGE_OVERRIDES[exercise.id];
  if (overrideReferenceId) {
    const reference = EXERCISE_LIBRARY.find((candidate) => candidate.id === overrideReferenceId);
    return reference ? pinReferenceImages(reference) : null;
  }

  const explicitReferenceId = Object.entries(REFERENCE_TO_CATALOG_ID).find(
    ([, catalogId]) => catalogId === exercise.id,
  )?.[0];

  if (explicitReferenceId) {
    const reference = EXERCISE_LIBRARY.find((candidate) => candidate.id === explicitReferenceId);
    return reference ? pinReferenceImages(reference) : null;
  }

  const canonicalName = exercise.name.trim().toLocaleLowerCase();
  const reference = EXERCISE_LIBRARY.find(
    (candidate) => candidate.name.trim().toLocaleLowerCase() === canonicalName,
  );
  return reference ? pinReferenceImages(reference) : null;
}

/** First demo image for a catalog exercise, ready to render — for row thumbnails where a full preview isn't needed. */
export function exerciseThumbnailUrl(exercise: Exercise): string | undefined {
  return referenceExerciseForCatalog(exercise)?.images[0];
}

/** Prefer the reviewed RepDB visual for linked catalog exercises, then the public-domain reference. */
export function preferredLibraryImages(reference: LibraryExercise): string[] {
  const loggableExercise = loggableExerciseForReference(reference);
  if (loggableExercise) {
    const repDbImages = repDbImagesForCatalog(loggableExercise);
    if (repDbImages.length > 0) return repDbImages;
  }
  return referenceImages(reference);
}

function pinReferenceImages(reference: LibraryExercise): LibraryExercise {
  return { ...reference, images: referenceImages(reference) };
}

/** RepDB twin illustration when one exists, otherwise the pinned free-exercise-db photos. */
function referenceImages(reference: LibraryExercise): string[] {
  const twin = REPDB_REFERENCE_TWINS[reference.id];
  if (twin?.length) return twin.map((path) => `${REPDB_IMAGE_BASE}${path}`);
  return reference.images.map(referenceImageUrl);
}

export function referenceImageUrl(image: string): string {
  return image.replace(
    '/yuhonas/free-exercise-db/main/',
    `/yuhonas/free-exercise-db/${FREE_EXERCISE_DB_COMMIT}/`,
  );
}

function repDbImagesForCatalog(exercise: Exercise): string[] {
  const curated = REPDB_MEDIA[exercise.id];
  if (curated?.length) return curated.map((path) => `${REPDB_IMAGE_BASE}${path}`);
  return (EXTENDED_IMAGES[exercise.id] ?? []).map((path) => `${EXTENDED_IMAGE_BASE}${path}`);
}

function reviewedCatalogIdForReference(reference: LibraryExercise): string | null {
  const twin = REPDB_REFERENCE_TWINS[reference.id]?.[0];
  return (
    REFERENCE_TO_CATALOG_ID[reference.id] ??
    getExercise(reference.name)?.id ??
    (twin ? (EXERCISE_BY_REPDB_IMAGE.get(twin) ?? null) : null)
  );
}

function catalogExerciseAsLibraryEntry(exercise: Exercise): LibraryExercise {
  return {
    id: `${CATALOG_LIBRARY_PREFIX}${exercise.id}`,
    name: exercise.name,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    equipmentLabel: exercise.equipment.map((item) => item.replace(/_/g, ' ')).join(', '),
    category: exercise.movementPattern.replace(/_/g, ' '),
    level: exercise.difficulty === 'advanced' ? 'expert' : exercise.difficulty,
    mechanic: exercise.exerciseType,
    instructions: exercise.instructions,
    images: [],
  };
}

export function searchLibrary(
  query: string,
  muscle: MuscleGroup | null,
  pool: LibraryExercise[] = BROWSABLE_EXERCISE_LIBRARY,
): LibraryExercise[] {
  const normalizedQuery = query.trim().toLowerCase();
  return pool.filter((exercise) => {
    const matchesMuscle = !muscle || exercise.primaryMuscles.includes(muscle);
    const loggableExercise = loggableExerciseForReference(exercise);
    const searchableNames = loggableExercise
      ? [exercise.name, loggableExercise.name, loggableExercise.slug, ...loggableExercise.aliases]
      : [exercise.name];
    const matchesQuery =
      normalizedQuery.length === 0 ||
      searchableNames.some((name) => name.toLowerCase().includes(normalizedQuery));
    return matchesMuscle && matchesQuery;
  });
}

/**
 * One discoverable library row per loggable catalog identity, preserving the
 * current search order while presenting GymBro's canonical name and metadata.
 */
export function workoutReadyLibrary(pool: LibraryExercise[]): LibraryExercise[] {
  const seenCatalogIds = new Set<string>();
  return pool.flatMap((reference) => {
    const catalogExercise = loggableExerciseForReference(reference);
    if (!catalogExercise || seenCatalogIds.has(catalogExercise.id)) return [];
    seenCatalogIds.add(catalogExercise.id);
    return [
      {
        ...catalogExerciseAsLibraryEntry(catalogExercise),
        images: preferredLibraryImages(reference),
      },
    ];
  });
}
