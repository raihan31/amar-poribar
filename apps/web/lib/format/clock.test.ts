import { formatClock } from "./clock";

const bnNum = (n: number) => n.toLocaleString("bn-BD-u-nu-beng");
const latNum = (n: number) => n.toLocaleString("en-IN-u-nu-latn");

describe("formatClock", () => {
  it("bn with period word and Bangla digits", () => {
    expect(formatClock("21:00", "bn", bnNum)).toBe("রাত ৯:০০");
    expect(formatClock("06:00", "bn", bnNum, { short: true })).toBe("সকাল ৬টা");
    expect(formatClock("22:00", "bn", bnNum, { short: true })).toBe("রাত ১০টা");
    expect(formatClock("00:30", "bn", bnNum)).toBe("রাত ১২:৩০");
    expect(formatClock("13:00", "bn", bnNum)).toBe("দুপুর ১:০০");
  });
  it("en uses AM/PM", () => {
    expect(formatClock("21:00", "en", latNum)).toBe("9:00 PM");
    expect(formatClock("06:00", "en", latNum, { short: true })).toBe("6 AM");
  });
});
