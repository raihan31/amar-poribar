export interface PushMessage {
  token: string;
  platform: "android" | "web";
  data: Record<string, string>;
  notification?: { title: string; body: string; channelId?: string };
  priority: "high" | "normal";
  ttlSeconds: number;
}

export interface PushResult {
  outcome: "ok" | "unregistered" | "retry" | "failed";
  providerId?: string;
}

/** Port implemented by notifications/infra (FCM) and the fakes. */
export interface PushSender {
  send(msg: PushMessage): Promise<PushResult>;
}
