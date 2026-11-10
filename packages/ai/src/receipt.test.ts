import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { parseReceipt } from "./receipt.js";

const categories = [{ key: "bazaar", nameEn: "Bazaar", nameBn: "বাজার", kind: "expense" as const }];
const now = new Date("2026-11-09T04:00:00Z");

function client(output: unknown, stop = "end_turn") {
  const seen: any[] = [];
  const c = {
    beta: {
      messages: {
        parse: async (req: any) => {
          seen.push(req);
          return { stop_reason: stop, parsed_output: output };
        },
      },
    },
  } as unknown as Anthropic;
  return { c, seen };
}

const draft = (over: object = {}) => ({
  type: "expense",
  amountTaka: 1250.5,
  feeTaka: 0,
  date: "2026-11-08",
  categoryKey: "bazaar",
  accountType: null,
  note: "Shwapno groceries",
  counterparty: "Shwapno",
  confidence: 0.8,
  ...over,
});

describe("parseReceipt", () => {
  it("sends the image and returns receipt-sourced drafts", async () => {
    const { c, seen } = client({ drafts: [draft()] });
    const out = await parseReceipt({ base64: "AAAA", mediaType: "image/jpeg" }, { client: c, categories, now });
    expect(seen[0].messages[0].content[0]).toMatchObject({
      type: "image",
      source: { media_type: "image/jpeg", data: "AAAA" },
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      amountPaisa: 125050,
      source: "receipt",
      categoryKey: "bazaar",
      counterparty: "Shwapno",
      trxId: null,
    });
    expect(out[0]!.occurredAt).toBe("2026-11-08T12:00:00+06:00");
  });

  it("drops unreadable totals and unknown categories", async () => {
    const { c } = client({ drafts: [draft({ amountTaka: 0 }), draft({ categoryKey: "made_up" })] });
    const out = await parseReceipt({ base64: "AAAA", mediaType: "image/png" }, { client: c, categories, now });
    expect(out).toHaveLength(1);
    expect(out[0]!.categoryKey).toBeNull();
  });

  it("fails cleanly when the model refuses", async () => {
    const { c } = client(null, "refusal");
    await expect(
      parseReceipt({ base64: "AAAA", mediaType: "image/webp" }, { client: c, categories, now }),
    ).rejects.toThrow(/refusal/);
  });
});
