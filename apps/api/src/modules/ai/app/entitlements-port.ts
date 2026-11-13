import type { Flags } from "../../../platform/module.js";
import type { BillingFacade } from "../../billing/index.js";
import type { FamiliesFacade } from "../../families/index.js";

export interface AiEntitlements {
  aiQuotaMonth: number;
  features: { receipt: boolean; ask: boolean };
}

/** What a family's plan allows the AI to do (FR-AI-12, DEC-10). */
export interface EntitlementsPort {
  get(familyId: string): Promise<AiEntitlements>;
}

/**
 * Default adapter. The quota is the family's local limit (kept current by billing events). Plan features are
 * all on until billing is enforced (flag `billing`, P3); after that billing decides receipt vision and Ask.
 */
export function createEntitlementsPort(deps: {
  families: Pick<FamiliesFacade, "getAiQuota">;
  billing: Pick<BillingFacade, "entitlements"> | undefined;
  flags: Pick<Flags, "isOn"> | undefined;
}): EntitlementsPort {
  return {
    async get(familyId) {
      const { quotaMonth } = await deps.families.getAiQuota(familyId);
      const enforced = deps.billing && deps.flags ? await deps.flags.isOn("billing", { familyId }) : false;
      if (!enforced || !deps.billing) return { aiQuotaMonth: quotaMonth, features: { receipt: true, ask: true } };
      const { features } = await deps.billing.entitlements(familyId);
      return { aiQuotaMonth: quotaMonth, features: { receipt: !!features.receiptVision, ask: !!features.ask } };
    },
  };
}
