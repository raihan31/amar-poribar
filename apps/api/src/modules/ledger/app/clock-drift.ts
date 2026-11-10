import { HttpError } from "../../../platform/errors.js";
import { ClockDriftError, formatHlc, parseHlc, receiveHlc } from "../domain/hlc.js";

/** One device with a wrong clock must not overwrite everyone's data (24h limit, SRS §4.3.1). */
export function assertNoClockDrift(hlcs: readonly string[], nowMs: number = Date.now()): void {
  let probe = parseHlc(formatHlc({ time: nowMs, counter: 0, node: "server" }));
  try {
    for (const h of hlcs) probe = receiveHlc(probe, parseHlc(h), nowMs);
  } catch (e) {
    if (e instanceof ClockDriftError) {
      throw new HttpError(
        400,
        "clock_drift",
        "This device's clock is too far ahead; fix the date and time, then sync again",
      );
    }
    throw e;
  }
}
