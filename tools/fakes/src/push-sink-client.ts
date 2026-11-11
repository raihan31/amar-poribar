export type SinkMessage = {
  token: string;
  deviceId: string;
  priority: "high" | "normal";
  ttlSeconds: number;
  collapseKey?: string;
  data: Record<string, string>;
  androidChannelId?: string;
  sentAt: string;
};

/** Helper for e2e tests: reads and clears the API's fake push sink (`PUSH_DRIVER=fake`). */
export class PushSinkClient {
  constructor(private readonly baseUrl = "http://localhost:4000") {}

  async list(): Promise<SinkMessage[]> {
    const res = await fetch(`${this.baseUrl}/test/push-sink`);
    if (!res.ok) throw new Error(`push sink GET failed: ${res.status}`);
    return (await res.json()) as SinkMessage[];
  }

  async clear(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/test/push-sink`, { method: "DELETE" });
    if (!res.ok) throw new Error(`push sink DELETE failed: ${res.status}`);
  }

  async waitFor(predicate: (m: SinkMessage) => boolean, timeoutMs = 5000, intervalMs = 100): Promise<SinkMessage> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = (await this.list()).find(predicate);
      if (hit) return hit;
      if (Date.now() >= deadline) throw new Error(`push sink: no matching message within ${timeoutMs} ms`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}
