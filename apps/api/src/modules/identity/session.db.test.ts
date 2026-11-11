import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { buildTestApp, FIXED_NOW, type Tokens } from "../../../tests/support/app-test.js";
import { withTestDb } from "../../../tests/support/db-test.js";

function setup(fn: (t: Awaited<ReturnType<typeof buildTestApp>>, clock: { now: Date }) => Promise<void>) {
  return withTestDb(async ({ db, sql }) => {
    const clock = { now: FIXED_NOW };
    const t = await buildTestApp({ db, sql, clock: () => clock.now });
    try {
      await fn(t, clock);
    } finally {
      await t.close();
    }
  });
}

const refresh = (t: Awaited<ReturnType<typeof buildTestApp>>, refreshToken: string) =>
  t.app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken } });

const patchMe = (t: Awaited<ReturnType<typeof buildTestApp>>, user: Tokens) =>
  t.app.inject({ method: "PATCH", url: "/v1/me", headers: t.as(user), payload: { simpleMode: true } });

const after = (ms: number) => new Date(FIXED_NOW.getTime() + ms);

describe("identity sessions (db)", () => {
  it("refresh returns a new pair and marks the old one rotated", async () => {
    await setup(async (t) => {
      const first = await t.login("01712345678");
      const res = await refresh(t, first.refreshToken);
      expect(res.statusCode).toBe(200);
      const next = res.json<Tokens>();
      expect(next.refreshToken).not.toBe(first.refreshToken);
      const rows = await t.db.execute<{ rotated_at: Date | null; parent_id: string | null; chain_id: string }>(
        sql`select rotated_at, parent_id, chain_id from identity.sessions order by created_at, rotated_at nulls last`,
      );
      expect(rows.length).toBe(2);
      const rotated = rows.filter((r) => r.rotated_at !== null);
      expect(rotated.length).toBe(1);
      expect(rows[0]!.chain_id).toBe(rows[1]!.chain_id);
      expect((await refresh(t, next.refreshToken)).statusCode).toBe(200);
    });
  });

  it("reuse after 10 seconds revokes the whole chain", async () => {
    await setup(async (t, clock) => {
      const first = await t.login("01712345678");
      const second = (await refresh(t, first.refreshToken)).json<Tokens>();
      expect((await patchMe(t, first)).statusCode).toBe(200);
      clock.now = after(11_000);
      const reuse = await refresh(t, first.refreshToken);
      expect(reuse.statusCode).toBe(401);
      expect(reuse.json().error.code).toBe("refresh_reused");
      expect((await refresh(t, second.refreshToken)).statusCode).toBe(401);
      const open = await t.db.execute(sql`select 1 from identity.sessions where revoked_at is null`);
      expect(open.length).toBe(0);
      expect((await patchMe(t, first)).statusCode).toBe(401);
      expect((await patchMe(t, second)).statusCode).toBe(401);
    });
  });

  it("reuse within 10 seconds returns refresh_in_flight", async () => {
    await setup(async (t, clock) => {
      const first = await t.login("01712345678");
      const second = (await refresh(t, first.refreshToken)).json<Tokens>();
      clock.now = after(5_000);
      const again = await refresh(t, first.refreshToken);
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe("refresh_in_flight");
      expect((await refresh(t, second.refreshToken)).statusCode).toBe(200);
    });
  });

  it("expired refresh is rejected", async () => {
    await setup(async (t, clock) => {
      const first = await t.login("01712345678");
      clock.now = after(31 * 24 * 3600_000);
      const res = await refresh(t, first.refreshToken);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("refresh_invalid");
    });
  });

  it("revoked session fails authenticate within 30 seconds", async () => {
    await setup(async (t, clock) => {
      const first = await t.login("01712345678");
      const second = (await refresh(t, first.refreshToken)).json<Tokens>();
      expect((await patchMe(t, second)).statusCode).toBe(200);
      clock.now = after(11_000);
      await refresh(t, first.refreshToken);
      clock.now = after(12_000);
      expect((await patchMe(t, second)).statusCode).toBe(401);
    });
  });

  it("access token carries sid", async () => {
    await setup(async (t) => {
      const first = await t.login("01712345678");
      const payload = JSON.parse(Buffer.from(first.accessToken.split(".")[1]!, "base64url").toString()) as {
        sid?: string;
        typ?: string;
        sub?: string;
      };
      expect(payload.typ).toBe("access");
      expect(payload.sid).toMatch(/^[0-9a-f-]{36}$/);
      const id = Buffer.from(first.refreshToken.split(".")[0]!, "base64url").toString();
      expect(payload.sid).toBe(id);
    });
  });

  it("old stateless refresh JWTs are rejected", async () => {
    await setup(async (t) => {
      const first = await t.login("01712345678");
      const old = t.app.jwt.sign({ sub: "u", typ: "refresh" } as never, { expiresIn: "30d" });
      const res = await refresh(t, old);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("refresh_invalid");
      const garbage = await refresh(t, "not-a-token");
      expect(garbage.statusCode).toBe(401);
      expect((await refresh(t, first.refreshToken)).statusCode).toBe(200);
    });
  });
});
