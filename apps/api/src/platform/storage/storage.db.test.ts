import { beforeAll, describe, expect, it } from "vitest";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { S3ObjectStorage } from "./s3.js";
import { defineStorageContract } from "./storage.contract.js";
import type { ObjectStorage } from "./storage.js";

// Defaults match the compose `minio-test` service; override with STORAGE_TEST_* variables.
const cfg = {
  endpoint: process.env.STORAGE_TEST_ENDPOINT ?? `http://localhost:${process.env.MINIO_TEST_PORT ?? "9100"}`,
  bucket: process.env.STORAGE_TEST_BUCKET ?? "amar-test",
  accessKey: process.env.STORAGE_TEST_ACCESS_KEY ?? "amar",
  secretKey: process.env.STORAGE_TEST_SECRET_KEY ?? "amar-secret",
  region: "us-east-1",
};

const storage = new S3ObjectStorage(cfg);

async function putViaPresign(s: ObjectStorage, key: string, bytes: Uint8Array, contentType: string) {
  const { url, headers } = await s.presignPut(key, { contentType, maxBytes: bytes.length, expiresSeconds: 60 });
  const res = await fetch(url, { method: "PUT", headers, body: Buffer.from(bytes) });
  expect(res.status).toBe(200);
}

describe("s3 adapter (MinIO)", () => {
  beforeAll(async () => {
    const c = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
    });
    try {
      await c.send(new CreateBucketCommand({ Bucket: cfg.bucket }));
    } catch (e) {
      const n = (e as { name?: string }).name;
      if (n !== "BucketAlreadyOwnedByYou" && n !== "BucketAlreadyExists") throw e;
    }
  });

  defineStorageContract(
    () => storage,
    async (s, key, bytes, ct) => s.putObject(key, bytes, ct),
  );

  it("presigned put then head then get works", async () => {
    const key = `receipt/fam-${crypto.randomUUID()}/t1.jpg`;
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    await putViaPresign(storage, key, bytes, "image/jpeg");
    expect(await storage.head(key)).toEqual({ bytes: 5, contentType: "image/jpeg" });
    const url = await storage.presignGet(key, { expiresSeconds: 60, downloadName: "রশিদ.jpg" });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    await storage.delete(key);
  });
});
