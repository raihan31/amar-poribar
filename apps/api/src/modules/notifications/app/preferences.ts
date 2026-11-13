import type { Db } from "../../../platform/db.js";
import { isQuietAt } from "../domain/quiet-hours.js";
import { readPreferences } from "../infra/preferences-repo.js";

export { readPreferences, updatePreferences } from "../infra/preferences-repo.js";

/** True when `now` is inside the user's quiet window (FR-NOTIF-05). */
export async function isQuietNowFor(db: Db, userId: string, now: Date): Promise<boolean> {
  const p = await readPreferences(db, userId);
  return isQuietAt(now, p.quietStart, p.quietEnd);
}
