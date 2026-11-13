export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AP_MOCK === "1") {
    const { server } = await import("./mocks/server");
    const { e2eHandlers } = await import("./mocks/e2e-stack");
    // Stateful e2e handlers go first so they win over the static unit-test handlers.
    server.use(...e2eHandlers);
    server.listen({ onUnhandledRequest: "warn" });
  }
}
