/**
 * Shared domain vocabulary used across the whole app.
 * Keep these framework-free: no React, no Supabase imports.
 */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'lower_back';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'lower_back',
];

/** Muscles the user can rank as priorities during onboarding. */
export const PRIORITY_MUSCLES: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
];

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'adjustable_dumbbell'
  | 'bench'
  | 'incline_bench'
  | 'squat_rack'
  | 'pull_up_bar'
  | 'dip_station'
  | 'cable_machine'
  | 'plate_loaded_machine'
  | 'selectorized_machine'
  | 'smith_machine'
  | 'resistance_band'
  | 'kettlebell'
  | 'leg_press'
  | 'hack_squat'
  | 'ez_bar'
  | 'bodyweight';

export const EQUIPMENT_TYPES: EquipmentType[] = [
  'barbell',
  'dumbbell',
  'adjustable_dumbbell',
  'bench',
  'incline_bench',
  'squat_rack',
  'pull_up_bar',
  'dip_station',
  'cable_machine',
  'plate_loaded_machine',
  'selectorized_machine',
  'smith_machine',
  'resistance_band',
  'kettlebell',
  'leg_press',
  'hack_squat',
  'ez_bar',
  'bodyweight',
];

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hip_hinge'
  | 'hip_thrust'
  | 'lunge'
  | 'knee_flexion'
  | 'knee_extension'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'shoulder_abduction'
  | 'shoulder_flexion'
  | 'rear_delt'
  | 'chest_fly'
  | 'pullover'
  | 'calf_raise'
  | 'ab_flexion'
  | 'anti_extension'
  | 'anti_rotation';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingGoal = 'hypertrophy' | 'strength' | 'mixed';
export type NutritionContext = 'unknown' | 'maintenance' | 'surplus' | 'deficit';
export type TrainingEnvironment = 'commercial_gym' | 'home_gym' | 'bodyweight' | 'custom';
export type Units = 'kg' | 'lb';
export type CoachingTone = 'supportive' | 'direct' | 'hype' | 'science';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type ExerciseType = 'compound' | 'isolation';
export type Laterality = 'bilateral' | 'unilateral';
export type TrackingType = 'weight_reps' | 'bodyweight_reps' | 'weighted_bodyweight' | 'time';

export type Exercise = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  description: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentType[];
  movementPattern: MovementPattern;
  difficulty: ExerciseDifficulty;
  exerciseType: ExerciseType;
  laterality: Laterality;
  trackingType: TrackingType;
  instructions: string[];
  commonMistakes: string[];
  scienceExplanation: string;
  progressionInstructions: string;
  easierAlternatives: string[]; // slugs
  harderAlternatives: string[]; // slugs
  equivalentAlternatives: string[]; // slugs
};

// ---------------------------------------------------------------------------
// User / preferences
// ---------------------------------------------------------------------------

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday

export type TrainingPreferences = {
  goal: TrainingGoal;
  /** Optional self-reported context; never interpreted as a calorie prescription. */
  nutritionContext?: NutritionContext;
  experience: ExperienceLevel;
  environment: TrainingEnvironment;
  equipment: EquipmentType[];
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  preferredDays: DayOfWeek[];
  sessionMinutes: 30 | 45 | 60 | 75 | 90;
  /** Ordered, highest priority first. Up to 3. */
  musclePriorities: MuscleGroup[];
  preferredExerciseSlugs: string[];
  dislikedExerciseSlugs: string[];
  excludedExerciseSlugs: string[];
  /** Exercises previously flagged as causing discomfort. */
  discomfortExerciseSlugs: string[];
  units: Units;
  coachingTone: CoachingTone;
};

export type UserProfile = {
  id: string;
  displayName: string;
  email?: string;
  createdAt: string;
  onboardingCompleted: boolean;
};

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export type SplitType =
  'full_body' | 'upper_lower' | 'push_pull_legs' | 'upper_lower_full' | 'custom';

export type ExercisePrescription = {
  exerciseId: string;
  order: number;
  workingSets: number;
  minReps: number;
  maxReps: number;
  targetRir: number;
  restSeconds: number;
  recommendedLoad?: number;
  selectionReason: string;
  /** Coach/programmer note shown before starting the exercise. */
  note?: string;
  /** Optional default intensification technique applied to new workout sets. */
  setTechnique?: SetTechnique;
  /**
   * Chains this exercise to the very next one in the day/session as a
   * superset — logging a set on either advances straight to the other with
   * no rest, instead of waiting for this exercise to finish. A run of
   * exercises can chain together (A→B→C) by flagging each except the last.
   * Adjacency-based rather than a group id, matching how a template/session
   * already stores exercises as an ordered list — see docs/PLAN.md.
   */
  supersetWithNext?: boolean;
};

export type ProgramDay = {
  id: string;
  name: string;
  /** index within the training week, 0-based */
  order: number;
  focus: MuscleGroup[];
  prescriptions: ExercisePrescription[];
  estimatedMinutes: number;
};

export type TrainingProgram = {
  id: string;
  userId: string;
  name: string;
  splitType: SplitType;
  daysPerWeek: number;
  days: ProgramDay[];
  createdAt: string;
  active: boolean;
  /** Generator explanation shown on the GymBro screen. */
  rationale: string;
};

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export type SetKind = 'warmup' | 'working' | 'failure';

/**
 * How a working set was extended beyond a single clean effort. All five
 * intensification techniques reduce to the same shape: a primary effort
 * (the set's own loadKg/reps) plus a list of follow-on sub-efforts —
 * a drop set's reduced-load continuations, a rest-pause/myo-rep/cluster
 * set's short-rest clusters at the same load, or a backoff set's lighter
 * volume after a top set.
 */
export type SetTechnique =
  'standard' | 'drop_set' | 'rest_pause' | 'myo_reps' | 'cluster_set' | 'top_backoff';

export type SubEffort = {
  loadKg: number | null;
  reps: number | null;
  /** Rest taken before this sub-effort, seconds. 0 for a true drop set (no rest). */
  restSeconds: number;
};

export type SetFormAnalysis = {
  id: string;
  exerciseId: string;
  capturedAt: string;
  repCount: number;
  averageScore: number;
  averageRomScore: number;
  averageTempoScore: number;
  bestRepScore: number | null;
  worstRepScore: number | null;
  mostCommonIssue: string | null;
  recommendations: string[];
};

export type PerformedSet = {
  id: string;
  setNumber: number;
  kind: SetKind;
  /** External load in kg. 0 for pure bodyweight sets. */
  loadKg: number | null;
  reps: number | null;
  /** Duration for time-tracked exercises, seconds. */
  durationSeconds: number | null;
  rir: number | null;
  completed: boolean;
  skipped: boolean;
  completedAt: string | null;
  note?: string;
  /** Defaults to 'standard' when omitted — every set logged before this field existed. */
  technique?: SetTechnique;
  /** Follow-on efforts after the primary load/reps above. Empty/omitted for a standard set. */
  subEfforts?: SubEffort[];
  /** Optional camera-based set-quality analysis captured with Form AI. */
  formAnalysis?: SetFormAnalysis;
};

export type PerformedExercise = {
  id: string;
  exerciseId: string;
  order: number;
  prescription: ExercisePrescription;
  sets: PerformedSet[];
  /** Set when the user swapped this exercise in. */
  replacedExerciseId?: string;
  replacementReason?: ReplacementReason;
  markedDiscomfort: boolean;
  markedUnavailable: boolean;
  note?: string;
};

export type WorkoutStatus = 'in_progress' | 'paused' | 'completed' | 'discarded';

export type RestTimerSnapshot = {
  /** Absolute deadline so backgrounding or restarting cannot freeze the countdown. */
  endsAt: string;
  durationSeconds: number;
};

export type WorkoutSession = {
  id: string;
  userId: string;
  programId: string | null;
  programDayId: string | null;
  dayName: string;
  status: WorkoutStatus;
  startedAt: string;
  finishedAt: string | null;
  exercises: PerformedExercise[];
  readiness?: ReadinessCheckIn;
  totalPausedSeconds: number;
  /** Set only while the whole workout is paused; absent on legacy sessions. */
  pausedAt?: string | null;
  /** Persisted countdown state; absent on sessions created before timer persistence. */
  restTimer?: RestTimerSnapshot | null;
  note?: string;
};

export type ReadinessCheckIn = {
  energy: 1 | 2 | 3 | 4 | 5;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  recovery: 1 | 2 | 3 | 4 | 5;
  /** muscle -> soreness 0 (none) to 3 (severe) */
  soreness: Partial<Record<MuscleGroup, 0 | 1 | 2 | 3>>;
  availableMinutes?: number;
  hasPain: boolean;
  painNote?: string;
};

export type ReplacementReason =
  | 'equipment_unavailable'
  | 'machine_occupied'
  | 'discomfort'
  | 'disliked'
  | 'easier_alternative'
  | 'harder_alternative'
  | 'general';

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export type ExercisePerformanceHistory = {
  sessionId: string;
  date: string;
  prescription: ExercisePrescription;
  sets: PerformedSet[];
  readiness?: ReadinessCheckIn;
};

export type ProgressionAction =
  | 'increase_load'
  | 'increase_reps'
  | 'maintain'
  | 'decrease_load'
  | 'reduce_sets'
  | 'add_set'
  | 'suggest_deload'
  | 'needs_more_data';

export type ProgressionConfidence = 'low' | 'medium' | 'high';

export type ProgressionReasonCode =
  | 'NO_COMPLETED_SETS'
  | 'PAIN_HOLD'
  | 'INCOMPLETE_PRESCRIPTION'
  | 'CALIBRATING_LOAD'
  | 'MISSING_RIR_HOLD'
  | 'DELOAD_SIGNALS'
  | 'SHARP_INTRASET_DROP'
  | 'EXTREME_MISS'
  | 'REPEATED_BELOW_MIN'
  | 'ONE_OFF_MISS'
  | 'TOP_OF_RANGE_ALL_SETS'
  | 'BODYWEIGHT_TOP_OF_RANGE'
  | 'PRIORITY_VOLUME_HEADROOM'
  | 'IN_RANGE_PROGRESS_REPS'
  | 'HOLD_STEADY';

export type ProgressionDecision = {
  exerciseId: string;
  action: ProgressionAction;
  nextLoad?: number;
  nextMinReps: number;
  nextMaxReps: number;
  nextWorkingSets: number;
  confidence: ProgressionConfidence;
  reasonCode: ProgressionReasonCode;
  ruleVersion: number;
  explanation: string;
  supportingMetrics: Record<string, number | string>;
  createdAt: string;
  sessionId: string;
};

export type ProgressionInput = {
  prescription: ExercisePrescription;
  performedSets: PerformedSet[];
  previousSessions: ExercisePerformanceHistory[];
  exercise: Exercise;
  userExperience: ExperienceLevel;
  nutritionContext?: NutritionContext;
  readiness?: ReadinessCheckIn;
  /** Weekly working sets currently programmed for the exercise's primary muscle. */
  weeklySetsForPrimaryMuscle?: number;
  isPriorityMuscle?: boolean;
  reportedDiscomfort?: boolean;
};

// ---------------------------------------------------------------------------
// Records / summaries
// ---------------------------------------------------------------------------

export type PersonalRecordKind = 'max_load' | 'max_reps_at_load' | 'best_e1rm' | 'max_volume';

export type PersonalRecord = {
  id: string;
  exerciseId: string;
  kind: PersonalRecordKind;
  value: number;
  loadKg?: number;
  reps?: number;
  date: string;
  sessionId: string;
};

export type WeeklyTrainingSummary = {
  weekStart: string;
  workoutsPlanned: number;
  workoutsCompleted: number;
  totalWorkingSets: number;
  setsByMuscle: Partial<Record<MuscleGroup, number>>;
  volumeKg: number;
  newRecords: number;
};
