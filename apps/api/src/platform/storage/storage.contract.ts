import { expect, it } from "vitest";
import type { ObjectStorage } from "./storage.js";

/** Behaviour every adapter must satisfy; run against memory and MinIO. */
export function defineStorageContract(
  make: () => ObjectStorage,
  put: (s: ObjectStorage, key: string, bytes: Uint8Array, contentType: string) => Promise<void>,
): void {
  it("round trip: put, head, delete, deleteMany", async () => {
    const s = make();
    const p = `contract/${crypto.randomUUID()}/`;
    await put(s, `${p}a.bin`, new Uint8Array([1, 2, 3]), "application/octet-stream");
    await s.putObject(`${p}b.txt`, new TextEncoder().encode("hi"), "text/plain");
    expect(await s.head(`${p}a.bin`)).toEqual({ bytes: 3, contentType: "application/octet-stream" });
    expect((await s.head(`${p}b.txt`))?.bytes).toBe(2);
    await s.delete(`${p}a.bin`);
    expect(await s.head(`${p}a.bin`)).toBeNull();
    expect(await s.deleteMany(p)).toBe(1);
    expect(await s.head(`${p}b.txt`)).toBeNull();
  });

  it("head returns null for missing", async () => {
    expect(await make().head(`contract/${crypto.randomUUID()}/missing`)).toBeNull();
  });
}
