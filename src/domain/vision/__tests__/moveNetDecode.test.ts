import { decodeMoveNetOutput, MOVENET_KEYPOINT_COUNT } from '../moveNetDecode';

function buildRawOutput(entries: [y: number, x: number, confidence: number][]): number[] {
  return entries.flat();
}

describe('decodeMoveNetOutput', () => {
  it('produces exactly 17 landmarks', () => {
    const raw = buildRawOutput(Array.from({ length: MOVENET_KEYPOINT_COUNT }, () => [0.1, 0.2, 0.9]));
    expect(decodeMoveNetOutput(raw)).toHaveLength(17);
  });

  it('swaps MoveNet y-first ordering into this app x-first Landmark shape', () => {
    const raw = buildRawOutput([
      [0.25, 0.75, 0.95], // nose: y=0.25, x=0.75, confidence=0.95
      ...Array.from({ length: 16 }, () => [0, 0, 0] as [number, number, number]),
    ]);
    const landmarks = decodeMoveNetOutput(raw);
    expect(landmarks[0]).toEqual({ x: 0.75, y: 0.25, z: 0, visibility: 0.95 });
  });

  it('reads each keypoint from its own 3-value slice, not overlapping neighbors', () => {
    const raw = buildRawOutput([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
      ...Array.from({ length: 15 }, () => [0, 0, 0] as [number, number, number]),
    ]);
    const landmarks = decodeMoveNetOutput(raw);
    expect(landmarks[1]).toEqual({ x: 0.5, y: 0.4, z: 0, visibility: 0.6 });
  });

  it('always sets z to 0 (MoveNet is a 2D-only model)', () => {
    const raw = buildRawOutput(Array.from({ length: MOVENET_KEYPOINT_COUNT }, () => [0.5, 0.5, 1]));
    expect(decodeMoveNetOutput(raw).every((l) => l.z === 0)).toBe(true);
  });
});
