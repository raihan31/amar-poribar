import { Writable } from "node:stream";
import Fastify from "fastify";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createLogger, createLoggerOptions, installRequestContext, requestOptions } from "./logger.js";
import { getContext, runWithContext } from "./request-context.js";

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      for (const l of String(chunk).split("\n").filter(Boolean)) lines.push(JSON.parse(l));
      cb();
    },
  });
  return { lines, stream };
}

function appWith(stream: Writable) {
  const app = Fastify({
    loggerInstance: createLogger({ level: "info" }, stream),
    ...requestOptions,
  });
  installRequestContext(app);
  return app;
}

describe("logger", () => {
  it("redacts authorization header and tokens", () => {
    const { lines, stream } = capture();
    const log = pino(createLoggerOptions({ level: "info" }), stream);
    log.info(
      {
        req: { headers: { authorization: "Bearer abc", cookie: "s=1" } },
        auth: { token: "tok1", refreshToken: "ref1" },
      },
      "x",
    );
    const out = JSON.stringify(lines[0]);
    expect(out).not.toContain("Bearer abc");
    expect(out).not.toContain("tok1");
    expect(out).not.toContain("ref1");
    expect(out).not.toContain("s=1");
    expect(out).toContain("[redacted]");
  });

  it("masks phone numbers inside free text", () => {
    const { lines, stream } = capture();
    const log = pino(createLoggerOptions({ level: "info" }), stream);
    log.info(
      { phone: "+8801712345678", note: "call 01712345678 now", detail: "+8801712345678" },
      "sent to 01812345999",
    );
    const l = lines[0]!;
    expect(l.phone).toBe("•••678");
    expect(l.note).toBe("call •••678 now");
    expect(l.detail).toBe("•••678");
    expect(l.msg).toBe("sent to •••999");
  });

  it("echoes a valid x-request-id and replaces an invalid one", async () => {
    const { stream } = capture();
    const app = appWith(stream);
    app.get("/ping", async () => ({ ok: true }));
    const ok = await app.inject({ method: "GET", url: "/ping", headers: { "x-request-id": "abc-12345678" } });
    expect(ok.headers["x-request-id"]).toBe("abc-12345678");
    const bad = await app.inject({ method: "GET", url: "/ping", headers: { "x-request-id": "bad id!" } });
    expect(bad.headers["x-request-id"]).not.toBe("bad id!");
    expect(String(bad.headers["x-request-id"])).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("adds userId and familyId from request context", async () => {
    const { lines, stream } = capture();
    const log = pino(createLoggerOptions({ level: "info" }), stream);
    runWithContext({ requestId: "r-12345678", userId: "u1", familyId: "f1" }, () => log.info("hi"));
    expect(lines[0]).toMatchObject({ reqId: "r-12345678", userId: "u1", familyId: "f1" });
    expect(getContext()).toBeUndefined();

    const { lines: l2, stream: s2 } = capture();
    const app = appWith(s2);
    app.get("/v1/families/:familyId/x", async (req) => {
      app.log.info("inside");
      return { id: (req.params as { familyId: string }).familyId };
    });
    await app.inject({ method: "GET", url: "/v1/families/fam-99/x" });
    const inside = l2.find((l) => l.msg === "inside")!;
    expect(inside.familyId).toBe("fam-99");
    expect(inside.reqId).toBeTruthy();
    const access = l2.find((l) => l.msg === "request completed")!;
    expect(access).toMatchObject({
      method: "GET",
      route: "/v1/families/:familyId/x",
      status: 200,
      reqId: inside.reqId,
    });
    expect(typeof access.ms).toBe("number");
    expect(JSON.stringify(l2)).not.toContain("fam-99/x");
  });
});
