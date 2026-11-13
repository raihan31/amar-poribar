/** Design screen name (docs/design/screens/<Name>.dc.html) to the route or component file that implements it. */
export const implementedScreens: Record<string, string> = {
  Main: "app/(app)/page.tsx",
  Login: "app/(auth)/login/page.tsx",
  Consent: "app/(auth)/consent/page.tsx",
  Join: "app/(auth)/join/[token]/page.tsx",
  Welcome: "app/(auth)/welcome/page.tsx",
  SessionExpired: "app/(auth)/session-expired/page.tsx",
  Settings: "app/(app)/settings/page.tsx",
  Members: "app/(app)/family/page.tsx",
  Accounts: "app/(app)/accounts/page.tsx",
  Categories: "app/(app)/categories/page.tsx",
  Budgets: "app/(app)/budget/page.tsx",
  Txns: "app/(app)/list/page.tsx",
  TxnDetail: "app/(app)/txn/[id]/page.tsx",
  Sms: "app/(app)/add/sms/page.tsx",
  VoiceEntry: "app/(app)/add/voice/page.tsx",
  AddExpense: "app/(app)/add/page.tsx",
  Profile: "app/(app)/profile/page.tsx",
  FamilySwitch: "app/(app)/switch-family/page.tsx",
};

/** Design screens the web app does not implement (mobile only). */
export const notOnWeb = ["Tutorial", "SimpleHome", "Incoming", "SyncStatus", "Dhar"];
