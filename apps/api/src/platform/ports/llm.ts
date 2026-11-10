import { createHash } from "node:crypto";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  jsonSchema?: Record<string, unknown>;
  tools?: LlmTool[];
  maxTokens: number;
  effort: "low" | "medium" | "high";
  /** Names the use case (e.g. "parse-text"); part of the recording key. */
  feature?: string;
}

export interface LlmResponse {
  text: string;
  toolCalls?: LlmToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal";
}

/** Port implemented by `ai/infra/ClaudeClient` (T-AI) and the recorded fake. */
export interface Llm {
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/** NFC, lower-case, collapse whitespace so trivial differences hit the same recording. */
export function normaliseInput(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Recording key: sha256 of "feature\nnormalised input" (hex, first 16 chars).
 * Must stay identical to `recordingKey` in tools/fakes/src/claude.ts.
 */
export function recordingKey(feature: string, input: string): string {
  return createHash("sha256")
    .update(`${feature}\n${normaliseInput(input)}`)
    .digest("hex")
    .slice(0, 16);
}

/** The input a recording is keyed on: the last user message. */
export function requestInput(req: LlmRequest): string {
  for (let i = req.messages.length - 1; i >= 0; i--) {
    const m = req.messages[i]!;
    if (m.role === "user") return m.content;
  }
  return "";
}
