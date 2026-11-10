// Local shapes until generated API types replace them (T-WEB-04).
export type RoleName = "owner" | "admin" | "member" | "viewer";
export interface Family {
  id: string;
  name: string;
  role: RoleName;
}
export interface Member {
  userId: string;
  role: RoleName;
  name: string | null;
  phone: string;
}
export interface Category {
  id: string;
  key: string;
  kind: string;
  nameBn: string;
  nameEn: string;
  icon: string | null;
  isHidden?: boolean;
}
export interface BudgetRow {
  categoryId: string | null;
  nameBn: string;
  nameEn: string;
  limitPaisa: number;
  spentPaisa: number;
  level: "ok" | "warning" | "exceeded";
  inherited: boolean;
}
export interface Account {
  id: string;
  name: string;
  type: string;
}
