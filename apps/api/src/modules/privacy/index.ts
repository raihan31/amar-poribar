import type { ModuleDefinition } from "../../platform/module.js";
import { POLICY_VERSION } from "./domain/policy.js";
import { policyRoutes } from "./http/policy-routes.js";
export * from "./events.js";

/** The current privacy policy version; `identity.consents` records it on acceptance (FR-AUTH-10). */
export function getCurrentPolicyVersion(): string {
  return POLICY_VERSION;
}

/** Public surface of the privacy module. Other modules may import only this file (SRS R1). */
export interface PrivacyFacade {
  readonly name: "privacy";
  getCurrentPolicyVersion(): string;
}

declare module "../../platform/module.js" {
  interface Facades {
    privacy: PrivacyFacade;
  }
}

export const privacyModule: ModuleDefinition<PrivacyFacade> = {
  name: "privacy",
  dependsOn: ["identity", "families", "ledger", "comms"],
  register(app) {
    policyRoutes(app);
    return { name: "privacy", getCurrentPolicyVersion };
  },
};
