import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import "@/styles/shell.css";
import { AT_COOKIE, RT_COOKIE } from "@/lib/auth/cookies";
import { FamilyProvider } from "@/components/shell/FamilyProvider";
import { TabBar } from "@/components/shell/TabBar";

// Session guard for every signed-in screen; the middleware does the same for first loads.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  if (!jar.has(AT_COOKIE) && !jar.has(RT_COOKIE)) redirect("/login");
  return (
    <FamilyProvider>
      <div className="app-shell">
        <div className="app-content">{children}</div>
        <TabBar />
      </div>
    </FamilyProvider>
  );
}
