import { canonicalExerciseId, EXERCISE_CATALOG, getExercise } from '@/domain/exercises/catalog';
import type { PerformedSet, SetKind, Units, WorkoutSession } from '@/types';
import { inputToKg } from '@/utils/units';

import { csvRecords, parseCsv } from './csv';

export type WorkoutImportSource = 'hevy' | 'strong';

export type WorkoutImportWarning = {
  row: number;
  code: 'invalid_row' | 'invalid_date' | 'unmapped_exercise' | 'invalid_number';
  message: string;
};

export type WorkoutImportResult = {
  source: WorkoutImportSource;
  sessions: WorkoutSession[];
  warnings: WorkoutImportWarning[];
  totalRows: number;
  importedRows: number;
  unmappedExercises: { name: string; rowCount: number }[];
};

type ImportOptions = {
  userId: string;
  strongWeightUnit: Units;
  exerciseMappings?: Record<string, string>;
};

type NormalizedRow = {
  row: number;
  sessionKey: string;
  title: string;
  start: Date;
  end: Date;
  exerciseName: string;
  exerciseId: string;
  setIndex: number;
  kind: SetKind;
  technique: PerformedSet['technique'];
  loadKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rir: number | null;
  note?: string;
};

const EXTERNAL_NAME_OVERRIDES: Record<string, string> = {
  'bench press barbell': 'barbell-bench-press',
  'squat barbell': 'barbell-back-squat',
  'overhead press barbell': 'overhead-press',
  'shoulder press barbell': 'overhead-press',
  'bent over row barbell': 'barbell-row',
  'pull up': 'pull-up',
  'chin up': 'chin-up',
};

const signatureIndex = buildSignatureIndex();

export function parseExternalWorkoutCsv(raw: string, options: ImportOptions): WorkoutImportResult {
  const rows = csvRecords(raw);
  if (rows.length === 0) throw new Error('CSV contains no workout rows.');
  const headers = parseCsv(raw)[0]?.map((header) => header.trim()) ?? [];
  const source = detectSource(headers);
  const warnings: WorkoutImportWarning[] = [];
  const unmappedCounts = new Map<string, number>();
  const normalized: NormalizedRow[] = [];

  rows.forEach((record, index) => {
    const row = index + 2;
    try {
      const parsed = normalizeRow(record, row, source, options);
      if (!parsed.exerciseId) {
        unmappedCounts.set(parsed.exerciseName, (unmappedCounts.get(parsed.exerciseName) ?? 0) + 1);
        warnings.push({
          row,
          code: 'unmapped_exercise',
          message: `Exercise "${parsed.exerciseName}" needs a mapping before import.`,
        });
        return;
      }
      normalized.push(parsed as NormalizedRow);
    } catch (error) {
      warnings.push({
        row,
        code: error instanceof InvalidDateError ? 'invalid_date' : 'invalid_row',
        message: error instanceof Error ? error.message : 'Row could not be parsed.',
      });
    }
  });

  if (normalized.length === 0) throw new Error('No importable workout rows were found.');
  if (normalized.length < rows.length / 2) {
    throw new Error('More than half of the CSV rows need correction before import.');
  }

  return {
    source,
    sessions: buildSessions(normalized, options.userId, source),
    warnings,
    totalRows: rows.length,
    importedRows: normalized.length,
    unmappedExercises: [...unmappedCounts.entries()]
      .map(([name, rowCount]) => ({ name, rowCount }))
      .sort((a, b) => b.rowCount - a.rowCount || a.name.localeCompare(b.name)),
  };
}

function detectSource(headers: string[]): WorkoutImportSource {
  const set = new Set(headers.map((header) => header.toLowerCase()));
  if (set.has('start_time') && set.has('exercise_title') && set.has('set_index')) return 'hevy';
  if (set.has('date') && set.has('workout name') && set.has('exercise name')) return 'strong';
  throw new Error('CSV is not a recognized Hevy or Strong workout export.');
}

function normalizeRow(
  record: Record<string, string>,
  row: number,
  source: WorkoutImportSource,
  options: ImportOptions,
): Omit<NormalizedRow, 'exerciseId'> & { exerciseId: string | null } {
  const hevy = source === 'hevy';
  const title = required(record, hevy ? 'title' : 'Workout Name', row);
  const rawStart = required(record, hevy ? 'start_time' : 'Date', row);
  const start = parseSourceDate(rawStart, source);
  if (!start) throw new InvalidDateError(`Row ${row} has an invalid workout date.`);
  const end = hevy
    ? (parseSourceDate(record.end_time, source) ?? start)
    : addDuration(start, record.Duration);
  const exerciseName = required(record, hevy ? 'exercise_title' : 'Exercise Name', row);
  const customMapping = options.exerciseMappings?.[exerciseName];
  const exerciseId = customMapping
    ? canonicalExerciseId(customMapping)
    : resolveExternalExercise(exerciseName);
  const weightUnit: Units = hevy && 'weight_lbs' in record ? 'lb' : 'kg';
  const rawWeight = hevy ? record[weightUnit === 'lb' ? 'weight_lbs' : 'weight_kg'] : record.Weight;
  const parsedWeight = optionalNumber(rawWeight, 'weight', row);
  const loadKg =
    parsedWeight == null
      ? null
      : inputToKg(parsedWeight, hevy ? weightUnit : options.strongWeightUnit);
  const reps = optionalInteger(record[hevy ? 'reps' : 'Reps'], 'reps', row);
  const durationSeconds = optionalInteger(
    record[hevy ? 'duration_seconds' : 'Seconds'],
    'duration',
    row,
  );
  const rpe = optionalNumber(record[hevy ? 'rpe' : 'RPE'], 'RPE', row);
  const setType = hevy ? record.set_type.toLowerCase() : '';

  return {
    row,
    sessionKey: `${rawStart}\u0000${title}`,
    title,
    start,
    end,
    exerciseName,
    exerciseId,
    setIndex: optionalInteger(record[hevy ? 'set_index' : 'Set Order'], 'set index', row) ?? row,
    kind: setType === 'warmup' ? 'warmup' : setType === 'failure' ? 'failure' : 'working',
    technique: setType === 'drop_set' || setType === 'dropset' ? 'drop_set' : 'standard',
    loadKg: loadKg == null ? null : round(loadKg, 4),
    reps,
    durationSeconds,
    rir: rpe == null ? null : Math.max(0, round(10 - rpe, 1)),
    note: record[hevy ? 'exercise_notes' : 'Notes'] || undefined,
  };
}

function buildSessions(
  rows: NormalizedRow[],
  userId: string,
  source: WorkoutImportSource,
): WorkoutSession[] {
  const groups = groupBy(rows, (row) => row.sessionKey);
  return [...groups.entries()].map(([sessionKey, sessionRows]) => {
    const first = sessionRows[0];
    const sessionId = `import-${source}-${stableHash(sessionKey)}`;
    const exerciseGroups = groupBy(sessionRows, (row) => row.exerciseId);
    const exercises = [...exerciseGroups.entries()].map(([exerciseId, exerciseRows], order) => {
      const sorted = [...exerciseRows].sort((a, b) => a.setIndex - b.setIndex || a.row - b.row);
      const exercise = getExercise(exerciseId)!;
      const working = sorted.filter((row) => row.kind !== 'warmup');
      const repValues = working.map((row) => row.durationSeconds ?? row.reps).filter(isNumber);
      return {
        id: `${sessionId}-exercise-${order + 1}`,
        exerciseId,
        order,
        markedDiscomfort: false,
        markedUnavailable: false,
        note: sorted.map((row) => row.note).find(Boolean),
        prescription: {
          exerciseId,
          order,
          workingSets: working.length,
          minReps: repValues.length ? Math.min(...repValues) : 1,
          maxReps: repValues.length ? Math.max(...repValues) : 1,
          targetRir: working.map((row) => row.rir).find(isNumber) ?? 2,
          restSeconds: 120,
          selectionReason: `Imported from ${source === 'hevy' ? 'Hevy' : 'Strong'}`,
        },
        sets: sorted.map((row, setOrder): PerformedSet => ({
          id: `${sessionId}-exercise-${order + 1}-set-${setOrder + 1}`,
          setNumber: setOrder + 1,
          kind: row.kind,
          loadKg:
            exercise.trackingType === 'bodyweight_reps' || exercise.trackingType === 'time'
              ? null
              : row.loadKg,
          reps: exercise.trackingType === 'time' ? null : row.reps,
          durationSeconds:
            exercise.trackingType === 'time'
              ? (row.durationSeconds ?? row.reps)
              : row.durationSeconds,
          rir: row.rir,
          completed: true,
          skipped: false,
          completedAt: row.end.toISOString(),
          technique: row.technique,
        })),
      };
    });

    return {
      id: sessionId,
      userId,
      programId: null,
      programDayId: null,
      dayName: first.title,
      status: 'completed',
      startedAt: first.start.toISOString(),
      finishedAt: new Date(Math.max(...sessionRows.map((row) => row.end.getTime()))).toISOString(),
      exercises,
      totalPausedSeconds: 0,
      note: `Imported from ${source === 'hevy' ? 'Hevy' : 'Strong'}`,
    };
  });
}

function resolveExternalExercise(name: string): string | null {
  const normalized = normalizeName(name);
  return (
    canonicalExerciseId(name) ??
    EXTERNAL_NAME_OVERRIDES[normalized] ??
    signatureIndex.get(signature(normalized)) ??
    null
  );
}

function buildSignatureIndex(): Map<string, string> {
  const candidates = new Map<string, string | null>();
  for (const exercise of EXERCISE_CATALOG) {
    for (const name of [exercise.name, ...exercise.aliases]) {
      const key = signature(normalizeName(name));
      const existing = candidates.get(key);
      candidates.set(key, existing && existing !== exercise.id ? null : exercise.id);
    }
  }
  return new Map([...candidates].flatMap(([key, id]) => (id ? [[key, id]] : [])));
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bohp\b/g, 'overhead press')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function signature(value: string): string {
  return value.split(/\s+/).filter(Boolean).sort().join(' ');
}

function parseSourceDate(value: string | undefined, source: WorkoutImportSource): Date | null {
  if (!value) return null;
  if (source === 'strong') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match)
      return validLocalDate(
        +match[1],
        +match[2] - 1,
        +match[3],
        +match[4],
        +match[5],
        +(match[6] ?? 0),
      );
  } else {
    const match = value.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}), (\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const month = [
        'jan',
        'feb',
        'mar',
        'apr',
        'may',
        'jun',
        'jul',
        'aug',
        'sep',
        'oct',
        'nov',
        'dec',
      ].indexOf(match[2].toLowerCase());
      if (month >= 0)
        return validLocalDate(+match[3], month, +match[1], +match[4], +match[5], +(match[6] ?? 0));
    }
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function validLocalDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | null {
  const value = new Date(year, month, day, hour, minute, second);
  return value.getFullYear() === year && value.getMonth() === month && value.getDate() === day
    ? value
    : null;
}

function addDuration(start: Date, raw: string | undefined): Date {
  if (!raw) return start;
  const match = raw.match(/^(?:(\d+):)?(\d+)(?::(\d+))?$/);
  if (!match) return start;
  const seconds =
    match[3] == null
      ? +match[1] * 3600 + +match[2] * 60
      : +(match[1] ?? 0) * 3600 + +match[2] * 60 + +match[3];
  return new Date(start.getTime() + seconds * 1000);
}

function required(record: Record<string, string>, key: string, row: number): string {
  const value = record[key]?.trim();
  if (!value) throw new Error(`Row ${row} is missing ${key}.`);
  return value;
}

function optionalNumber(value: string | undefined, label: string, row: number): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`Row ${row} has an invalid ${label}.`);
  return parsed;
}

function optionalInteger(value: string | undefined, label: string, row: number): number | null {
  const parsed = optionalNumber(value, label, row);
  if (parsed == null) return null;
  if (!Number.isInteger(parsed)) throw new Error(`Row ${row} has a non-integer ${label}.`);
  return parsed;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function isNumber(value: number | null): value is number {
  return value != null;
}

class InvalidDateError extends Error {}
