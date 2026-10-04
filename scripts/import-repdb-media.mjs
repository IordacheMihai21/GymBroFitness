// One-time importer for the RepDB free-tier visual demonstrations used by the
// curated GymBroFitness catalog. The app keeps its own exercise metadata and
// only records reviewed start/peak image paths from the pinned upstream data.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPDB_COMMIT = '9ed9357f09c7566ea0256c57ebd6374ebb8b575e';
const DATA_URL = `https://raw.githubusercontent.com/RepDB/exercise-dataset/${REPDB_COMMIT}/exercises.json`;
const OUTPUT = new URL('../src/domain/exercises/seed/repdb-media.json', import.meta.url);
const SEED_DIRECTORY = new URL('../src/domain/exercises/seed/', import.meta.url);

// Reviewed naming differences where the movements are visually equivalent.
const REVIEWED_OVERRIDES = {
  'dumbbell-curl': 'bicep-curl',
  'triceps-pushdown': 'tricep-pushdown',
  'overhead-triceps-extension': 'overhead-tricep-extension',
  'triceps-dip': 'dips',
  'bench-dip': 'bench-dips',
  'diamond-push-up': 'diamond-push-ups',
  'chin-up': 'chin-ups',
  'band-assisted-pull-up': 'band-assisted-pull-ups',
  'dumbbell-row': 'single-arm-db-row',
  'reverse-crunch': 'reverse-crunches',
  'pallof-press': 'cable-pallof-press',
  'incline-barbell-press': 'incline-bench-press',
  'deficit-push-up': 'deficit-push-ups',
  dip: 'weighted-dips',
  'machine-hip-thrust': 'smith-machine-hip-thrust',
  'step-up': 'step-ups',
  'pike-push-up': 'pike-push-ups',
  'machine-lateral-raise': 'plate-loaded-lateral-raise',
  'reverse-fly': 'dumbbell-reverse-fly',
  // Reviewed 2026-10-04 in the library audit (scripts/audit-exercise-media.ts).
  'incline-smith-machine-bench-press': 'smith-machine-incline-bench-press',
  'lower-back-machine': 'machine-back-extension',
  'machine-crunch': 'machine-seated-crunch',
  'close-grip-machine-row': 'seated-cable-row',
  'independent-arm-lat-pulldown': 'lat-pulldown',
  'weighted-push-up': 'push-up',
  'band-pushdown': 'tricep-pushdown',
  'slider-leg-curl': 'ball-leg-curl',
};

// Reference-library entries (free-exercise-db) whose RepDB twin has the same
// name: shown with the RepDB illustration so the browser has one visual style.
// Exact normalized-name matches only; anything fuzzier stays a photo.
const LIBRARY_DATA = new URL('../src/domain/exercises/seed/library.json', import.meta.url);

const response = await fetch(DATA_URL);
if (!response.ok) throw new Error(`RepDB download failed: ${response.status}`);
const upstream = await response.json();
const byId = new Map(upstream.exercises.map((exercise) => [exercise.id, exercise]));
const byName = new Map(
  upstream.exercises.map((exercise) => [normalize(exercise.name_en), exercise]),
);

const catalogEntries = [];
for (const filename of await readdir(SEED_DIRECTORY)) {
  if (!filename.endsWith('.ts')) continue;
  const source = await readFile(new URL(filename, SEED_DIRECTORY), 'utf8');
  const entryPattern = /slug:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'/g;
  for (const match of source.matchAll(entryPattern)) {
    catalogEntries.push({ slug: match[1], name: match[2] });
  }
}

const media = {};
for (const entry of catalogEntries) {
  const upstreamId = REVIEWED_OVERRIDES[entry.slug] ?? entry.slug;
  const match = byId.get(upstreamId) ?? byName.get(normalize(entry.name));
  if (!match) continue;
  media[entry.slug] = Object.values(match.images.flat);
}

const library = JSON.parse(await readFile(LIBRARY_DATA, 'utf8'));
const byTwinName = new Map();
for (const exercise of upstream.exercises) {
  byTwinName.set(twinKey(exercise.name_en), exercise);
  if (!byTwinName.has(twinKey(exercise.id))) byTwinName.set(twinKey(exercise.id), exercise);
}
const references = {};
for (const reference of library) {
  const twin = byTwinName.get(twinKey(reference.name));
  if (twin) references[reference.id] = Object.values(twin.images.flat);
}

const output = {
  source: 'https://github.com/RepDB/exercise-dataset',
  commit: REPDB_COMMIT,
  media,
  references,
};
await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Mapped RepDB demonstrations for ${Object.keys(media).length} catalog exercises and ${Object.keys(references).length} reference entries.`,
);

function twinKey(value) {
  return value
    .toLowerCase()
    .replace(/dumbbell/g, 'db')
    .replace(/barbell/g, 'bb')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word))
    .join(' ');
}

function normalize(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
