import { afterEach, describe, expect, it } from "vitest";
import { buildFakes } from "./server.js";

const apps: ReturnType<typeof buildFakes>[] = [];
const make = () => {
  const a = buildFakes();
  apps.push(a);
  return a;
};
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

describe("fakes server", () => {
  it("sms fake stores and lists messages", async () => {
    const app = make();
    const r = await app.inject({
      method: "POST",
      url: "/sms/send",
      payload: { to: "+8801700000001", text: "123456", kind: "otp" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ status: "sent" });
    await app.inject({
      method: "POST",
      url: "/sms/send",
      payload: { to: "+8801700000002", text: "x", kind: "invite" },
    });
    const all = (await app.inject({ url: "/sms/messages" })).json();
    expect(all.messages).toHaveLength(2);
    const one = (await app.inject({ url: "/sms/messages?to=%2B8801700000001" })).json();
    expect(one.messages).toHaveLength(1);
    expect(one.messages[0].text).toBe("123456");
    await app.inject({ method: "POST", url: "/sms/__reset" });
    expect((await app.inject({ url: "/sms/messages" })).json().messages).toHaveLength(0);
  });

  it("fcm fake returns UNREGISTERED for dead- tokens", async () => {
    const app = make();
    const dead = await app.inject({
      method: "POST",
      url: "/fcm/v1/projects/p1/messages:send",
      payload: { message: { token: "dead-abc", data: { a: "b" } } },
    });
    expect(dead.statusCode).toBe(404);
    expect(JSON.stringify(dead.json())).toContain("UNREGISTERED");
    const ok = await app.inject({
      method: "POST",
      url: "/fcm/v1/projects/p1/messages:send",
      payload: { message: { token: "tok1", data: { a: "b" } } },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().name).toContain("projects/p1/messages/");
    expect((await app.inject({ url: "/fcm/messages?token=tok1" })).json().messages).toHaveLength(1);
    await app.inject({ method: "POST", url: "/fcm/__reset" });
    expect((await app.inject({ url: "/fcm/messages" })).json().messages).toHaveLength(0);
  });
});
