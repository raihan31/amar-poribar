/** OTP message body. Kept at 70 UTF-16 units or fewer so a Bangla text stays one SMS segment (T-ID-03). */
export const otpMessage = (code: string): string => `আমার পরিবার কোড: ${code}। কাউকে বলবেন না।`;
