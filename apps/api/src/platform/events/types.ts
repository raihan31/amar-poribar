/**
 * Event registry. Each module's `events.ts` declares its payload types and merges them in:
 *
 *   declare module "../../platform/events/types.js" {
 *     interface EventMap { "ledger.TransactionCreated.v1": TransactionCreatedPayload }
 *   }
 *
 * Payloads carry ids and small facts, never free text written by users.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EventMap {}

export interface DomainEvent<N extends string = string, P = unknown> {
  id: string;
  name: N;
  payload: P;
  occurredAt: Date;
  familyId?: string;
}

export type PayloadOf<N extends string> = N extends keyof EventMap ? EventMap[N] : unknown;
