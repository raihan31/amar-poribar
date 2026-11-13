import deps from "./module-deps.json" with { type: "json" };

/** Allowed module dependencies (SRS §3.3). `.dependency-cruiser.cjs` reads the JSON file next to this one. */
export const MODULE_DEPS: Record<string, readonly string[]> = deps;
