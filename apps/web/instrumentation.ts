export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AP_MOCK === "1") {
    const { server } = await import("./mocks/server");
    server.listen({ onUnhandledRequest: "warn" });
  }
}
