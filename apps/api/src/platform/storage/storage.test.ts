import { describe, expect, it } from "vitest";
import { storageKeys } from "./keys.js";
import { MemoryObjectStorage } from "./memory.js";
import { defineStorageContract } from "./storage.contract.js";

const expOf = (url: string) => Number(new URL(url.replace("memory://", "http://")).searchParams.get("exp"));

describe("memory adapter", () => {
  defineStorageContract(
    () => new MemoryObjectStorage(),
    async (s, key, bytes, ct) => (s as MemoryObjectStorage).__put(key, bytes, ct),
  );

  it("memory adapter round trip", async () => {
    const s = new MemoryObjectStorage("b");
    const put = await s.presignPut("receipt/f1/t1.jpg", {
      contentType: "image/jpeg",
      maxBytes: 100,
      expiresSeconds: 60,
    });
    expect(put.url).toMatch(/^memory:\/\/b\/receipt\/f1\/t1\.jpg\?exp=\d+$/);
    expect(put.headers["Content-Type"]).toBe("image/jpeg");
    s.__put("receipt/f1/t1.jpg", new Uint8Array([9, 9]), "image/jpeg");
    expect(await s.head("receipt/f1/t1.jpg")).toEqual({ bytes: 2, contentType: "image/jpeg" });
    const get = await s.presignGet("receipt/f1/t1.jpg", { expiresSeconds: 60, downloadName: "r.jpg" });
    expect(get).toContain("name=r.jpg");
  });

  it("presign expiry is clamped to 10 minutes for put and 5 for get", async () => {
    const s = new MemoryObjectStorage("b", () => 0);
    const put = await s.presignPut("k", { contentType: "x/y", maxBytes: 1, expiresSeconds: 99999 });
    expect(expOf(put.url)).toBe(600);
    expect(expOf(await s.presignGet("k", { expiresSeconds: 99999 }))).toBe(300);
    expect(expOf(await s.presignGet("k", { expiresSeconds: 0 }))).toBe(1);
  });
});

describe("storage keys", () => {
  it("key helpers never produce paths without an owner id", () => {
    const keys = [
      storageKeys.voice("fam1", "m1"),
      storageKeys.video("fam1", "m1"),
      storageKeys.receipt("fam1", "t1"),
      storageKeys.export("usr1", "r1"),
    ];
    expect(keys).toEqual(["voice/fam1/m1.m4a", "video/fam1/m1.mp4", "receipt/fam1/t1.jpg", "export/usr1/r1.zip"]);
    for (const k of keys) expect(k).toMatch(/^[a-z]+\/(fam1|usr1)\//);
    expect(() => storageKeys.voice("", "m")).toThrow();
    expect(() => storageKeys.receipt("../x", "t")).toThrow();
    expect(() => storageKeys.export("u/v", "r")).toThrow();
  });
});
