import type { Sql } from "../db.js";
import { uuid7 } from "../events/uuid7.js";
import { NOTIFY_CHANNEL, NOTIFY_MAX_BYTES, type FanoutMessage } from "./protocol.js";

/** Carries hub messages between instances. */
export interface Fanout {
  /** Starts delivering messages published by other instances. */
  start(onMessage: (msg: FanoutMessage) => void): Promise<void>;
  publish(msg: FanoutMessage): Promise<void>;
  stop(): Promise<void>;
}

interface Reference {
  ref: string;
}

/** `pg_notify('realtime', json)`; frames over the NOTIFY limit are parked in `platform.realtime_payloads`. */
export class PgFanout implements Fanout {
  private unlisten: (() => Promise<void>) | undefined;

  constructor(
    private readonly sql: Sql,
    private readonly onError: (err: unknown) => void = () => {},
  ) {}

  async start(onMessage: (msg: FanoutMessage) => void): Promise<void> {
    const listener = await this.sql.listen(NOTIFY_CHANNEL, (payload) => {
      void this.decode(payload).then(
        (msg) => {
          if (msg) onMessage(msg);
        },
        (err) => this.onError(err),
      );
    });
    this.unlisten = () => listener.unlisten();
  }

  async publish(msg: FanoutMessage): Promise<void> {
    const json = JSON.stringify(msg);
    if (Buffer.byteLength(json) <= NOTIFY_MAX_BYTES) {
      await this.sql`select pg_notify(${NOTIFY_CHANNEL}, ${json})`;
      return;
    }
    const id = uuid7();
    await this.sql`delete from platform.realtime_payloads where created_at < now() - interval '1 hour'`;
    await this.sql`insert into platform.realtime_payloads (id, body) values (${id}, ${json})`;
    const ref: Reference = { ref: id };
    await this.sql`select pg_notify(${NOTIFY_CHANNEL}, ${JSON.stringify(ref)})`;
  }

  async stop(): Promise<void> {
    const u = this.unlisten;
    this.unlisten = undefined;
    if (u) await u();
  }

  private async decode(payload: string): Promise<FanoutMessage | undefined> {
    const parsed = JSON.parse(payload) as Partial<Reference> & Partial<FanoutMessage>;
    if (typeof parsed.ref === "string") {
      const rows = await this.sql<{ body: string }[]>`
        select body from platform.realtime_payloads where id = ${parsed.ref}`;
      return rows[0] ? (JSON.parse(rows[0].body) as FanoutMessage) : undefined;
    }
    return parsed as FanoutMessage;
  }
}

/** Single-instance fanout with no database: messages never leave the process (tests, OpenAPI build). */
export class LocalFanout implements Fanout {
  async start(): Promise<void> {}
  async publish(): Promise<void> {}
  async stop(): Promise<void> {}
}
