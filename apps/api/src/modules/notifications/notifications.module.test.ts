import { describe, expect, it } from "vitest";
import { notificationsModule, notify, NotImplemented } from "./index.js";

describe("notifications module", () => {
  it("has the expected name", () => {
    expect(notificationsModule.name).toBe("notifications");
  });

  it("stubs throw NotImplemented", async () => {
    const ctx = {} as never;
    await expect(notify(ctx, { userIds: [], kind: "system", params: {} })).rejects.toBeInstanceOf(NotImplemented);
  });
});
