import type { StaffMember } from "../components/staff/types";

/** Deterministic demo staff used by mock mode and tests. */
export interface DemoStaff {
  name: string;
  role: "owner" | "support" | "finance";
}

export function demoStaff(): DemoStaff {
  return { name: "Demo Staff", role: "owner" };
}

/** Design fixture of AdminStaff.dc.html. */
export function staffFixture(now: Date = new Date()): StaffMember[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  return [
    {
      id: "s1",
      name: "Demo Staff",
      email: "rubel@amarporibar.example",
      role: "owner",
      totpEnabled: true,
      lastSignInAt: ago(3_600_000),
      status: "active",
    },
    {
      id: "s2",
      name: "Support",
      email: "support@amarporibar.example",
      role: "support",
      totpEnabled: true,
      lastSignInAt: ago(86_400_000),
      status: "active",
    },
    {
      id: "s3",
      name: "Auditor",
      email: "auditor@amarporibar.example",
      role: "readonly",
      totpEnabled: false,
      lastSignInAt: null,
      status: "locked_2fa",
    },
  ];
}

const day = 86_400_000;

/** Design fixture of AdminPrivacy.dc.html: three open requests, relative to `now`. */
export function privacyFixture(now: Date = new Date()) {
  const at = (d: number) => new Date(now.getTime() + d * day).toISOString();
  const steps = (states: ("done" | "waiting" | "todo")[]) =>
    [
      "Confirm the person owns the phone number (OTP)",
      "This person is the family owner. Ask them to transfer ownership, or delete the whole family",
      "Offer a data export before deleting",
      "Delete profile, sessions and personal data (transactions they wrote stay, with the name removed)",
      "Send the person a confirmation by SMS",
    ].map((label, i) => ({ key: `s${i + 1}`, label, state: states[i] ?? ("todo" as const) }));
  return {
    items: [
      {
        id: "#PR-0192",
        kind: "delete" as const,
        personPhoneMasked: "••• 457",
        familyName: "রহিম পরিবার",
        receivedAt: at(-12),
        dueAt: at(18),
        step: "Identity checked",
        steps: steps(["done"]),
      },
      {
        id: "#PR-0195",
        kind: "export" as const,
        personPhoneMasked: "••• 904",
        familyName: "হোসেন পরিবার",
        receivedAt: at(-8),
        dueAt: at(22),
        step: "Building file",
        steps: steps(["done", "done", "waiting"]),
      },
      {
        id: "#PR-0188",
        kind: "delete" as const,
        personPhoneMasked: "••• 117",
        familyName: "সরকার পরিবার",
        receivedAt: at(-25),
        dueAt: at(4.5),
        step: "Waiting: owner transfer",
        steps: steps(["done", "waiting"]),
      },
    ],
    counts: { open: 3, done: 41, rejected: 2 },
  };
}
