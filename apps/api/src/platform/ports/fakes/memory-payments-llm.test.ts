import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recordingKey } from "../llm.js";
import { MemoryLlm, NoRecordingError } from "./memory-llm.js";
import { MemoryPayments } from "./memory-payments.js";

describe("memory payments", () => {
  it("verifies its own signed webhook and rejects tampering", async () => {
    const pay = new MemoryPayments();
    const c = await pay.createCheckout({ amountPaisa: 9900, currency: "BDT", reference: "inv-1", returnUrl: "x" });
    const { headers, rawBody } = pay.complete(c.providerPaymentId);
    expect(pay.verifyWebhook(headers, rawBody)).toMatchObject({
      providerPaymentId: c.providerPaymentId,
      status: "paid",
    });
    expect(pay.verifyWebhook(headers, rawBody.replace("paid", "failed"))).toBeNull();
    expect(pay.verifyWebhook({}, rawBody)).toBeNull();
  });
});

describe("memory llm", () => {
  it("recordingKey matches the shipped recording file names", () => {
    const dir = fileURLToPath(new URL("../../../../../../tools/fakes/recordings", import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const r = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as { feature: string; input: string };
      expect(f).toBe(`${r.feature}-${recordingKey(r.feature, r.input)}.json`);
    }
  });

  const req = (content: string) => ({
    system: "s",
    messages: [{ role: "user" as const, content }],
    maxTokens: 10,
    effort: "low" as const,
    feature: "parse-text",
  });

  it("returns a recording or lists the missing key", async () => {
    const llm = new MemoryLlm().add("parse-text", "bazar 850", {
      text: "{}",
      usage: { inputTokens: 1, outputTokens: 1 },
      stopReason: "end_turn",
    });
    expect((await llm.complete(req("  Bazar   850 "))).text).toBe("{}");
    const err = await llm.complete(req("other")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NoRecordingError);
    expect((err as Error).message).toContain(recordingKey("parse-text", "other"));
  });
});
