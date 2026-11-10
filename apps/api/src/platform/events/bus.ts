import type { Db } from "../db.js";
import { outbox } from "./outbox.schema.js";
import type { DomainEvent, PayloadOf } from "./types.js";
import { uuid7 } from "./uuid7.js";

/** The transaction object handed to `db.transaction(async tx => ...)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface HandlerContext {
  db: Db;
  /** 1-based delivery attempt for this handler. */
  attempt: number;
}

export type DurableHandler = (event: DomainEvent, ctx: HandlerContext) => Promise<void> | void;
export type InTxHandler = (event: DomainEvent, tx: Tx) => Promise<void> | void;
export type InProcessHandler = (name: string, payload: unknown) => void;

export interface PublishOptions {
  familyId?: string;
  occurredAt?: Date;
}

/**
 * Emit events only via `db.transaction(async (tx) => { ...; await bus.publish(tx, name, payload) })`
 * so the outbox row commits or rolls back with the state change.
 */
export class EventBus {
  private readonly inTx = new Map<string, InTxHandler[]>();
  private readonly durable = new Map<string, Map<string, DurableHandler>>();
  private readonly inProcess = new Map<string, InProcessHandler[]>();

  /** Invariant reaction run inside the publisher's transaction; a throw rolls the publisher back. */
  onInTx<N extends string>(
    name: N,
    handler: (event: DomainEvent<N, PayloadOf<N>>, tx: Tx) => Promise<void> | void,
  ): void {
    const list = this.inTx.get(name) ?? [];
    list.push(handler as InTxHandler);
    this.inTx.set(name, list);
  }

  /** Durable subscriber invoked by the drainer. `handlerName` must be unique per event name. */
  on<N extends string>(
    name: N,
    handlerName: string,
    handler: (event: DomainEvent<N, PayloadOf<N>>, ctx: HandlerContext) => Promise<void> | void,
  ): void {
    const map = this.durable.get(name) ?? new Map<string, DurableHandler>();
    if (map.has(handlerName)) throw new Error(`duplicate event handler name: ${name}/${handlerName}`);
    map.set(handlerName, handler as DurableHandler);
    this.durable.set(name, map);
  }

  /** Non-durable signal (websocket fan-out). Never persisted; listener errors are swallowed. */
  onInProcess(name: string, handler: InProcessHandler): void {
    const list = this.inProcess.get(name) ?? [];
    list.push(handler);
    this.inProcess.set(name, list);
  }

  handlersFor(name: string): Map<string, DurableHandler> {
    return this.durable.get(name) ?? new Map<string, DurableHandler>();
  }

  async publish<N extends string>(
    tx: Tx,
    name: N,
    payload: PayloadOf<N>,
    opts: PublishOptions = {},
  ): Promise<DomainEvent<N, PayloadOf<N>>> {
    const event: DomainEvent<N, PayloadOf<N>> = {
      id: uuid7(),
      name,
      payload,
      occurredAt: opts.occurredAt ?? new Date(),
      ...(opts.familyId ? { familyId: opts.familyId } : {}),
    };
    await tx.insert(outbox).values({
      id: event.id,
      name,
      payload,
      occurredAt: event.occurredAt,
      familyId: opts.familyId ?? null,
    });
    for (const h of this.inTx.get(name) ?? []) await h(event, tx);
    return event;
  }

  publishInProcess<N extends string>(name: N, payload: PayloadOf<N>): void {
    for (const h of this.inProcess.get(name) ?? []) {
      try {
        h(name, payload);
      } catch {
        // non-durable signal: a failing listener must not affect the emitter
      }
    }
  }
}
