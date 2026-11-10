import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  userId?: string;
  familyId?: string;
}

const store = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return store.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return store.getStore();
}

/** Adds fields to the current context (e.g. userId from the auth hook). No-op outside a request. */
export function setContext(patch: Partial<Omit<RequestContext, "requestId">>): void {
  const ctx = store.getStore();
  if (ctx) Object.assign(ctx, patch);
}
