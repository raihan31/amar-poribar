import { loadConfig } from "./platform/config.js";

/** Temporary compatibility export; removed in T-PLAT-31. Prefer `loadConfig()` from `platform/config`. */
export const env = loadConfig();
