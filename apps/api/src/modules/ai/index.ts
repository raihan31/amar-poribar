import type { ModuleDefinition } from "../../platform/module.js";
import type { AiDeps, AiStore } from "./app/deps.js";
import { createEntitlementsPort } from "./app/entitlements-port.js";
import { getUsage } from "./app/quota.js";
import { askRoutes } from "./http/ask-routes.js";
import { parseRoutes } from "./http/parse-routes.js";
import { receiptRoutes } from "./http/receipt-routes.js";
import { summaryRoutes } from "./http/summary-routes.js";
import { claudeClientOf, createClaudeClient, type AiClient, type ClaudeClient } from "./infra/claude-client.js";
import { createAiStore } from "./infra/store.js";
export * from "./events.js";

export type { AiClient, AiStore, ClaudeClient };
export { createClaudeClient };

/** What the composition root puts in `ModuleContext.config.ai`. */
export interface AiConfig {
  client?: AiClient | undefined;
  model?: string | undefined;
}

/** Public surface of the ai module. Other modules may import only this file (SRS R1). */
export interface AiFacade {
  readonly name: "ai";
  /** Requests used in `month` (YYYY-MM) and the family's monthly quota. */
  getUsage(familyId: string, month: string): Promise<{ month: string; requests: number; quota: number }>;
}

declare module "../../platform/module.js" {
  interface Facades {
    ai: AiFacade;
  }
}

export interface AiModuleOverrides extends AiConfig {
  store?: AiStore;
}

/** The module with its ports replaceable, so tests run without a database or a real model. */
export function createAiModule(overrides: AiModuleOverrides = {}): ModuleDefinition<AiFacade> {
  return {
    name: "ai",
    dependsOn: ["families", "ledger", "billing"],
    register(app, ctx) {
      const { families, ledger } = ctx.facades;
      if (!families || !ledger) throw new Error("ai: families and ledger must be registered first");
      const cfg = (ctx.config as { ai?: AiConfig } | undefined)?.ai ?? {};
      const deps: AiDeps = {
        store: overrides.store ?? createAiStore(ctx.db),
        families,
        entitlements: createEntitlementsPort({ families, billing: ctx.facades.billing, flags: ctx.flags }),
        ledger,
        claude: claudeClientOf(
          "client" in overrides ? overrides.client : cfg.client,
          "model" in overrides ? overrides.model : cfg.model,
        ),
        clock: ctx.clock,
      };
      parseRoutes(app, deps);
      summaryRoutes(app, deps);
      askRoutes(app, deps);
      receiptRoutes(app, deps);
      return { name: "ai", getUsage: (familyId, month) => getUsage(deps, familyId, month) };
    },
  };
}

export const aiModule = createAiModule();
