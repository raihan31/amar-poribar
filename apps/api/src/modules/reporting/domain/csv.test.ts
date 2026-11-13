import { describe, expect, it } from "vitest";
import { csvCell, csvRow, dhakaStamp, paisaToDecimal } from "./csv.js";

describe("csv", () => {
  it("csvCell escapes quotes and commas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("বাজার")).toBe("বাজার");
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("-5 note")).toBe("'-5 note");
    expect(csvCell(-500)).toBe("-500");
    expect(csvRow(["a", null, 3])).toBe("a,,3");
  });

  it("paisaToDecimal formats paisa", () => {
    expect(paisaToDecimal(0)).toBe("0.00");
    expect(paisaToDecimal(5)).toBe("0.05");
    expect(paisaToDecimal(123456)).toBe("1234.56");
    expect(paisaToDecimal(-250)).toBe("-2.50");
  });

  it("dhakaStamp uses +06:00", () => {
    expect(dhakaStamp(new Date("2026-11-30T18:30:00Z"))).toBe("2026-12-01 00:30");
  });
});
