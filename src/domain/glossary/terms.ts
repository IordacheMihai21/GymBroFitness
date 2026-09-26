export type GlossaryTermKey = 'rir' | 'e1rm' | 'volumeLandmarks' | 'rom' | 'tempo';

export type GlossaryTerm = {
  label: string;
  definition: string;
};

export const GLOSSARY_TERMS: Readonly<Record<GlossaryTermKey, GlossaryTerm>> = {
  rir: {
    label: 'RIR — Reps in Reserve',
    definition:
      'How many more reps you could have done before failure. RIR 2 means you stopped a set with about 2 good reps left in the tank.',
  },
  e1rm: {
    label: 'e1RM — Estimated one-rep max',
    definition:
      "The heaviest single lift your recent sets suggest you could do, calculated from the weight and reps you logged — not a weight you've actually attempted.",
  },
  volumeLandmarks: {
    label: 'Volume landmarks (MEV / MAV / MRV)',
    definition:
      'General weekly set-count references for a muscle group: MEV is the minimum that still grows it, MAV is the range with the best return, and MRV is the most a typical lifter can recover from before doing more starts working against them. Starting points for autoregulation, not personal limits.',
  },
  rom: {
    label: 'ROM — Range of Motion',
    definition:
      'How fully you moved through the exercise, scored 0–100. Moving through a full stretch-to-contraction range scores highest.',
  },
  tempo: {
    label: 'Tempo',
    definition:
      'How controlled your rep speed was, scored 0–100. Steady, deliberate reps score higher than fast or bouncy ones.',
  },
};

export function glossaryTerm(key: GlossaryTermKey): GlossaryTerm {
  return GLOSSARY_TERMS[key];
}
