// Builds the extended, loggable exercise catalog from the RepDB free tier.
//
// RepDB's free license allows in-app use with attribution but forbids
// republishing the data as a dataset, and this repository is public. So the
// output is generated at install time and git-ignored: the data ships inside
// the app, never in the repo. If the download fails (offline install), an
// empty catalog is written so the app still builds with the curated set.
//
// Usage: node scripts/import-repdb-catalog.mjs
import { readFile, readdir, writeFile } from 'node:fs/promises';

const REPDB_COMMIT = '9ed9357f09c7566ea0256c57ebd6374ebb8b575e';
const DATA_URL = `https://raw.githubusercontent.com/RepDB/exercise-dataset/${REPDB_COMMIT}/exercises.json`;
const OUTPUT = new URL(
  '../src/domain/exercises/seed/repdb-catalog.generated.json',
  import.meta.url,
);
const MEDIA = new URL('../src/domain/exercises/seed/repdb-media.json', import.meta.url);
const SEED_DIRECTORY = new URL('../src/domain/exercises/seed/', import.meta.url);

const MUSCLES = {
  pectoralis_major: 'chest',
  serratus_anterior: 'chest',
  latissimus_dorsi: 'back',
  rhomboids: 'back',
  trapezius: 'back',
  anterior_deltoid: 'shoulders',
  lateral_deltoid: 'shoulders',
  posterior_deltoid: 'shoulders',
  supraspinatus: 'shoulders',
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  triceps_brachii: 'triceps',
  brachioradialis: 'forearms',
  forearm_flexors: 'forearms',
  forearm_extensors: 'forearms',
  forearms: 'forearms',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstrings',
  gluteus_maximus: 'glutes',
  gluteus_medius: 'glutes',
  abductors: 'glutes',
  gastrocnemius: 'calves',
  soleus: 'calves',
  rectus_abdominis: 'abs',
  obliques: 'abs',
  transverse_abdominis: 'abs',
  erector_spinae: 'lower_back',
  quadratus_lumborum: 'lower_back',
};

// Equipment we can represent; anything else (rings, sleds, suspension
// trainers, stability balls) is left out rather than mislabelled.
const EQUIPMENT = {
  none: ['bodyweight'],
  barbell: ['barbell'],
  trap_bar: ['barbell'],
  dumbbell: ['dumbbell'],
  kettlebell: ['kettlebell'],
  cable: ['cable_machine'],
  lat_pulldown_machine: ['cable_machine'],
  ez_bar: ['ez_bar'],
  smith_machine: ['smith_machine'],
  pull_up_bar: ['pull_up_bar'],
  dip_station: ['dip_station'],
  loop_band: ['resistance_band'],
  resistance_band: ['resistance_band'],
  leg_press: ['leg_press'],
  hack_squat: ['hack_squat'],
  leg_curl: ['selectorized_machine'],
  leg_extension: ['selectorized_machine'],
  standing_calf_raise_machine: ['selectorized_machine', 'plate_loaded_machine'],
  seated_calf_raise_machine: ['selectorized_machine', 'plate_loaded_machine'],
  donkey_calf_raise_machine: ['plate_loaded_machine'],
  shoulder_press_machine: ['selectorized_machine', 'plate_loaded_machine'],
  chest_press_machine: ['selectorized_machine', 'plate_loaded_machine'],
  chest_fly_machine: ['selectorized_machine'],
  pec_deck: ['selectorized_machine'],
  plate_loaded_lateral_raise_machine: ['plate_loaded_machine'],
  dip_machine: ['selectorized_machine'],
  assisted_pullup_machine: ['selectorized_machine'],
  hip_abduction_machine: ['selectorized_machine'],
  hip_adduction_machine: ['selectorized_machine'],
  back_extension_machine: ['selectorized_machine', 'bodyweight'],
  bicep_curl_machine: ['selectorized_machine'],
  preacher_curl_machine: ['selectorized_machine'],
  tricep_extension_machine: ['selectorized_machine'],
  ab_crunch_machine: ['selectorized_machine'],
  hip_thrust_machine: ['plate_loaded_machine'],
  shrug_machine: ['plate_loaded_machine'],
  glute_ham_developer: ['bodyweight'],
  ab_wheel: ['bodyweight'],
};

// Ordered: the first rule whose words appear in the name wins.
const PATTERNS = [
  [/calf/, 'calf_raise'],
  [/leg curl|hamstring curl|nordic|glute ham/, 'knee_flexion'],
  [/leg extension|terminal knee/, 'knee_extension'],
  [/back extension|hyperextension|reverse hyper/, 'hip_hinge'],
  [
    /pushdown|skull|triceps? extension|kickback|jm press|tate press|french press/,
    'elbow_extension',
  ],
  [/curl/, 'elbow_flexion'],
  [/lateral raise|upright row|y raise|lu raise/, 'shoulder_abduction'],
  [/front raise/, 'shoulder_flexion'],
  [/rear delt|reverse fly|face pull|pull apart/, 'rear_delt'],
  [/pullover/, 'pullover'],
  [/fly|crossover|pec deck/, 'chest_fly'],
  [/pulldown|pull up|pull-up|chin up|chin-up|muscle up/, 'vertical_pull'],
  [/row|shrug/, 'horizontal_pull'],
  [
    /overhead press|shoulder press|military|arnold|push press|jerk|landmine press|z press|pike push|handstand/,
    'vertical_push',
  ],
  [
    /bench press|chest press|floor press|push up|push-up|pushup|dip|svend|squeeze press/,
    'horizontal_push',
  ],
  [/hip thrust|glute bridge|bridge|kickback|frog pump/, 'hip_thrust'],
  [/lunge|split squat|step up|step-up|pistol/, 'lunge'],
  [/squat|leg press|wall sit/, 'squat'],
  [/deadlift|rdl|good morning|swing|pull through|clean|snatch|hinge/, 'hip_hinge'],
  [/pallof|woodchop|wood chop|twist|windmill|suitcase|side plank/, 'anti_rotation'],
  [/plank|rollout|roll out|dead bug|hollow|bird dog|ab wheel/, 'anti_extension'],
  [
    /crunch|sit up|sit-up|leg raise|knee raise|v up|v-up|toes to bar|flutter|scissor|jackknife|tuck/,
    'ab_flexion',
  ],
  [/carry|walk/, 'anti_rotation'],
];

const HOLDS = /plank|hold|hang|wall sit|l sit|l-sit|hollow|carry/;

// Movements that do not build muscle through progressive overload of a target
// muscle: loaded carries, ballistic kettlebell and Olympic-style lifts, static
// holds and rotation drills. Logging them as hypertrophy sets would inflate the
// weekly volume the app compares against MEV/MAV/MRV, so they are left out.
const LOW_HYPERTROPHY =
  /carry|farmer|\bwalk\b|swing|clean|snatch|jerk|thruster|burpee|crawl|windmill|twist|turkish|get-up|getup|plank|hold|wall sit|bird dog|dead bug|hollow|downward dog/;

// The one muscle each movement pattern trains directly, matching the curated
// catalog's convention of a single primary muscle per exercise.
const MAIN_MUSCLE = {
  horizontal_push: 'chest',
  vertical_push: 'shoulders',
  horizontal_pull: 'back',
  vertical_pull: 'back',
  pullover: 'back',
  squat: 'quadriceps',
  lunge: 'quadriceps',
  hip_hinge: 'hamstrings',
  hip_thrust: 'glutes',
  knee_flexion: 'hamstrings',
  knee_extension: 'quadriceps',
  calf_raise: 'calves',
  elbow_flexion: 'biceps',
  elbow_extension: 'triceps',
  shoulder_abduction: 'shoulders',
  shoulder_flexion: 'shoulders',
  rear_delt: 'shoulders',
  chest_fly: 'chest',
  ab_flexion: 'abs',
  anti_extension: 'abs',
  anti_rotation: 'abs',
};

const media = JSON.parse(await readFile(MEDIA, 'utf8'));
const usedFiles = new Set(Object.values(media.media).flat());

const curatedNames = new Set();
for (const filename of await readdir(SEED_DIRECTORY)) {
  if (!filename.endsWith('.ts')) continue;
  const source = await readFile(new URL(filename, SEED_DIRECTORY), 'utf8');
  for (const match of source.matchAll(/slug:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'/g)) {
    curatedNames.add(normalize(match[1]));
    curatedNames.add(normalize(match[2]));
  }
}

let upstream;
try {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`status ${response.status}`);
  upstream = await response.json();
} catch (error) {
  console.warn(`RepDB download failed (${error.message}); writing an empty extended catalog.`);
  await writeFile(OUTPUT, '{"exercises":[]}\n');
  process.exit(0);
}

const skipped = {
  category: 0,
  equipment: 0,
  muscles: 0,
  pattern: 0,
  duplicate: 0,
  lowHypertrophy: 0,
};
const exercises = [];
for (const item of upstream.exercises) {
  if (item.category !== 'strength') {
    skipped.category += 1;
    continue;
  }
  const images = Object.values(item.images.flat);
  if (images.some((file) => usedFiles.has(file)) || curatedNames.has(normalize(item.name_en))) {
    skipped.duplicate += 1;
    continue;
  }
  const mapped = EQUIPMENT[item.equipment ?? 'none'];
  if (!mapped) {
    skipped.equipment += 1;
    continue;
  }
  const primary = unique((item.primary_muscles ?? []).map((muscle) => MUSCLES[muscle]));
  const secondary = unique((item.secondary_muscles ?? []).map((muscle) => MUSCLES[muscle])).filter(
    (muscle) => !primary.includes(muscle),
  );
  if (primary.length === 0) {
    skipped.muscles += 1;
    continue;
  }
  const name = item.name_en.toLowerCase();
  if (LOW_HYPERTROPHY.test(name)) {
    skipped.lowHypertrophy += 1;
    continue;
  }
  if (/chin tuck|neck|heel-to-toe|heel to toe/.test(name)) {
    skipped.pattern += 1;
    continue;
  }
  let pattern = PATTERNS.find(([test]) => test.test(name))?.[1];
  // "Kickback" is a triceps move unless the glutes are doing the work.
  if (pattern === 'elbow_extension' && primary.includes('glutes')) pattern = 'hip_thrust';
  if (!pattern) {
    skipped.pattern += 1;
    continue;
  }
  // Direct volume goes to one muscle; the rest are indirect exposure.
  const preferred = /wrist/.test(name) ? 'forearms' : MAIN_MUSCLE[pattern];
  const main = primary.includes(preferred) ? preferred : primary[0];
  const others = unique([...primary.filter((muscle) => muscle !== main), ...secondary]);
  const isHold = HOLDS.test(name);
  const equipment = withSupports(mapped, name);
  const repsOnly =
    item.is_bodyweight ||
    ['bodyweight', 'pull_up_bar', 'dip_station', 'resistance_band'].includes(mapped[0]);
  exercises.push({
    id: `repdb-${item.id}`,
    slug: `repdb-${item.id}`,
    name: item.name_en,
    aliases: [],
    description: item.description_en,
    primaryMuscles: [main],
    secondaryMuscles: others,
    equipment,
    movementPattern: pattern,
    difficulty:
      item.difficulty === 'advanced'
        ? 'advanced'
        : item.difficulty === 'beginner'
          ? 'beginner'
          : 'intermediate',
    exerciseType: item.mechanic === 'isolation' ? 'isolation' : 'compound',
    laterality: item.is_unilateral ? 'unilateral' : 'bilateral',
    trackingType: isHold ? 'time' : repsOnly ? 'bodyweight_reps' : 'weight_reps',
    instructions: item.instructions_en ?? [],
    commonMistakes: [],
    scienceExplanation: (item.tips_en ?? []).join(' '),
    progressionInstructions: isHold
      ? 'Add a few seconds once every hold is steady.'
      : 'Add reps within your range, then add the smallest load step.',
    easierAlternatives: [],
    harderAlternatives: [],
    equivalentAlternatives: [],
    images,
  });
}

exercises.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(
  OUTPUT,
  `${JSON.stringify({ commit: REPDB_COMMIT, base: `https://raw.githubusercontent.com/RepDB/exercise-dataset/${REPDB_COMMIT}/`, exercises })}\n`,
);
console.log(
  `RepDB extended catalog: ${exercises.length} exercises. Skipped: ${JSON.stringify(skipped)}`,
);

/** Benches and racks are required supports in the availability check, so add them when the name implies one. */
function withSupports(equipment, name) {
  const free = equipment.some((item) =>
    ['barbell', 'dumbbell', 'kettlebell', 'ez_bar'].includes(item),
  );
  const supports = [];
  if (free && /incline/.test(name) && /press|fly|row|curl/.test(name))
    supports.push('incline_bench');
  else if (
    free &&
    /bench press|floor press|chest supported|seated|lying|skull|pullover|fly/.test(name) &&
    !/floor/.test(name)
  )
    supports.push('bench');
  if (
    equipment.includes('barbell') &&
    /squat|overhead press|military/.test(name) &&
    !/split|goblet/.test(name)
  )
    supports.push('squat_rack');
  return [...equipment, ...supports];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalize(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
