import { KEY_JOINT_NAMES } from './landmarks';

/** Bone connections for drawing a skeleton overlay, as index pairs into the 17-point COCO/KEY_JOINT_NAMES order. */
export const SKELETON_CONNECTIONS: [number, number][] = [
  [5, 6], // shoulder - shoulder
  [5, 7],
  [7, 9], // left shoulder - elbow - wrist
  [6, 8],
  [8, 10], // right shoulder - elbow - wrist
  [5, 11],
  [6, 12], // shoulders - hips
  [11, 12], // hip - hip
  [11, 13],
  [13, 15], // left hip - knee - ankle
  [12, 14],
  [14, 16], // right hip - knee - ankle
];

export const MAX_KEY_JOINT_INDEX = KEY_JOINT_NAMES.length - 1;
