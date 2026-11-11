import { describe, expect, it } from "vitest";
import { notificationsModule, notify, NotImplemented } from "./index.js";

describe("notifications module", () => {
  it("has the expected name", () => {
    expect(notificationsModule.name).toBe("notifications");
  });

  it("notify rejects before the module is registered", async () => {
    const ctx = { db: {} } as never;
    await expect(notify(ctx, { userIds: [], kind: "system", params: {} })).rejects.toBeInstanceOf(NotImplemented);
  });
});
