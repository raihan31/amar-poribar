import { api } from "./client";

export interface Policy {
  version: string;
  text: string;
}

export function fetchPolicy(locale: "bn" | "en"): Promise<Policy> {
  return api<Policy>(`/v1/policy?locale=${locale}`);
}
