/** Object storage port (DEC-07). Adapters: s3.ts (S3/MinIO) and memory.ts (tests). */

export const MAX_PUT_EXPIRES_SECONDS = 600;
export const MAX_GET_EXPIRES_SECONDS = 300;

export interface PresignPutOptions {
  contentType: string;
  maxBytes: number;
  expiresSeconds: number;
}

export interface PresignGetOptions {
  expiresSeconds: number;
  downloadName?: string;
}

export interface ObjectHead {
  bytes: number;
  contentType: string;
}

export interface ObjectStorage {
  /**
   * Short-lived upload URL. Size limits cannot be enforced by every backend, so callers must
   * always call `head` on confirm and reject objects larger than `maxBytes`.
   */
  presignPut(key: string, opts: PresignPutOptions): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(key: string, opts: PresignGetOptions): Promise<string>;
  head(key: string): Promise<ObjectHead | null>;
  delete(key: string): Promise<void>;
  /** Deletes every object whose key starts with `prefix`; returns the number removed. */
  deleteMany(prefix: string): Promise<number>;
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
}

export function clampPutExpiry(seconds: number): number {
  return clamp(seconds, MAX_PUT_EXPIRES_SECONDS);
}

export function clampGetExpiry(seconds: number): number {
  return clamp(seconds, MAX_GET_EXPIRES_SECONDS);
}

function clamp(seconds: number, max: number): number {
  const s = Math.floor(seconds);
  if (!Number.isFinite(s) || s < 1) return 1;
  return Math.min(s, max);
}
