import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type OwnedTestDb } from "../../../tests/support/db-test.js";

let t: OwnedTestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.drop();
});

const USER = "11111111-1111-4111-8111-111111111111";

function insert(dedupe: string | null, userId = USER) {
  return t.sql`
    insert into notifications.inbox_items (user_id, kind, title, body, speech_text, dedupe_key)
    values (${userId}, 'system', 't', 'b', 's', ${dedupe})
    returning read_at, seq`;
}

describe("notifications schema", () => {
  it("creates tables", async () => {
    const rows = await t.sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'notifications' order by tablename`;
    expect(rows.map((r) => r.tablename)).toEqual(["inbox_items", "preferences"]);
  });

  it("dedupe key unique per user", async () => {
    await insert("k1");
    await expect(insert("k1")).rejects.toThrow();
    await insert("k1", "22222222-2222-4222-8222-222222222222");
    await insert(null);
    await insert(null);
  });

  it("read_at defaults null", async () => {
    const [row] = await insert("k-read");
    expect(row?.read_at).toBeNull();
    expect(row?.seq).toBeDefined();
  });

  it("rejects an unknown kind", async () => {
    await expect(
      t.sql`insert into notifications.inbox_items (user_id, kind, title, body, speech_text)
            values (${USER}, 'bogus', 't', 'b', 's')`,
    ).rejects.toThrow();
  });

  it("preferences defaults", async () => {
    const [p] = await t.sql`insert into notifications.preferences (user_id) values (${USER}) returning *`;
    expect(p?.kinds).toEqual({});
    expect(p?.quiet_start).toBe("22:00:00");
    expect(p?.quiet_end).toBe("06:00:00");
    expect(p?.daily_reminder_time).toBe("21:00:00");
    expect(p?.daily_reminder_enabled).toBe(true);
    expect(p?.hide_presence).toBe(false);
  });
});
