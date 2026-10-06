import { describe, expect, it } from "vitest";
import { looksLikeMfsSms, maskPhone, parseMfsSms } from "./sms.js";

describe("parseMfsSms", () => {
  it("parses bKash send money", () => {
    const d = parseMfsSms(
      "You have sent Tk 1,500.00 to 01712345678 successfully. Ref ammu. Fee Tk 5.00. Balance Tk 3,210.50. TrxID BJ51AB12CD at 05/10/2026 14:22",
    );
    expect(d).toMatchObject({
      type: "expense",
      amountPaisa: 150_000,
      feePaisa: 500,
      accountType: "bkash",
      trxId: "BJ51AB12CD",
      counterparty: "01XXXXXX678",
      occurredAt: "2026-10-05T14:22:00+06:00",
      source: "sms",
    });
  });

  it("parses bKash bill payment and maps the biller to a category", () => {
    const d = parseMfsSms(
      "Bill successfully paid. Biller: DESCO Postpaid. Account: 1234567. Amount: Tk 2,340.00 Fee: Tk 0.00. TrxID BJ6XYZ9876 at 03/10/2026 10:05",
    );
    expect(d?.categoryKey).toBe("electricity");
    expect(d?.amountPaisa).toBe(234_000);
  });

  it("parses Nagad money received as income", () => {
    const d = parseMfsSms(
      "Money Received. Amount: Tk 5000.00 Sender: 01898765432 Ref: N/A TxnID: 71A2B3C4 Balance: Tk 7,010.00 04/10/2026 20:15",
    );
    expect(d).toMatchObject({ type: "income", amountPaisa: 500_000, accountType: "nagad", trxId: "71A2B3C4" });
    expect(d?.counterparty).toBe("01XXXXXX432");
  });

  it("parses mobile recharge", () => {
    const d = parseMfsSms("Mobile Recharge Tk 50.00 to 01612345678 successful. Balance Tk 950.00. TrxID BJ7REC0001 at 01/10/2026 09:00");
    expect(d?.categoryKey).toBe("mobile_recharge");
  });

  it("parses Bangla digits", () => {
    const d = parseMfsSms("Payment Tk ৮৫০.০০ to Shwapno is successful. Balance Tk ১,০০০.০০. TrxID BJ8PAY0002 at ০২/১০/২০২৬ ১৮:৩০");
    expect(d?.amountPaisa).toBe(85_000);
    expect(d?.counterparty).toBe("Shwapno");
  });

  it("returns null for non-MFS text", () => {
    expect(parseMfsSms("bazar 850 cash")).toBeNull();
    expect(looksLikeMfsSms("bazar 850 cash")).toBe(false);
  });

  it("masks phone numbers", () => {
    expect(maskPhone("to +8801712345678")).toBe("to 01XXXXXX678");
  });
});
