/** Published when a family's subscription changes (T-BILL-05 emits it). Entitlement caches listen for it. */
export interface SubscriptionChangedPayload {
  familyId: string;
}

declare module "../../platform/events/types.js" {
  interface EventMap {
    "billing.SubscriptionChanged.v1": SubscriptionChangedPayload;
  }
}
