export type T = { count: number };
/** @staff-safe */
export function tagged(): T {
  return { count: 1 };
}
export function untagged(): T {
  return { count: 2 };
}
