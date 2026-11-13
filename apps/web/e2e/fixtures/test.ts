import { test as base, expect } from "@playwright/test";
import { mockSession } from "./auth";

export const test = base.extend<{ mockUser: void }>({
  // Opt-in: destructure `mockUser` to start with a signed-in mock session.
  mockUser: [
    async ({ context, baseURL }, use) => {
      await mockSession(context, baseURL);
      await use();
    },
    { auto: false },
  ],
});

export { expect };
export { checkA11y } from "../helpers/a11y";
export { snap } from "../helpers/visual";
export { installFakeSpeech } from "../helpers/fakeSpeech";
export { installFakeMedia } from "../helpers/fakeMedia";
export { loginAs, loginWithTokens, mockSession } from "./auth";
export { waitForStack } from "./stack";
export { waitForText, trackVibrations, eventually } from "./realtime";
