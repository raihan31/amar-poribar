import { describe, expect, it } from "vitest";
import { z } from "zod";
import { collectJobs, defineJob } from "./define.js";
import { createJobs } from "./jobs.js";

describe("inline jobs", () => {
  it("inline mode runs handlers synchronously", async () => {
    const seen: number[] = [];
    const jobs = createJobs({ inline: true });
    jobs.register(
      defineJob({ name: "t.add-item", schema: z.object({ n: z.number() }), handler: (d) => void seen.push(d.n) }),
    );
    await jobs.send("t.add-item", { n: 7 });
    expect(seen).toEqual([7]);
    await expect(jobs.send("t.add-item", { n: "x" })).rejects.toThrow();
  });

  it("schedule respects Asia/Dhaka", async () => {
    // 03:00 Dhaka (UTC+6) is 21:00 UTC the previous day.
    let now = new Date("2026-03-01T20:30:00Z");
    const jobs = createJobs({ inline: true, clock: () => now });
    let runs = 0;
    jobs.register(
      defineJob({ name: "t.nightly-sweep", schema: z.object({}), cron: "0 3 * * *", handler: () => void runs++ }),
    );
    now = new Date("2026-03-01T20:59:00Z");
    expect(await jobs.runDue()).toEqual([]);
    now = new Date("2026-03-01T21:00:30Z");
    expect(await jobs.runDue()).toEqual(["t.nightly-sweep"]);
    expect(await jobs.runDue()).toEqual([]);
    now = new Date("2026-03-02T03:00:00Z"); // 09:00 Dhaka: not due
    expect(await jobs.runDue()).toEqual([]);
    now = new Date("2026-03-02T21:00:00Z");
    expect(await jobs.runDue()).toEqual(["t.nightly-sweep"]);
    expect(runs).toBe(2);
  });
});

describe("defineJob", () => {
  it("validates names and applies retry defaults", () => {
    expect(() => defineJob({ name: "bad", schema: z.object({}), handler: () => {} })).toThrow(/invalid job name/);
    const j = defineJob({ name: "budgeting.evaluate-alerts", schema: z.object({}), handler: () => {} });
    expect(j).toMatchObject({ retryLimit: 5, retryBackoff: true });
  });

  it("collectJobs rejects duplicate names", () => {
    const j = defineJob({ name: "a.b-c", schema: z.object({}), handler: () => {} });
    expect(() => collectJobs([{ jobs: [j] }, { jobs: [j] }])).toThrow(/duplicate/);
  });
});
