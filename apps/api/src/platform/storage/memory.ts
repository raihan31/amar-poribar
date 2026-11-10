import {
  clampGetExpiry,
  clampPutExpiry,
  type ObjectHead,
  type ObjectStorage,
  type PresignGetOptions,
  type PresignPutOptions,
} from "./storage.js";

interface Stored {
  bytes: Uint8Array;
  contentType: string;
}

export class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, Stored>();

  constructor(
    private readonly bucket = "memory",
    private readonly now: () => number = Date.now,
  ) {}

  async presignPut(key: string, opts: PresignPutOptions): Promise<{ url: string; headers: Record<string, string> }> {
    const exp = this.expiry(clampPutExpiry(opts.expiresSeconds));
    return {
      url: `memory://${this.bucket}/${key}?exp=${exp}`,
      headers: { "Content-Type": opts.contentType },
    };
  }

  async presignGet(key: string, opts: PresignGetOptions): Promise<string> {
    const exp = this.expiry(clampGetExpiry(opts.expiresSeconds));
    const name = opts.downloadName ? `&name=${encodeURIComponent(opts.downloadName)}` : "";
    return `memory://${this.bucket}/${key}?exp=${exp}${name}`;
  }

  async head(key: string): Promise<ObjectHead | null> {
    const o = this.objects.get(key);
    return o ? { bytes: o.bytes.byteLength, contentType: o.contentType } : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async deleteMany(prefix: string): Promise<number> {
    let n = 0;
    for (const k of [...this.objects.keys()]) {
      if (k.startsWith(prefix)) {
        this.objects.delete(k);
        n++;
      }
    }
    return n;
  }

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { bytes: new Uint8Array(body), contentType });
  }

  /** Test helper: simulate a client finishing a presigned upload. */
  __put(key: string, bytes: Uint8Array, contentType = "application/octet-stream"): void {
    this.objects.set(key, { bytes: new Uint8Array(bytes), contentType });
  }

  /** Test helper: read stored bytes. */
  __get(key: string): Uint8Array | undefined {
    return this.objects.get(key)?.bytes;
  }

  private expiry(seconds: number): number {
    return Math.floor(this.now() / 1000) + seconds;
  }
}
