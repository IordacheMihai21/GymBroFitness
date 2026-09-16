import { MAX_KEY_JOINT_INDEX, SKELETON_CONNECTIONS } from '../skeletonConnections';

describe('SKELETON_CONNECTIONS', () => {
  it('only references valid joint indices', () => {
    for (const [a, b] of SKELETON_CONNECTIONS) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(MAX_KEY_JOINT_INDEX);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(MAX_KEY_JOINT_INDEX);
    }
  });

  it('has no self-connections', () => {
    expect(SKELETON_CONNECTIONS.every(([a, b]) => a !== b)).toBe(true);
  });
});
