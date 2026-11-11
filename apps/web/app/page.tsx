import { redirect } from "next/navigation";
import { AuthGate } from "@/components/features/auth/AuthGate";

// Thin route: composition lives in components/features (T-WEB-02).
// Legacy invite links (/?invite=T) lead to the same flow as /join/T.
export default async function Home({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  const invite = (await searchParams).invite;
  const token = Array.isArray(invite) ? invite[0] : invite;
  if (token) redirect(`/join/${encodeURIComponent(token)}`);
  return <AuthGate />;
}
