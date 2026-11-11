import Anthropic from "@anthropic-ai/sdk";

/** The client the `@amar-poribar/ai` functions accept. Undefined when no API key is configured. */
export type AiClient = Anthropic;

/** Port: whether the model is reachable and, if so, the SDK client and model name to use. */
export interface ClaudeClient {
  readonly enabled: boolean;
  readonly client?: AiClient;
  readonly model?: string;
}

/** Builds the port from `AppDeps.anthropic` and `aiModel`; disabled when there is no client. */
export function claudeClientOf(client: AiClient | undefined, model?: string): ClaudeClient {
  return {
    enabled: client !== undefined,
    ...(client ? { client } : {}),
    ...(model ? { model } : {}),
  };
}

/** The only place the Anthropic SDK is constructed (the composition root calls it with the API key). */
export function createClaudeClient(apiKey: string): AiClient {
  return new Anthropic({ apiKey });
}
