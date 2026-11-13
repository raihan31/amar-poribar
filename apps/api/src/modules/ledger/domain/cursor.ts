import { z } from "zod";
import { HttpError } from "../../../platform/errors.js";

export interface ListCursor {
  t: Date;
  id: string;
}

const CursorBody = z.object({ t: z.iso.datetime({ offset: true }), id: z.uuid() });

/** `base64url(JSON({ t, id }))` of the last row of a page (FR-TXN-02). */
export function encodeCursor(row: { occurredAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ t: row.occurredAt.toISOString(), id: row.id })).toString("base64url");
}

export function decodeCursor(raw: string): ListCursor {
  try {
    const body = CursorBody.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return { t: new Date(body.t), id: body.id };
  } catch {
    throw new HttpError(400, "invalid_cursor", "The cursor is not valid");
  }
}
