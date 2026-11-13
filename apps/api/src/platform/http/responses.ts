import { z } from "zod";

/**
 * Response documentation for routes whose bodies are plain JSON rows. The schemas are deliberately loose: they
 * list the response in OpenAPI but pass the handler's value through unchanged (dates stay dates until JSON
 * encoding). Routes with a strict wire shape declare their own schema instead (see `packages/shared`).
 */
export const jsonObject = z.looseObject({});

export const docs = {
  /** 2xx with a JSON object. */
  object: { response: { "2xx": jsonObject } },
  /** 2xx with a JSON array of objects. */
  list: { response: { "2xx": z.array(jsonObject) } },
  /** 204 with no body. */
  noContent: { response: { 204: z.null() } },
  /** 2xx with a text body (CSV export). */
  text: { response: { "2xx": z.string() } },
} as const;
