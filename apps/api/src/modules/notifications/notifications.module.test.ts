import { describe, expect, it } from "vitest";
import { notificationsModule } from "./index.js";

describe("notifications module", () => {
  it("has the expected name", () => {
    expect(notificationsModule.name).toBe("notifications");
  });
});
