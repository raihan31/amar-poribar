import type { PushResult } from "../infra/push-sender.js";

/** The one identity call cleanup needs; wired to `identity.removeDeviceToken` (T-ID-09). */
export type TokenRemover = (fcmToken: string) => Promise<void>;

/**
 * Removes every token FCM reported as `UNREGISTERED` so we stop sending to dead devices.
 * Removal failures are reported through `onError` and never break delivery.
 */
export async function removeUnregisteredTokens(
  results: readonly PushResult[],
  remove: TokenRemover,
  onError: (err: unknown, token: string) => void = () => {},
): Promise<number> {
  let removed = 0;
  const seen = new Set<string>();
  for (const r of results) {
    if (r.ok || r.error !== "UNREGISTERED" || seen.has(r.token)) continue;
    seen.add(r.token);
    try {
      await remove(r.token);
      removed += 1;
    } catch (err) {
      onError(err, r.token);
    }
  }
  return removed;
}
