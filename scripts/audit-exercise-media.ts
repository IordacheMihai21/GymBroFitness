/* eslint-disable no-console -- CLI audit prints its summary. */
/**
 * Exercise library audit: image coverage, data gaps and RepDB upgrade
 * candidates. Run with `npx tsx scripts/audit-exercise-media.ts [repdb.json]`.
 * The optional argument is a local copy of a RepDB exercises.json (any
 * commit); without it only coverage of the current data is reported.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EXERCISE_CATALOG } from '@/domain/exercises/catalog';
import {
  CATALOG_IMAGE_OVERRIDES,
  EXERCISE_LIBRARY,
  REFERENCE_TO_CATALOG_ID,
  exerciseThumbnailUrl,
  preferredLibraryImages,
} from '@/domain/exercises/library';
import repDbMedia from '@/domain/exercises/seed/repdb-media.json';

type RepDbExercise = {
  id: string;
  name_en: string;
  equipment: string;
  images: { flat: Record<string, string> };
};

const media = repDbMedia.media as Record<string, string[]>;
const repDbPath = process.argv[2];
const repDb: RepDbExercise[] = repDbPath
  ? JSON.parse(readFileSync(repDbPath, 'utf8')).exercises
  : [];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  const shared = [...ta].filter((token) => tb.has(token)).length;
  return shared / Math.max(ta.size, tb.size);
}

function bestRepDbMatches(name: string, aliases: string[] = [], limit = 3) {
  return repDb
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name_en,
      score: Math.max(...[name, ...aliases].map((label) => similarity(label, candidate.name_en))),
    }))
    .filter((candidate) => candidate.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// 1. Loggable catalog: where does each exercise's picture come from?
const catalogRows = EXERCISE_CATALOG.map((exercise) => {
  const explicitReference = Object.entries(REFERENCE_TO_CATALOG_ID).find(
    ([, catalogId]) => catalogId === exercise.id,
  )?.[0];
  const source = media[exercise.id]?.length
    ? 'repdb'
    : CATALOG_IMAGE_OVERRIDES[exercise.id]
      ? 'free-exercise-db (override)'
      : explicitReference
        ? 'free-exercise-db (explicit)'
        : exerciseThumbnailUrl(exercise)
          ? 'free-exercise-db (name match)'
          : 'none';
  return {
    id: exercise.id,
    name: exercise.name,
    source,
    thumbnail: exerciseThumbnailUrl(exercise) ?? null,
    repDbCandidates: media[exercise.id]?.length
      ? []
      : bestRepDbMatches(exercise.name, exercise.aliases),
    missingInstructions: exercise.instructions.length === 0,
    missingMistakes: (exercise.commonMistakes ?? []).length === 0,
  };
});

// 2. Reference library (free-exercise-db): image counts and data gaps.
const referenceRows = EXERCISE_LIBRARY.map((reference) => ({
  id: reference.id,
  name: reference.name,
  images: reference.images.length,
  preferred: preferredLibraryImages(reference).length,
  noMuscles: reference.primaryMuscles.length === 0,
  noInstructions: reference.instructions.length === 0,
}));

const nameCounts = new Map<string, number>();
for (const reference of EXERCISE_LIBRARY) {
  const key = normalize(reference.name);
  nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
}

// 3. RepDB exercises we do not use at all, i.e. candidates to add to the catalog.
const usedRepDbFiles = new Set(Object.values(media).flat());
const unusedRepDb = repDb.filter(
  (candidate) => !Object.values(candidate.images.flat).some((file) => usedRepDbFiles.has(file)),
);

const bySource = catalogRows.reduce<Record<string, number>>((total, row) => {
  total[row.source] = (total[row.source] ?? 0) + 1;
  return total;
}, {});

const report = {
  catalog: {
    total: catalogRows.length,
    bySource,
    noImage: catalogRows.filter((row) => row.source === 'none').map((row) => row.name),
    upgradeToRepDb: catalogRows
      .filter((row) => row.source !== 'repdb' && row.repDbCandidates.length > 0)
      .map((row) => ({
        name: row.name,
        id: row.id,
        from: row.source,
        candidates: row.repDbCandidates,
      })),
    missingInstructions: catalogRows
      .filter((row) => row.missingInstructions)
      .map((row) => row.name),
    missingMistakes: catalogRows.filter((row) => row.missingMistakes).map((row) => row.name),
  },
  reference: {
    total: referenceRows.length,
    noImages: referenceRows.filter((row) => row.images === 0).map((row) => row.name),
    singleImage: referenceRows.filter((row) => row.images === 1).length,
    noMuscles: referenceRows.filter((row) => row.noMuscles).map((row) => row.name),
    noInstructions: referenceRows.filter((row) => row.noInstructions).map((row) => row.name),
    duplicateNames: [...nameCounts].filter(([, count]) => count > 1).map(([name]) => name),
  },
  repDb: {
    available: repDb.length,
    usedByCatalog: Object.keys(media).length,
    unused: unusedRepDb.length,
    unusedByEquipment: unusedRepDb.reduce<Record<string, number>>((total, item) => {
      total[item.equipment] = (total[item.equipment] ?? 0) + 1;
      return total;
    }, {}),
    unusedNames: unusedRepDb.map((item) => item.name_en),
  },
  urls: [
    ...new Set([
      ...catalogRows.flatMap((row) => (row.thumbnail ? [row.thumbnail] : [])),
      ...EXERCISE_LIBRARY.flatMap((reference) => preferredLibraryImages(reference)),
    ]),
  ],
};

const out = process.env.AUDIT_OUT ?? join(tmpdir(), 'exercise-media-audit.json');
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      catalog: { total: report.catalog.total, bySource, noImage: report.catalog.noImage.length },
      upgradeCandidates: report.catalog.upgradeToRepDb.length,
      reference: {
        total: report.reference.total,
        noImages: report.reference.noImages.length,
        singleImage: report.reference.singleImage,
        noMuscles: report.reference.noMuscles.length,
        noInstructions: report.reference.noInstructions.length,
        duplicateNames: report.reference.duplicateNames.length,
      },
      repDb: { ...report.repDb, unusedNames: undefined },
      uniqueImageUrls: report.urls.length,
      written: out,
    },
    null,
    2,
  ),
);
