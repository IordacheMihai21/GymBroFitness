// One-time importer: pulls the public-domain free-exercise-db dataset and
// converts it into the app's LibraryExercise shape. Re-run manually if the
// upstream dataset changes; output is committed as a static seed file.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const OUTPUT_PATH = path.join(__dirname, '../src/domain/exercises/seed/library.json');

const MUSCLE_MAP = {
  abdominals: 'abs',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'back',
  'lower back': 'lower_back',
  'middle back': 'back',
  quadriceps: 'quadriceps',
  shoulders: 'shoulders',
  traps: 'back',
  triceps: 'triceps',
  // No equivalent in our MuscleGroup enum — intentionally dropped rather
  // than mapped to a misleading nearby group: neck, abductors, adductors.
};

const EQUIPMENT_LABELS = {
  bands: 'Resistance band',
  barbell: 'Barbell',
  'body only': 'Bodyweight',
  cable: 'Cable machine',
  dumbbell: 'Dumbbell',
  'e-z curl bar': 'EZ bar',
  'exercise ball': 'Exercise ball',
  'foam roll': 'Foam roller',
  kettlebells: 'Kettlebell',
  machine: 'Machine',
  'medicine ball': 'Medicine ball',
  other: 'Other',
};

function mapMuscles(list) {
  const seen = new Set();
  for (const raw of list ?? []) {
    const mapped = MUSCLE_MAP[raw];
    if (mapped) seen.add(mapped);
  }
  return [...seen];
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const raw = await res.json();

  let skippedNoMuscle = 0;
  const library = [];

  for (const entry of raw) {
    const primaryMuscles = mapMuscles(entry.primaryMuscles);
    if (primaryMuscles.length === 0) {
      skippedNoMuscle += 1;
      continue;
    }
    library.push({
      id: entry.id,
      name: entry.name,
      primaryMuscles,
      secondaryMuscles: mapMuscles(entry.secondaryMuscles),
      equipmentLabel: EQUIPMENT_LABELS[entry.equipment ?? ''] ?? 'Other',
      category: entry.category,
      level: entry.level,
      mechanic: entry.mechanic,
      instructions: entry.instructions ?? [],
      images: (entry.images ?? []).map((img) => `${IMAGE_BASE}/${img}`),
    });
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(library, null, 2));

  console.log(`Imported ${library.length} exercises (skipped ${skippedNoMuscle} with no mappable muscle).`);
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
