import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

export const DEFAULT_RECORDINGS_DIR = fileURLToPath(new URL("../recordings", import.meta.url));

export interface Recording {
  feature: string;
  input: string;
  response: {
    text: string;
    toolCalls?: { id: string; name: string; input: unknown }[];
    usage: { inputTokens: number; outputTokens: number };
    stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal";
  };
}

export class NoRecordingError extends Error {
  constructor(
    readonly key: string,
    readonly feature: string,
  ) {
    super(`No recording for feature "${feature}" with key ${key}. Add tools/fakes/recordings/${feature}-${key}.json`);
    this.name = "NoRecordingError";
  }
}

export function normaliseInput(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Must stay identical to `recordingKey` in apps/api/src/platform/ports/llm.ts. */
export function recordingKey(feature: string, input: string): string {
  return createHash("sha256")
    .update(`${feature}\n${normaliseInput(input)}`)
    .digest("hex")
    .slice(0, 16);
}

export function loadRecordings(dir = DEFAULT_RECORDINGS_DIR): Map<string, Recording> {
  const out = new Map<string, Recording>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const r = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Recording;
    out.set(recordingKey(r.feature, r.input), r);
  }
  return out;
}

export class ClaudeFake {
  private readonly recordings: Map<string, Recording>;
  constructor(recordings: Map<string, Recording> = loadRecordings()) {
    this.recordings = recordings;
  }

  find(feature: string, input: string): Recording["response"] {
    const key = recordingKey(feature, input);
    const r = this.recordings.get(key);
    if (!r) throw new NoRecordingError(key, feature);
    return r.response;
  }
}

/** `POST /claude/v1/messages`: Anthropic Messages shaped. The feature comes from the `x-fake-feature` header. */
export function claudeRoutes(app: FastifyInstance, fake = new ClaudeFake()): void {
  // E2E support: how many times the AI service was called, so a test can prove "no AI call" (AC-03).
  let calls = 0;
  app.get("/__fake/claude/calls", async () => ({ count: calls }));
  app.post("/claude/v1/messages", async (req, reply) => {
    calls += 1;
    const b = (req.body ?? {}) as { messages?: { role: string; content: unknown }[] };
    const feature = String(req.headers["x-fake-feature"] ?? "default");
    const last = [...(b.messages ?? [])].reverse().find((m) => m.role === "user");
    const input = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");
    try {
      const r = fake.find(feature, input);
      return {
        id: "msg_fake",
        type: "message",
        role: "assistant",
        content: [
          { type: "text", text: r.text },
          ...(r.toolCalls ?? []).map((t) => ({ type: "tool_use", id: t.id, name: t.name, input: t.input })),
        ],
        stop_reason: r.stopReason,
        usage: { input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens },
      };
    } catch (e) {
      if (e instanceof NoRecordingError) {
        return reply.code(404).send({ type: "error", error: { type: "no_recording", message: e.message, key: e.key } });
      }
      throw e;
    }
  });
}
