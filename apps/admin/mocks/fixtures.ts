/** Deterministic demo staff used by mock mode and tests. */
export interface DemoStaff {
  name: string;
  role: "owner" | "support" | "finance";
}

export function demoStaff(): DemoStaff {
  return { name: "Demo Staff", role: "owner" };
}
