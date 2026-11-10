import Anthropic from "@anthropic-ai/sdk";

/** The client the `@amar-poribar/ai` functions accept. Undefined when no API key is configured. */
export type AiClient = Anthropic;

/** The only place the Anthropic SDK is constructed (the composition root calls it with the API key). */
export function createClaudeClient(apiKey: string): AiClient {
  return new Anthropic({ apiKey });
}
