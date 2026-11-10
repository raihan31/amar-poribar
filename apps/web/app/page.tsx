import { AuthGate } from "@/components/features/auth/AuthGate";

// Thin route: composition lives in components/features (T-WEB-02).
export default function Home() {
  return <AuthGate />;
}
