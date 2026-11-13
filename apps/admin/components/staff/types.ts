export type StaffStatus = "active" | "locked_2fa" | "disabled";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  lastSignInAt: string | null;
  status: StaffStatus;
}

export type StaffAction = "change_role" | "remind" | "disable" | "reset_totp";
