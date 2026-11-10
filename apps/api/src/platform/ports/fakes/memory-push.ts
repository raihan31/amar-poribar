import type { PushMessage, PushResult, PushSender } from "../push-sender.js";

export class MemoryPush implements PushSender {
  readonly sent: PushMessage[] = [];
  private failures: PushResult["outcome"][] = [];
  private seq = 0;

  async send(msg: PushMessage): Promise<PushResult> {
    const outcome = this.failures.shift() ?? "ok";
    if (outcome !== "ok") return { outcome };
    this.sent.push(msg);
    return { outcome, providerId: `mem-push-${++this.seq}` };
  }

  last(): PushMessage | undefined {
    return this.sent[this.sent.length - 1];
  }

  clear(): void {
    this.sent.length = 0;
    this.failures = [];
  }

  failNext(outcome: Exclude<PushResult["outcome"], "ok">): void {
    this.failures.push(outcome);
  }
}
