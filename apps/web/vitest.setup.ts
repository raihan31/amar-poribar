import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

declare global {
  var __spoken: string[];
  var __vibrations: Array<number | number[]>;
}

globalThis.__spoken = [];
globalThis.__vibrations = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  globalThis.__spoken = [];
  globalThis.__vibrations = [];
});
afterAll(() => server.close());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.defineProperty(window, "IntersectionObserver", { writable: true, value: IntersectionObserverStub });

Object.defineProperty(window, "speechSynthesis", {
  writable: true,
  value: {
    speak: (u: { text?: string }) => {
      globalThis.__spoken.push(u?.text ?? "");
    },
    cancel: () => {},
    getVoices: () => [],
  },
});

Object.defineProperty(navigator, "vibrate", {
  writable: true,
  value: (pattern: number | number[]) => {
    globalThis.__vibrations.push(pattern);
    return true;
  },
});
