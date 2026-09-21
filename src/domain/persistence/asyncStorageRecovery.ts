type RecoveryStorage = {
  setItem(key: string, value: string): Promise<void>;
};

export function recoveryStorageKey(sourceKey: string): string {
  return `${sourceKey}/recovery`;
}

/**
 * Keep the exact original bytes before a fallback or future save can replace
 * an unrecognized payload. The deterministic key makes retries idempotent.
 */
export async function preserveAsyncStoragePayload(
  storage: RecoveryStorage,
  sourceKey: string,
  raw: string,
): Promise<void> {
  await storage.setItem(recoveryStorageKey(sourceKey), raw);
}
