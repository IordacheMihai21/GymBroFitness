import { decodeMediaPipePose, type MediaPipeLandmark } from '../mediaPipeDecode';
import { KEY_JOINT_NAMES } from '../landmarks';

describe('MediaPipe pose decode', () => {
  it('maps the 33-point pose to GymBro anatomical joint order', () => {
    const pose: MediaPipeLandmark[] = Array.from({ length: 33 }, (_, index) => ({
      x: index / 100,
      y: index / 100 + 0.001,
      z: -index,
      visibility: 0.9,
    }));

    const decoded = decodeMediaPipePose(pose);

    expect(decoded).toHaveLength(KEY_JOINT_NAMES.length);
    expect(decoded?.[0].x).toBe(0); // nose: MediaPipe 0
    expect(decoded?.[5].x).toBe(0.11); // left shoulder: MediaPipe 11
    expect(decoded?.[6].x).toBe(0.12); // right shoulder: MediaPipe 12
    expect(decoded?.[15].x).toBe(0.27); // left ankle: MediaPipe 27
    expect(decoded?.[16].x).toBe(0.28); // right ankle: MediaPipe 28
  });

  it('rejects incomplete native output and defaults missing visibility to zero', () => {
    expect(decodeMediaPipePose([])).toBeNull();
    const pose: MediaPipeLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
    expect(decodeMediaPipePose(pose)?.[0].visibility).toBe(0);
  });
});
