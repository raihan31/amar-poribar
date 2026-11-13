export { BdPhoneSchema, normalizeBdPhone } from "@amar-poribar/shared";

/** `+8801712345678` -> `•••678`: never show more than the last three digits. */
export function maskPhone(phone: string): string {
  return `•••${phone.slice(-3)}`;
}
