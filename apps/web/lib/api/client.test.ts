import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { ApiProblem } from "./errors";
import { api, client } from "./client";

describe("api client", () => {
  it("sends csrf header and language", async () => {
    document.cookie = "ap_loc=en";
    let seen: Headers | null = null;
    server.use(
      http.get("*/api/proxy/v1/me", ({ request }) => {
        seen = request.headers;
        return HttpResponse.json({ user: { id: "u1" }, families: [] });
      }),
    );
    await client.GET("/v1/me");
    expect(seen!.get("x-ap-csrf")).toBe("1");
    expect(seen!.get("accept-language")).toBe("en");
  });

  it("adds an Idempotency-Key to idempotent POSTs only", async () => {
    const keys: Array<string | null> = [];
    server.use(
      http.post("*/api/proxy/v1/families", ({ request }) => {
        keys.push(request.headers.get("idempotency-key"));
        return HttpResponse.json({ id: "f1" });
      }),
    );
    await api("/v1/families", { body: { name: "a" }, idempotent: true });
    await api("/v1/families", { body: { name: "a" } });
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBeNull();
  });

  it("maps error body to ApiProblem", async () => {
    server.use(
      http.get("*/api/proxy/v1/me", () =>
        HttpResponse.json({ error: { code: "forbidden", message: "No", details: { a: 1 } } }, { status: 403 }),
      ),
    );
    const err = await api("/v1/me").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiProblem);
    expect(err).toMatchObject({ status: 403, code: "forbidden", message: "No", details: { a: 1 } });
  });
});
