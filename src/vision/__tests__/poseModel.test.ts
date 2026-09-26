import { describePoseModelError } from '../poseModelErrors';

describe('pose model error copy', () => {
  it('explains development-server failures and the recovery action', () => {
    expect(describePoseModelError(new Error('Network request failed'), true)).toContain(
      'connected to Metro',
    );
  });

  it('does not mention Metro in a production build', () => {
    const message = describePoseModelError(new Error('Failed to connect'), false);
    expect(message).toContain('on-device model file');
    expect(message).not.toContain('Metro');
  });

  it('distinguishes a missing native module from a transient load failure', () => {
    expect(describePoseModelError(new Error('Nitro native module missing'), false)).toContain(
      'latest native build',
    );
  });
});
