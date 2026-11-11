import type { DeviceRemover } from "./ports.js";
import type { SessionService } from "./session-service.js";

export interface LogoutDeps {
  sessions: SessionService;
  devices: DeviceRemover;
}

/** Ends the session of the access token and unregisters the push token of `deviceId`, if given. */
export async function logout(deps: LogoutDeps, user: { userId: string; sessionId: string }, deviceId?: string) {
  await deps.sessions.logout(user.sessionId);
  if (deviceId) await deps.devices.removeDevice(user.userId, deviceId);
}

/** Ends every session of the user. */
export async function logoutAll(deps: Pick<LogoutDeps, "sessions">, userId: string) {
  await deps.sessions.logoutAll(userId);
}
