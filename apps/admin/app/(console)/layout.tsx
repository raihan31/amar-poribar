import "../../styles/console.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { SessionBar } from "@/components/shell/SessionBar";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">
        <SessionBar />
        <main className="console-main">{children}</main>
      </div>
    </div>
  );
}
