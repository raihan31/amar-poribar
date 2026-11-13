import { recordingKey, requestInput, type Llm, type LlmRequest, type LlmResponse } from "../llm.js";

export class NoRecordingError extends Error {
  constructor(
    readonly key: string,
    readonly feature: string,
  ) {
    super(`No recording for feature "${feature}" with key ${key}. Add tools/fakes/recordings/${feature}-${key}.json`);
    this.name = "NoRecordingError";
  }
}

/** Replays recordings keyed by recordingKey(feature, input). */
export class MemoryLlm implements Llm {
  readonly calls: LlmRequest[] = [];
  private readonly recordings = new Map<string, LlmResponse>();

  add(feature: string, input: string, response: LlmResponse): this {
    this.recordings.set(recordingKey(feature, input), response);
    return this;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    const feature = req.feature ?? "default";
    const key = recordingKey(feature, requestInput(req));
    const hit = this.recordings.get(key);
    if (!hit) throw new NoRecordingError(key, feature);
    return structuredClone(hit);
  }
}
