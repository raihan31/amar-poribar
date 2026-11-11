type Filters = Record<string, string | number | undefined>;

/** Query-key factory for the console. */
export const qk = {
  staffSession: () => ["staff", "session"] as const,
  overview: () => ["admin", "overview"] as const,
  families: (filters: Filters = {}) => ["admin", "families", filters] as const,
  family: (id: string) => ["admin", "family", id] as const,
  privacy: () => ["admin", "privacy"] as const,
  plans: () => ["admin", "plans"] as const,
  audit: (filters: Filters = {}) => ["admin", "audit", filters] as const,
  staff: () => ["admin", "staff"] as const,
  health: () => ["admin", "health"] as const,
};
