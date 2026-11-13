import { registerServiceWorker } from "./register";

describe("registerServiceWorker", () => {
  it("does nothing outside production", () => {
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });
});
