type DriverError = { code?: string; constraint_name?: string; constraint?: string; cause?: DriverError };

/** Drizzle wraps driver errors, so the details may be on `cause`. */
function find(e: unknown, pick: (d: DriverError) => string | undefined): string | undefined {
  const d = e as DriverError | null | undefined;
  return (d && pick(d)) ?? (d?.cause ? pick(d.cause) : undefined);
}

/** Postgres unique violation (23505). */
export function isUniqueViolation(e: unknown): boolean {
  return find(e, (d) => (d.code === "23505" ? "x" : undefined)) !== undefined;
}

export function violatedConstraint(e: unknown): string | undefined {
  return find(e, (d) => d.constraint_name ?? d.constraint);
}
