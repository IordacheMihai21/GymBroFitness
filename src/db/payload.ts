import { z } from 'zod';

import type { WorkoutTemplate } from '@/domain/programs/templates';
import type { WorkoutSession } from '@/types';

export const PAYLOAD_SCHEMA_VERSION = 1 as const;

export type VersionedPayload<T> = {
  schemaVersion: typeof PAYLOAD_SCHEMA_VERSION;
  data: T;
};

/** Existing installations contain bare objects, so reads accept both shapes. */
export type PersistedPayload<T> = T | VersionedPayload<T>;

export type DecodedPayload<T> =
  | { ok: true; data: T; legacy: boolean }
  | { ok: false; reason: 'invalid_payload' | 'unknown_payload_version' };

const prescriptionSchema = z
  .object({
    exerciseId: z.string().min(1),
    order: z.number().int(),
    workingSets: z.number().int().nonnegative(),
    minReps: z.number().nonnegative(),
    maxReps: z.number().nonnegative(),
    targetRir: z.number(),
    restSeconds: z.number().nonnegative(),
    selectionReason: z.string(),
  })
  .passthrough();

const performedSetSchema = z
  .object({
    id: z.string().min(1),
    setNumber: z.number().int().positive(),
    kind: z.string(),
    loadKg: z.number().nullable(),
    reps: z.number().nullable(),
    durationSeconds: z.number().nullable(),
    rir: z.number().nullable(),
    completed: z.boolean(),
    skipped: z.boolean(),
    completedAt: z.string().nullable(),
  })
  .passthrough();

const programDaySchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    order: z.number().int(),
    focus: z.array(z.string()),
    prescriptions: z.array(prescriptionSchema),
    estimatedMinutes: z.number().nonnegative(),
  })
  .passthrough();

const readinessSchema = z
  .object({
    energy: z.number().int().min(1).max(5),
    sleepQuality: z.number().int().min(1).max(5),
    recovery: z.number().int().min(1).max(5),
    soreness: z.record(z.string(), z.number().int().min(0).max(3)),
    availableMinutes: z.number().positive().optional(),
    hasPain: z.boolean(),
    painNote: z.string().optional(),
  })
  .passthrough();

export const workoutSessionPayloadSchema: z.ZodType<WorkoutSession> = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    programId: z.string().nullable(),
    programDayId: z.string().nullable(),
    dayName: z.string(),
    status: z.enum(['in_progress', 'paused', 'completed', 'discarded']),
    startedAt: z.string(),
    finishedAt: z.string().nullable(),
    exercises: z.array(
      z
        .object({
          id: z.string().min(1),
          exerciseId: z.string().min(1),
          order: z.number().int(),
          prescription: prescriptionSchema,
          sets: z.array(performedSetSchema),
          markedDiscomfort: z.boolean(),
          markedUnavailable: z.boolean(),
        })
        .passthrough(),
    ),
    totalPausedSeconds: z.number().nonnegative(),
    readiness: readinessSchema.optional(),
    pausedAt: z.string().nullable().optional(),
    restTimer: z
      .object({
        endsAt: z.string(),
        durationSeconds: z.number().int().positive(),
      })
      .nullable()
      .optional(),
  })
  .passthrough() as z.ZodType<WorkoutSession>;

export const workoutTemplatePayloadSchema: z.ZodType<WorkoutTemplate> = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    createdAt: z.string(),
    sourceSessionId: z.string(),
    day: programDaySchema,
  })
  .passthrough() as z.ZodType<WorkoutTemplate>;

export function encodePayload<T>(data: T): VersionedPayload<T> {
  return { schemaVersion: PAYLOAD_SCHEMA_VERSION, data };
}

export function decodePayload<T>(value: unknown, schema: z.ZodType<T>): DecodedPayload<T> {
  if (isRecord(value) && 'schemaVersion' in value) {
    if (value.schemaVersion !== PAYLOAD_SCHEMA_VERSION) {
      return { ok: false, reason: 'unknown_payload_version' };
    }
    const result = schema.safeParse(value.data);
    return result.success
      ? { ok: true, data: result.data, legacy: false }
      : { ok: false, reason: 'invalid_payload' };
  }

  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, data: result.data, legacy: true }
    : { ok: false, reason: 'invalid_payload' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
