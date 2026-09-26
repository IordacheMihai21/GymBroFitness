import { getSupabaseClient } from '../client';
import {
  deleteOwnAccount,
  getCurrentSession,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  subscribeToAuthChanges,
} from '../auth';

jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetClient = getSupabaseClient as jest.Mock;

function fakeSession(email = 'lifter@example.com') {
  return { user: { email }, access_token: 'token' };
}

describe('supabase auth wrappers', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('throws a clear error from signUpWithEmail when sync is not configured', async () => {
    mockedGetClient.mockReturnValue(null);
    await expect(signUpWithEmail('a@b.com', 'password1')).rejects.toThrow(
      'Sync is not configured',
    );
  });

  it('throws a clear error from signInWithEmail when sync is not configured', async () => {
    mockedGetClient.mockReturnValue(null);
    await expect(signInWithEmail('a@b.com', 'password1')).rejects.toThrow(
      'Sync is not configured',
    );
  });

  it('returns the new session from signUpWithEmail on success', async () => {
    const session = fakeSession();
    mockedGetClient.mockReturnValue({
      auth: { signUp: jest.fn().mockResolvedValue({ data: { session }, error: null }) },
    });
    await expect(signUpWithEmail('a@b.com', 'password1')).resolves.toEqual({ session });
  });

  it('returns null session from signUpWithEmail when email confirmation is required', async () => {
    mockedGetClient.mockReturnValue({
      auth: {
        signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    });
    await expect(signUpWithEmail('a@b.com', 'password1')).resolves.toEqual({ session: null });
  });

  it('rejects with the underlying error from signInWithEmail on failure', async () => {
    const authError = new Error('Invalid login credentials');
    mockedGetClient.mockReturnValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: authError }),
      },
    });
    await expect(signInWithEmail('a@b.com', 'wrong')).rejects.toThrow(
      'Invalid login credentials',
    );
  });

  it('resolves signOut as a no-op when sync is not configured', async () => {
    mockedGetClient.mockReturnValue(null);
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('throws a clear error from deleteOwnAccount when sync is not configured', async () => {
    mockedGetClient.mockReturnValue(null);
    await expect(deleteOwnAccount()).rejects.toThrow('Sync is not configured');
  });

  it('calls the delete_own_account RPC and resolves on success', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    mockedGetClient.mockReturnValue({ rpc });
    await expect(deleteOwnAccount()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('delete_own_account');
  });

  it('rejects with the underlying error from deleteOwnAccount on failure', async () => {
    const rpcError = new Error('permission denied');
    const rpc = jest.fn().mockResolvedValue({ error: rpcError });
    mockedGetClient.mockReturnValue({ rpc });
    await expect(deleteOwnAccount()).rejects.toThrow('permission denied');
  });

  it('returns null from getCurrentSession when sync is not configured', async () => {
    mockedGetClient.mockReturnValue(null);
    await expect(getCurrentSession()).resolves.toBeNull();
  });

  it('returns a no-op unsubscribe from subscribeToAuthChanges when sync is not configured', () => {
    mockedGetClient.mockReturnValue(null);
    const unsubscribe = subscribeToAuthChanges(jest.fn());
    expect(() => unsubscribe()).not.toThrow();
  });

  it('forwards auth state changes to the callback', () => {
    const unsubscribeSpy = jest.fn();
    let capturedCallback: ((event: unknown, session: unknown) => void) | undefined;
    mockedGetClient.mockReturnValue({
      auth: {
        onAuthStateChange: jest.fn((cb) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: unsubscribeSpy } } };
        }),
      },
    });

    const onChange = jest.fn();
    const unsubscribe = subscribeToAuthChanges(onChange);
    const session = fakeSession();
    capturedCallback?.('SIGNED_IN', session);

    expect(onChange).toHaveBeenCalledWith(session);
    unsubscribe();
    expect(unsubscribeSpy).toHaveBeenCalled();
  });
});
